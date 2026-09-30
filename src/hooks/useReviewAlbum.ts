import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhotoLibrary } from '../photos'
import type { PhotoAsset } from '../photos/types'

/** Flush the write buffer once this many pending changes pile up. */
const FLUSH_AT = 10
/** …or this long after the last swipe. */
const IDLE_FLUSH_MS = 3000
/** Safety valve for the flush loop. */
const MAX_ROUNDS = 4

export interface ReviewAlbumApi {
  /** Everything currently in the album (previous sessions included). */
  marked: PhotoAsset[]
  markedIds: ReadonlySet<string>
  count: number
  bytes: number
  /** False when the album has not been created on the device yet. */
  exists: boolean
  loading: boolean
  /** True while writes are buffered or in flight. */
  syncing: boolean
  error: boolean
  mark: (asset: PhotoAsset) => void
  unmark: (id: string) => void
  /** Pushes any buffered album writes to the device. */
  flush: () => Promise<void>
  /** Flush, then re-read the album from the device. */
  refresh: () => Promise<void>
  applyDeleted: (ids: string[]) => void
}

/**
 * Owns the "Chờ xoá" review album.
 *
 * Swipes only touch local state and a small write buffer — the native
 * addToAlbum/removeFromAlbum round-trips are batched so the gesture never
 * waits on the photo library.
 */
export function useReviewAlbum(
  albumName: string,
  enabled: boolean,
): ReviewAlbumApi {
  const [marked, setMarked] = useState<PhotoAsset[]>([])
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState(false)

  const addBufRef = useRef<Set<string>>(new Set())
  const removeBufRef = useRef<Set<string>>(new Set())
  const flushingRef = useRef<Promise<void> | null>(null)
  const timerRef = useRef<number | null>(null)
  const albumRef = useRef(albumName)
  useEffect(() => {
    albumRef.current = albumName
  }, [albumName])

  const syncPendingCount = useCallback(() => {
    setPending(addBufRef.current.size + removeBufRef.current.size)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const flush = useCallback(async (): Promise<void> => {
    clearTimer()
    if (flushingRef.current) await flushingRef.current
    if (addBufRef.current.size === 0 && removeBufRef.current.size === 0) return

    const round = async () => {
      for (let i = 0; i < MAX_ROUNDS; i += 1) {
        const adds = Array.from(addBufRef.current)
        const removes = Array.from(removeBufRef.current)
        if (adds.length === 0 && removes.length === 0) return
        addBufRef.current.clear()
        removeBufRef.current.clear()
        try {
          if (adds.length > 0) {
            await PhotoLibrary.addToAlbum({
              ids: adds,
              albumName: albumRef.current,
            })
            setExists(true)
          }
          if (removes.length > 0) {
            await PhotoLibrary.removeFromAlbum({
              ids: removes,
              albumName: albumRef.current,
            })
          }
          setError(false)
        } catch {
          // Put the work back so a later flush retries it.
          for (const id of adds) addBufRef.current.add(id)
          for (const id of removes) removeBufRef.current.add(id)
          setError(true)
          return
        } finally {
          syncPendingCount()
        }
      }
    }

    const promise = round()
    flushingRef.current = promise
    try {
      await promise
    } finally {
      if (flushingRef.current === promise) flushingRef.current = null
      syncPendingCount()
    }
  }, [clearTimer, syncPendingCount])

  const schedule = useCallback(() => {
    syncPendingCount()
    const queued = addBufRef.current.size + removeBufRef.current.size
    if (queued >= FLUSH_AT) {
      void flush()
      return
    }
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, IDLE_FLUSH_MS)
  }, [clearTimer, flush, syncPendingCount])

  const mark = useCallback(
    (asset: PhotoAsset) => {
      setMarked((prev) =>
        prev.some((a) => a.id === asset.id) ? prev : [...prev, asset],
      )
      removeBufRef.current.delete(asset.id)
      addBufRef.current.add(asset.id)
      schedule()
    },
    [schedule],
  )

  const unmark = useCallback(
    (id: string) => {
      setMarked((prev) => prev.filter((a) => a.id !== id))
      if (addBufRef.current.has(id)) {
        // Never reached the device — just drop the buffered add.
        addBufRef.current.delete(id)
      } else {
        removeBufRef.current.add(id)
      }
      schedule()
    },
    [schedule],
  )

  const refresh = useCallback(async () => {
    if (!enabled) return
    await flush()
    setLoading(true)
    try {
      const result = await PhotoLibrary.getAlbumAssets({
        albumName: albumRef.current,
      })
      setExists(result.exists)
      setMarked(result.assets)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, flush])

  const applyDeleted = useCallback((ids: string[]) => {
    const gone = new Set(ids)
    setMarked((prev) => prev.filter((a) => !gone.has(a.id)))
    for (const id of ids) {
      addBufRef.current.delete(id)
      removeBufRef.current.delete(id)
    }
  }, [])

  // Load the album (and reload it when the configured name changes).
  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, albumName, refresh])

  // Never leave buffered writes behind when the app goes away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [flush])

  useEffect(() => clearTimer, [clearTimer])

  const markedIds = useMemo(
    () => new Set(marked.map((a) => a.id)),
    [marked],
  )
  const bytes = useMemo(
    () => marked.reduce((sum, a) => sum + (a.byteSize || 0), 0),
    [marked],
  )

  return useMemo(
    () => ({
      marked,
      markedIds,
      count: marked.length,
      bytes,
      exists,
      loading,
      syncing: pending > 0,
      error,
      mark,
      unmark,
      flush,
      refresh,
      applyDeleted,
    }),
    [
      marked,
      markedIds,
      bytes,
      exists,
      loading,
      pending,
      error,
      mark,
      unmark,
      flush,
      refresh,
      applyDeleted,
    ],
  )
}
