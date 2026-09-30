import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { I18nContext, createI18n } from './i18n/useI18n'
import type { PhotoAsset, PhotoFilters, Settings, Verdict } from './photos/types'
import { activeFilterCount } from './hooks/filters'
import { usePhotoLibrary } from './hooks/usePhotoLibrary'
import { useReviewAlbum } from './hooks/useReviewAlbum'
import { useSettings } from './hooks/useSettings'
import { useSizeIndex } from './hooks/useSizeIndex'
import { useSwipeDeck } from './hooks/useSwipeDeck'
import { BottomBar } from './components/BottomBar'
import { Deck } from './components/Deck'
import type { DeckCard, DeckStatus } from './components/Deck'
import { DetailView } from './components/DetailView'
import { FilterSheet } from './components/FilterSheet'
import { PermissionGate } from './components/PermissionGate'
import type { EnterVector, ExitVector } from './components/PhotoCard'
import { ReviewScreen } from './components/ReviewScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { Toast } from './components/Toast'
import { TopBar } from './components/TopBar'
import type { ToastMessage } from './components/Toast'
import './App.css'

/** How many cards are mounted at once. */
const VISIBLE_CARDS = 3
/** How far ahead thumbnails are prefetched. */
const THUMB_LOOKAHEAD = 6
const TOAST_MS = 3200

type Sheet = 'review' | 'settings' | 'filters' | null

interface SortSnapshot {
  filters: PhotoFilters
  sortBy: Settings['sortBy']
  sortOrder: Settings['sortOrder']
}

function fireHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}

function exitVectorFor(
  verdict: Verdict,
  trashDirection: Settings['trashDirection'],
): ExitVector {
  const trashSign = trashDirection === 'left' ? -1 : 1
  switch (verdict) {
    case 'trash':
      return { x: trashSign * 640, y: 0, rotate: trashSign * 18 }
    case 'keep':
      return { x: -trashSign * 640, y: 0, rotate: -trashSign * 18 }
    case 'favorite':
      return { x: 0, y: -840, rotate: 0 }
    case 'later':
      return { x: 0, y: 840, rotate: 0 }
  }
}

function enterVectorFor(
  verdict: Verdict,
  trashDirection: Settings['trashDirection'],
): EnterVector {
  const vector = exitVectorFor(verdict, trashDirection)
  return { x: vector.x, y: vector.y }
}

export default function App() {
  const { settings, update, setFilters, reset: resetSettings } = useSettings()
  const i18n = useMemo(() => createI18n(settings.language), [settings.language])
  const { t, tn, formatBytes, formatCount } = i18n

  const lib = usePhotoLibrary({
    filters: settings.filters,
    sortBy: settings.sortBy,
    sortOrder: settings.sortOrder,
  })
  const deck = useSwipeDeck()
  const enabled = lib.permission === 'granted' || lib.permission === 'limited'
  const album = useReviewAlbum(settings.albumName, enabled)
  const sizeIndex = useSizeIndex(enabled)

  const [sheet, setSheet] = useState<Sheet>(null)
  const [filtersReturn, setFiltersReturn] = useState<Sheet>(null)
  const [detail, setDetail] = useState<PhotoAsset | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exitVector, setExitVector] = useState<ExitVector>({
    x: 640,
    y: 0,
    rotate: 18,
  })
  const [enterFor, setEnterFor] = useState<{
    id: string
    vector: EnterVector
  } | null>(null)
  const [scanRevert, setScanRevert] = useState<SortSnapshot | null>(null)

  const toastTimer = useRef<number | null>(null)
  const showToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'info') => {
      setToast({ id: Date.now(), text, tone })
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => {
        toastTimer.current = null
        setToast(null)
      }, TOAST_MS)
    },
    [],
  )
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  // ------------------------------------------------------------- deck model

  const {
    fetched,
    hasMore,
    getAssetAt,
    ensureLoadedFor,
    trimBefore,
    ensureThumbs,
    retainThumbs,
    thumbs,
    reload,
    generation,
  } = lib
  const { cursor, laterQueue, reset: resetDeck } = deck

  // Filters / sort changed → the old cursor is meaningless.
  useEffect(() => {
    resetDeck()
  }, [generation, resetDeck])

  /**
   * Virtual deck sequence: the library pages first, then the "later" tail.
   * The tail only becomes reachable once the library is exhausted, so its
   * indices can never shift underneath the cursor.
   */
  const resolveCard = useCallback(
    (index: number): PhotoAsset | undefined => {
      if (index < fetched) return getAssetAt(index)
      if (!hasMore) return laterQueue[index - fetched]
      return undefined
    },
    [fetched, getAssetAt, hasMore, laterQueue],
  )

  const cards = useMemo<DeckCard[]>(() => {
    const out: DeckCard[] = []
    for (let i = cursor; i < cursor + VISIBLE_CARDS; i += 1) {
      const asset = resolveCard(i)
      if (!asset) break
      out.push({ asset, thumb: thumbs.get(asset.id) })
    }
    return out
  }, [cursor, resolveCard, thumbs])

  useEffect(() => {
    ensureLoadedFor(cursor)
  }, [cursor, fetched, ensureLoadedFor])

  useEffect(() => {
    trimBefore(cursor)
  }, [cursor, trimBefore])

  // Prefetch the next few thumbnails and pin what must not be evicted.
  const reviewIds = useMemo(
    () => album.marked.slice(0, 60).map((a) => a.id),
    [album.marked],
  )
  const sheetIsReview = sheet === 'review'
  useEffect(() => {
    const upcoming: string[] = []
    for (let i = cursor; i < cursor + THUMB_LOOKAHEAD; i += 1) {
      const asset = resolveCard(i)
      if (asset) upcoming.push(asset.id)
    }
    const retain = [...upcoming]
    for (let i = Math.max(0, cursor - 3); i < cursor; i += 1) {
      const asset = resolveCard(i)
      if (asset) retain.push(asset.id)
    }
    if (sheetIsReview) retain.push(...reviewIds)
    retainThumbs(retain)
    ensureThumbs(upcoming)
  }, [cursor, resolveCard, retainThumbs, ensureThumbs, reviewIds, sheetIsReview])

  // ---------------------------------------------------------- size indexing

  const { ensureBuilt, ready: indexReady } = sizeIndex
  const sizeIndexPending = lib.sizeIndexPending

  useEffect(() => {
    if (sizeIndexPending) ensureBuilt()
  }, [sizeIndexPending, ensureBuilt])

  useEffect(() => {
    if (sizeIndexPending && indexReady) reload()
  }, [sizeIndexPending, indexReady, reload])

  useEffect(() => {
    if (indexReady) setScanRevert(null)
  }, [indexReady])

  const handleNeedSizeIndex = useCallback(() => {
    if (indexReady) return
    setScanRevert((prev) =>
      prev ?? {
        filters: settings.filters,
        sortBy: settings.sortBy,
        sortOrder: settings.sortOrder,
      },
    )
    ensureBuilt()
  }, [ensureBuilt, indexReady, settings.filters, settings.sortBy, settings.sortOrder])

  const handleCancelScan = useCallback(() => {
    if (scanRevert) {
      update(scanRevert)
      setScanRevert(null)
      return
    }
    update({
      filters: {
        ...settings.filters,
        minByteSize: undefined,
        maxByteSize: undefined,
      },
      sortBy: 'date',
    })
  }, [scanRevert, settings.filters, update])

  // --------------------------------------------------------------- verdicts

  const setFavorite = lib.setFavorite
  const handleVerdict = useCallback(
    (verdict: Verdict) => {
      const asset = resolveCard(cursor)
      if (!asset) return
      setEnterFor(null)
      setExitVector(exitVectorFor(verdict, settings.trashDirection))
      deck.commit(asset, verdict)
      if (settings.haptics) fireHaptic()
      if (verdict === 'trash') album.mark(asset)
      if (verdict === 'favorite' && !asset.isFavorite) {
        setFavorite(asset.id, true).catch(() => {
          showToast(t('toast.favoriteFailed'), 'error')
        })
      }
    },
    [
      album,
      cursor,
      deck,
      resolveCard,
      setFavorite,
      settings.haptics,
      settings.trashDirection,
      showToast,
      t,
    ],
  )

  const handleUndo = useCallback(() => {
    const entry = deck.undo()
    if (!entry) {
      showToast(t('toast.nothingToUndo'))
      return
    }
    setEnterFor({
      id: entry.asset.id,
      vector: enterVectorFor(entry.verdict, settings.trashDirection),
    })
    if (entry.verdict === 'trash') album.unmark(entry.asset.id)
    if (entry.verdict === 'favorite' && !entry.asset.isFavorite) {
      setFavorite(entry.asset.id, false).catch(() => {
        showToast(t('toast.favoriteFailed'), 'error')
      })
    }
  }, [album, deck, setFavorite, settings.trashDirection, showToast, t])

  // --------------------------------------------------------------- keyboard

  const verticalSwipes = settings.verticalSwipes
  const trashDirection = settings.trashDirection
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (detail) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setDetail(null)
        }
        return
      }
      if (sheet) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setSheet(null)
        }
        return
      }
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          handleVerdict(trashDirection === 'left' ? 'trash' : 'keep')
          break
        case 'ArrowRight':
          event.preventDefault()
          handleVerdict(trashDirection === 'left' ? 'keep' : 'trash')
          break
        case 'ArrowUp':
          if (!verticalSwipes) return
          event.preventDefault()
          handleVerdict('favorite')
          break
        case 'ArrowDown':
          if (!verticalSwipes) return
          event.preventDefault()
          handleVerdict('later')
          break
        case 'z':
        case 'Z':
          event.preventDefault()
          handleUndo()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detail, handleUndo, handleVerdict, sheet, trashDirection, verticalSwipes])

  // ----------------------------------------------------------------- sheets

  const albumFlush = album.flush
  const albumRefresh = album.refresh
  const openReview = useCallback(() => {
    setSheet('review')
    void albumRefresh()
  }, [albumRefresh])

  const openSettingsSheet = useCallback(() => {
    void albumFlush()
    setSheet('settings')
  }, [albumFlush])

  const openFilters = useCallback((from: Sheet) => {
    setFiltersReturn(from)
    setSheet('filters')
  }, [])

  const deletePhotos = lib.deletePhotos
  const albumApplyDeleted = album.applyDeleted
  const deckForget = deck.forget
  const marked = album.marked
  const albumName = settings.albumName

  const handleDelete = useCallback(async () => {
    if (marked.length === 0 || deleting) return
    setDeleting(true)
    try {
      await albumFlush()
      const ids = marked.map((a) => a.id)
      const bytesById = new Map(marked.map((a) => [a.id, a.byteSize]))
      const result = await deletePhotos(ids)
      if (!result.confirmed) {
        showToast(t('toast.deleteCancelled', { album: albumName }), 'warn')
        return
      }
      const freed = result.deletedIds.reduce(
        (sum, id) => sum + (bytesById.get(id) ?? 0),
        0,
      )
      albumApplyDeleted(result.deletedIds)
      deckForget(result.deletedIds)
      showToast(
        tn('toast.deleted', result.deletedIds.length, {
          count: formatCount(result.deletedIds.length),
          size: formatBytes(freed),
        }),
        'success',
      )
      if (result.deletedIds.length >= ids.length) setSheet(null)
    } catch {
      showToast(t('toast.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }, [
    albumApplyDeleted,
    albumFlush,
    albumName,
    deckForget,
    deleting,
    deletePhotos,
    formatBytes,
    formatCount,
    marked,
    showToast,
    t,
    tn,
  ])

  // ------------------------------------------------------------------ render

  const filterCount = activeFilterCount(settings.filters)
  const totalWithQueue = lib.total + laterQueue.length

  let status: DeckStatus
  if (sizeIndexPending) status = 'scanning'
  else if (cards.length > 0) status = 'cards'
  else if (lib.loading || hasMore) status = 'loading'
  else if (cursor === 0) status = 'empty'
  else status = 'done'

  const gateVisible =
    lib.permission === null ||
    lib.permission === 'denied' ||
    lib.permission === 'notDetermined'

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        {gateVisible ? (
          <PermissionGate
            checking={lib.permission === null}
            onOpenSettings={lib.openSettings}
            onRecheck={lib.recheckPermission}
          />
        ) : (
          <>
            <TopBar
              done={cursor}
              total={totalWithQueue}
              screenshotsOnly={Boolean(settings.filters.screenshotsOnly)}
              activeFilterCount={filterCount}
              limited={lib.permission === 'limited'}
              onToggleScreenshots={() =>
                setFilters({
                  ...settings.filters,
                  screenshotsOnly: settings.filters.screenshotsOnly
                    ? undefined
                    : true,
                })
              }
              onOpenFilters={() => openFilters(null)}
              onOpenSettings={openSettingsSheet}
              onManageLimited={lib.openSettings}
            />
            <Deck
              status={status}
              cards={cards}
              settings={settings}
              markedIds={album.markedIds}
              exitVector={exitVector}
              enterFor={enterFor}
              swipedCount={cursor}
              hasActiveFilters={filterCount > 0}
              sizeIndex={sizeIndex.status}
              onVerdict={handleVerdict}
              onOpenDetail={setDetail}
              onRestart={resetDeck}
              onClearFilters={() => setFilters({ mediaType: 'all' })}
              onCancelScan={handleCancelScan}
            />
            <BottomBar
              reviewCount={album.count}
              reviewBytes={album.bytes}
              syncing={album.syncing}
              canUndo={deck.canUndo}
              canSwipe={status === 'cards'}
              verticalSwipes={settings.verticalSwipes}
              onUndo={handleUndo}
              onVerdict={handleVerdict}
              onOpenReview={openReview}
            />
          </>
        )}

        {sheet === 'review' && (
          <ReviewScreen
            assets={album.marked}
            bytes={album.bytes}
            albumName={settings.albumName}
            trashDirection={settings.trashDirection}
            thumbs={thumbs}
            ensureThumbs={ensureThumbs}
            loading={album.loading}
            error={album.error}
            deleting={deleting}
            onUnmark={(id) => {
              album.unmark(id)
              showToast(t('toast.unmarked'))
            }}
            onDelete={() => void handleDelete()}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdate={update}
            onReset={resetSettings}
            onOpenFilters={() => openFilters('settings')}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet === 'filters' && (
          <FilterSheet
            filters={settings.filters}
            sortBy={settings.sortBy}
            sortOrder={settings.sortOrder}
            sizeIndex={sizeIndex.status}
            onChangeFilters={setFilters}
            onChangeSort={(sortBy, sortOrder) => update({ sortBy, sortOrder })}
            onNeedSizeIndex={handleNeedSizeIndex}
            onClose={() => setSheet(filtersReturn)}
          />
        )}

        <AnimatePresence>
          {detail && (
            <DetailView
              asset={detail}
              thumb={thumbs.get(detail.id)}
              loadFullImage={lib.getFullImage}
              onClose={() => setDetail(null)}
            />
          )}
        </AnimatePresence>

        <Toast toast={toast} />
      </div>
    </I18nContext.Provider>
  )
}
