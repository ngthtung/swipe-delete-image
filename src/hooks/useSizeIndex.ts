import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhotoLibrary } from '../photos'
import type { SizeIndexStatus } from '../photos/types'

const POLL_MS = 1000

export interface SizeIndexApi {
  status: SizeIndexStatus | null
  /** True while the background scan runs (or is about to start). */
  building: boolean
  ready: boolean
  /** Starts the scan if it is not ready yet. Safe to call repeatedly. */
  ensureBuilt: () => void
  /** One-off status read, e.g. when the filter sheet opens. */
  refresh: () => void
}

/**
 * PHAsset exposes no file size to NSPredicate, so size filters/sorting need a
 * pre-built index. This hook owns the build + the 1 Hz progress polling, and
 * stops polling the moment the index reports 'ready'.
 */
export function useSizeIndex(enabled: boolean): SizeIndexApi {
  const [status, setStatus] = useState<SizeIndexStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const startedRef = useRef(false)

  const refresh = useCallback(() => {
    if (!enabled) return
    PhotoLibrary.getSizeIndexStatus()
      .then(setStatus)
      .catch(() => undefined)
  }, [enabled])

  const ensureBuilt = useCallback(() => {
    if (!enabled) return
    if (status?.state === 'ready') return
    if (startedRef.current) return
    startedRef.current = true
    setStarting(true)
    PhotoLibrary.buildSizeIndex()
      .then(setStatus)
      .catch(() => undefined)
      .finally(() => setStarting(false))
  }, [enabled, status?.state])

  // Poll only while building.
  useEffect(() => {
    if (!enabled) return
    if (status?.state !== 'building') return
    const timer = window.setInterval(() => {
      PhotoLibrary.getSizeIndexStatus()
        .then(setStatus)
        .catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, status?.state])

  // A finished (or reset) index may be rebuilt later on demand.
  useEffect(() => {
    if (status?.state === 'ready' || status?.state === 'absent') {
      startedRef.current = status.state !== 'absent'
    }
  }, [status?.state])

  return useMemo(
    () => ({
      status,
      building: starting || status?.state === 'building',
      ready: status?.state === 'ready',
      ensureBuilt,
      refresh,
    }),
    [status, starting, ensureBuilt, refresh],
  )
}
