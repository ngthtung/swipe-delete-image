import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhotoLibrary } from '../photos'
import type {
  DeletePhotosResult,
  PermissionStatus,
  PhotoAsset,
  PhotoFilters,
  Settings,
} from '../photos/types'
import { filtersKey } from './filters'

export type PermissionState = PermissionStatus['status']

/** Assets fetched per native call. Never fetch the whole library at once. */
const PAGE_SIZE = 40
/** Fetch the next page when fewer than this many un-swiped assets are in memory. */
const PREFETCH_THRESHOLD = 15
/** How many already-swiped assets stay in the sliding window (undo needs a few). */
const KEEP_BEHIND = 60
/** Only trim when at least this many assets can be dropped, to avoid churn. */
const TRIM_CHUNK = 40
/** Thumbnails are base64 blobs: keep the cache small. */
const MAX_THUMBS = 64
const THUMB_WIDTH = 800
const FULL_WIDTH = 1400

interface AssetWindow {
  /** Global index of items[0]. */
  start: number
  items: PhotoAsset[]
}

export interface PhotoLibraryApi {
  permission: PermissionState | null
  permissionError: string | null
  recheckPermission: () => void
  openSettings: () => void

  /** Bumped whenever the deck is thrown away (filters / sort changed). */
  generation: number
  /** Total matching the current filters (plus assets deleted this session). */
  total: number
  /** How many assets have been enumerated so far. */
  fetched: number
  hasMore: boolean
  loading: boolean
  /** The last page needed the size index; the result was provisional. */
  sizeIndexPending: boolean
  /** Throw the window away and refetch from offset 0. */
  reload: () => void

  getAssetAt: (index: number) => PhotoAsset | undefined
  ensureLoadedFor: (cursor: number) => void
  trimBefore: (cursor: number) => void

  thumbs: ReadonlyMap<string, string>
  ensureThumbs: (ids: string[]) => void
  retainThumbs: (ids: string[]) => void

  getFullImage: (id: string) => Promise<string>
  setFavorite: (id: string, favorite: boolean) => Promise<void>
  deletePhotos: (ids: string[]) => Promise<DeletePhotosResult>
}

interface Options {
  filters: PhotoFilters
  sortBy: Settings['sortBy']
  sortOrder: Settings['sortOrder']
}

export function usePhotoLibrary({
  filters,
  sortBy,
  sortOrder,
}: Options): PhotoLibraryApi {
  const [permission, setPermission] = useState<PermissionState | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [assetWindow, setAssetWindow] = useState<AssetWindow>(() => ({
    start: 0,
    items: [],
  }))
  const [total, setTotal] = useState(0)
  const [fetched, setFetched] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sizeIndexPending, setSizeIndexPending] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [thumbs, setThumbs] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  )

  /** Offset for the next native listPhotos call. */
  const nativeOffsetRef = useRef(0)
  /** Assets deleted this session, so native offsets can be corrected. */
  const deletedCountRef = useRef(0)
  const fetchedRef = useRef(0)
  const hasMoreRef = useRef(true)
  const inflightRef = useRef(false)
  const generationRef = useRef(0)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const thumbsRef = useRef<ReadonlyMap<string, string>>(thumbs)
  const pendingThumbsRef = useRef<Set<string>>(new Set())
  const retainRef = useRef<Set<string>>(new Set())
  const requestedPermissionRef = useRef(false)

  const queryKey = filtersKey(filters, sortBy, sortOrder)
  const queryRef = useRef({ filters, sortBy, sortOrder })

  // Declared before every effect that fetches, so the ref is always current
  // by the time a page load runs (effects fire in declaration order).
  useEffect(() => {
    queryRef.current = { filters, sortBy, sortOrder }
  }, [filters, sortBy, sortOrder])

  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])

  // ---------------------------------------------------------------- permission

  const resolvePermission = useCallback(async (allowRequest: boolean) => {
    try {
      let result = await PhotoLibrary.checkPermissions()
      if (
        result.status === 'notDetermined' &&
        allowRequest &&
        !requestedPermissionRef.current
      ) {
        requestedPermissionRef.current = true
        result = await PhotoLibrary.requestPermissions()
      }
      setPermission(result.status)
      setPermissionError(null)
    } catch (err) {
      setPermissionError(
        err instanceof Error ? err.message : 'checkPermissions failed',
      )
      setPermission('denied')
    }
  }, [])

  useEffect(() => {
    void resolvePermission(true)
  }, [resolvePermission])

  // Returning from iOS Settings should pick up an upgraded permission.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resolvePermission(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [resolvePermission])

  const recheckPermission = useCallback(() => {
    void resolvePermission(true)
  }, [resolvePermission])

  const openSettings = useCallback(() => {
    void PhotoLibrary.openSettings()
  }, [])

  // -------------------------------------------------------------------- paging

  const loadNextPage = useCallback(async () => {
    if (inflightRef.current || !hasMoreRef.current) return
    const gen = generationRef.current
    inflightRef.current = true
    setLoading(true)
    try {
      const offset = Math.max(0, nativeOffsetRef.current)
      const query = queryRef.current
      const result = await PhotoLibrary.listPhotos({
        ...query.filters,
        offset,
        limit: PAGE_SIZE,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      })
      if (gen !== generationRef.current) return

      if (result.sizeIndexPending) {
        // Provisional result — never render it as the final filtered set.
        setSizeIndexPending(true)
        hasMoreRef.current = false
        setHasMore(false)
        return
      }

      nativeOffsetRef.current = offset + result.assets.length
      setTotal(result.total + deletedCountRef.current)

      // Deletions shift native offsets, so the same asset can come back twice.
      const fresh = result.assets.filter((a) => !seenIdsRef.current.has(a.id))
      for (const asset of fresh) seenIdsRef.current.add(asset.id)

      if (fresh.length > 0) {
        fetchedRef.current += fresh.length
        setFetched(fetchedRef.current)
        setAssetWindow((prev) => ({
          start: prev.start,
          items: [...prev.items, ...fresh],
        }))
      }

      if (
        result.assets.length === 0 ||
        nativeOffsetRef.current >= result.total
      ) {
        hasMoreRef.current = false
        setHasMore(false)
      }
    } catch {
      // A failed page just stalls the deck; the next cursor change retries.
    } finally {
      if (gen === generationRef.current) {
        inflightRef.current = false
        setLoading(false)
      }
    }
  }, [])

  // Filters / sort / manual reload → throw the window away and start over.
  useEffect(() => {
    generationRef.current += 1
    nativeOffsetRef.current = 0
    deletedCountRef.current = 0
    fetchedRef.current = 0
    hasMoreRef.current = true
    inflightRef.current = false
    seenIdsRef.current = new Set()
    setAssetWindow({ start: 0, items: [] })
    setFetched(0)
    setTotal(0)
    setHasMore(true)
    setLoading(false)
    setSizeIndexPending(false)
    setGeneration(generationRef.current)
  }, [queryKey, reloadToken])

  // First page, once we are allowed to read the library.
  useEffect(() => {
    if (permission === 'granted' || permission === 'limited') {
      void loadNextPage()
    }
  }, [permission, queryKey, reloadToken, loadNextPage])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  const ensureLoadedFor = useCallback(
    (cursor: number) => {
      if (!hasMoreRef.current) return
      if (fetchedRef.current - cursor < PREFETCH_THRESHOLD) {
        void loadNextPage()
      }
    },
    [loadNextPage],
  )

  const trimBefore = useCallback((cursor: number) => {
    setAssetWindow((prev) => {
      const desiredStart = Math.max(0, cursor - KEEP_BEHIND)
      const drop = desiredStart - prev.start
      if (drop < TRIM_CHUNK) return prev
      return { start: desiredStart, items: prev.items.slice(drop) }
    })
  }, [])

  const getAssetAt = useCallback(
    (index: number): PhotoAsset | undefined => {
      const local = index - assetWindow.start
      if (local < 0 || local >= assetWindow.items.length) return undefined
      return assetWindow.items[local]
    },
    [assetWindow],
  )

  // ---------------------------------------------------------------- thumbnails

  const putThumb = useCallback((id: string, dataUrl: string) => {
    const retain = retainRef.current
    setThumbs((prev) => {
      const next = new Map(prev)
      next.set(id, dataUrl)
      if (next.size > MAX_THUMBS) {
        // Map preserves insertion order: drop the oldest non-retained entries.
        for (const key of next.keys()) {
          if (next.size <= MAX_THUMBS) break
          if (key === id || retain.has(key)) continue
          next.delete(key)
        }
      }
      return next
    })
  }, [])

  const ensureThumbs = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        if (!id) continue
        if (thumbsRef.current.has(id)) continue
        if (pendingThumbsRef.current.has(id)) continue
        pendingThumbsRef.current.add(id)
        PhotoLibrary.getThumbnail({ id, targetWidth: THUMB_WIDTH })
          .then((res) => putThumb(id, res.dataUrl))
          .catch(() => undefined)
          .finally(() => pendingThumbsRef.current.delete(id))
      }
    },
    [putThumb],
  )

  const retainThumbs = useCallback((ids: string[]) => {
    retainRef.current = new Set(ids)
  }, [])

  const getFullImage = useCallback(async (id: string) => {
    const res = await PhotoLibrary.getFullImage({ id, targetWidth: FULL_WIDTH })
    return res.dataUrl
  }, [])

  const setFavorite = useCallback(async (id: string, favorite: boolean) => {
    await PhotoLibrary.setFavorite({ id, favorite })
  }, [])

  // ------------------------------------------------------------------ deleting

  const deletePhotos = useCallback(async (ids: string[]) => {
    const result = await PhotoLibrary.deletePhotos({ ids })
    if (result.confirmed && result.deletedIds.length > 0) {
      // Deleted assets always sit behind the cursor, so window indices of the
      // un-swiped cards stay valid; only future native offsets need fixing.
      deletedCountRef.current += result.deletedIds.length
      nativeOffsetRef.current = Math.max(
        0,
        nativeOffsetRef.current - result.deletedIds.length,
      )
      const gone = new Set(result.deletedIds)
      setThumbs((prev) => {
        const next = new Map(prev)
        for (const id of gone) next.delete(id)
        return next
      })
    }
    return result
  }, [])

  return useMemo(
    () => ({
      permission,
      permissionError,
      recheckPermission,
      openSettings,
      generation,
      total,
      fetched,
      hasMore,
      loading,
      sizeIndexPending,
      reload,
      getAssetAt,
      ensureLoadedFor,
      trimBefore,
      thumbs,
      ensureThumbs,
      retainThumbs,
      getFullImage,
      setFavorite,
      deletePhotos,
    }),
    [
      permission,
      permissionError,
      recheckPermission,
      openSettings,
      generation,
      total,
      fetched,
      hasMore,
      loading,
      sizeIndexPending,
      reload,
      getAssetAt,
      ensureLoadedFor,
      trimBefore,
      thumbs,
      ensureThumbs,
      retainThumbs,
      getFullImage,
      setFavorite,
      deletePhotos,
    ],
  )
}
