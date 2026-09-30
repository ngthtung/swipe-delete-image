import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animate, useMotionValue, useTransform } from 'framer-motion'
import type { MotionValue, PanInfo } from 'framer-motion'
import type { PhotoAsset, Settings, Verdict } from '../photos/types'

/** Undo depth. The spec asks for 10+; 40 costs nothing (no pixels retained). */
const HISTORY_LIMIT = 40
/** Travel that commits a verdict. */
const COMMIT_DISTANCE = 100
/** A fast flick commits even on a short travel. */
const COMMIT_VELOCITY = 650
const MIN_FLICK_DISTANCE = 24
/** Pointer travel above which a gesture is a drag, not a tap. */
const TAP_SLOP = 8
/** Travel after which the gesture locks onto one axis for good. */
const AXIS_LOCK_DISTANCE = 10

export interface SwipeEntry {
  asset: PhotoAsset
  verdict: Verdict
  /** For 'later': whether this swipe actually appended to the requeue tail. */
  requeued: boolean
}

export interface SwipeDeckApi {
  /** Index of the top card in the virtual deck sequence. */
  cursor: number
  history: SwipeEntry[]
  canUndo: boolean
  /** Assets sent to the back of the deck by a "later" swipe. */
  laterQueue: PhotoAsset[]
  commit: (asset: PhotoAsset, verdict: Verdict) => void
  /** Pops the last verdict and returns it so the caller can reverse side effects. */
  undo: () => SwipeEntry | null
  /** Drops history/queue entries for assets that no longer exist. */
  forget: (ids: string[]) => void
  reset: () => void
}

export function useSwipeDeck(): SwipeDeckApi {
  const [cursor, setCursor] = useState(0)
  const [history, setHistory] = useState<SwipeEntry[]>([])
  const [laterQueue, setLaterQueue] = useState<PhotoAsset[]>([])
  const historyRef = useRef<SwipeEntry[]>(history)
  /** Ids already sent to the back once — never requeue the same asset twice. */
  const requeuedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const commit = useCallback((asset: PhotoAsset, verdict: Verdict) => {
    let requeued = false
    if (verdict === 'later' && !requeuedRef.current.has(asset.id)) {
      requeuedRef.current.add(asset.id)
      requeued = true
      setLaterQueue((queue) => [...queue, asset])
    }
    const next = [...historyRef.current, { asset, verdict, requeued }].slice(
      -HISTORY_LIMIT,
    )
    historyRef.current = next
    setHistory(next)
    setCursor((c) => c + 1)
  }, [])

  const undo = useCallback((): SwipeEntry | null => {
    const current = historyRef.current
    if (current.length === 0) return null
    const last = current[current.length - 1]
    const next = current.slice(0, -1)
    historyRef.current = next
    setHistory(next)
    setCursor((c) => Math.max(0, c - 1))
    if (last.requeued) {
      requeuedRef.current.delete(last.asset.id)
      setLaterQueue((queue) => {
        const index = queue.lastIndexOf(last.asset)
        if (index < 0) return queue
        return [...queue.slice(0, index), ...queue.slice(index + 1)]
      })
    }
    return last
  }, [])

  const forget = useCallback((ids: string[]) => {
    const gone = new Set(ids)
    const next = historyRef.current.filter((e) => !gone.has(e.asset.id))
    historyRef.current = next
    setHistory(next)
    setLaterQueue((queue) => queue.filter((a) => !gone.has(a.id)))
    for (const id of ids) requeuedRef.current.delete(id)
  }, [])

  const reset = useCallback(() => {
    historyRef.current = []
    requeuedRef.current = new Set()
    setHistory([])
    setLaterQueue([])
    setCursor(0)
  }, [])

  return useMemo(
    () => ({
      cursor,
      history,
      canUndo: history.length > 0,
      laterQueue,
      commit,
      undo,
      forget,
      reset,
    }),
    [cursor, history, laterQueue, commit, undo, forget, reset],
  )
}

export interface CardSwipe {
  x: MotionValue<number>
  y: MotionValue<number>
  rotate: MotionValue<number>
  keepOpacity: MotionValue<number>
  trashOpacity: MotionValue<number>
  favoriteOpacity: MotionValue<number>
  laterOpacity: MotionValue<number>
  keepTint: MotionValue<number>
  trashTint: MotionValue<number>
  favoriteTint: MotionValue<number>
  laterTint: MotionValue<number>
  onDragStart: () => void
  onDrag: (event: unknown, info: PanInfo) => void
  onDragEnd: (event: unknown, info: PanInfo) => void
  /** True when the pointer moved far enough that the gesture was not a tap. */
  wasDragged: () => boolean
}

interface CardSwipeOptions {
  trashDirection: Settings['trashDirection']
  verticalSwipes: boolean
  onCommit: (verdict: Verdict) => void
}

/**
 * Per-card drag gesture.
 *
 * `trashDirection` decides which horizontal side means "collect into the
 * review album", so the overlays and the commit mapping stay in sync with the
 * user's setting. Vertical drags map to favourite (up) / later (down).
 *
 * The gesture locks onto the dominant axis after ~10px and keeps that axis for
 * the rest of the drag, so a diagonal flick can never fire the wrong verdict.
 */
export function useCardSwipe({
  trashDirection,
  verticalSwipes,
  onCommit,
}: CardSwipeOptions): CardSwipe {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16])

  const rightOpacity = useTransform(x, [24, 130], [0, 1])
  const leftOpacity = useTransform(x, [-130, -24], [1, 0])
  const rightTint = useTransform(x, [24, 180], [0, 0.45])
  const leftTint = useTransform(x, [-180, -24], [0.45, 0])
  const favoriteOpacity = useTransform(y, [-130, -24], [1, 0])
  const favoriteTint = useTransform(y, [-180, -24], [0.45, 0])
  const laterOpacity = useTransform(y, [24, 130], [0, 1])
  const laterTint = useTransform(y, [24, 180], [0, 0.45])

  const draggedRef = useRef(false)
  const axisRef = useRef<'x' | 'y' | null>(null)
  const trashIsLeft = trashDirection === 'left'

  const onDragStart = useCallback(() => {
    draggedRef.current = false
    axisRef.current = null
  }, [])

  const onDrag = useCallback(
    (_event: unknown, info: PanInfo) => {
      const { x: dx, y: dy } = info.offset
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) {
        draggedRef.current = true
      }
      if (!verticalSwipes) return
      if (
        axisRef.current === null &&
        (Math.abs(dx) > AXIS_LOCK_DISTANCE || Math.abs(dy) > AXIS_LOCK_DISTANCE)
      ) {
        axisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      }
      // Free drag moves both axes; pin the off-axis so the card slides clean.
      if (axisRef.current === 'x') y.set(0)
      else if (axisRef.current === 'y') x.set(0)
    },
    [verticalSwipes, x, y],
  )

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      const { x: dx, y: dy } = info.offset
      const { x: vx, y: vy } = info.velocity
      const axis: 'x' | 'y' = !verticalSwipes
        ? 'x'
        : (axisRef.current ?? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'))
      const delta = axis === 'x' ? dx : dy
      const velocity = axis === 'x' ? vx : vy
      const farEnough = Math.abs(delta) > COMMIT_DISTANCE
      const fastEnough =
        Math.abs(velocity) > COMMIT_VELOCITY &&
        Math.abs(delta) > MIN_FLICK_DISTANCE

      if (farEnough || fastEnough) {
        const direction = farEnough ? Math.sign(delta) : Math.sign(velocity)
        if (axis === 'x') {
          const isLeft = direction < 0
          onCommit(isLeft === trashIsLeft ? 'trash' : 'keep')
        } else {
          onCommit(direction < 0 ? 'favorite' : 'later')
        }
        return
      }

      const spring = { type: 'spring' as const, stiffness: 520, damping: 38 }
      animate(x, 0, spring)
      animate(y, 0, spring)
      axisRef.current = null
    },
    [onCommit, trashIsLeft, verticalSwipes, x, y],
  )

  return {
    x,
    y,
    rotate,
    keepOpacity: trashIsLeft ? rightOpacity : leftOpacity,
    trashOpacity: trashIsLeft ? leftOpacity : rightOpacity,
    favoriteOpacity,
    laterOpacity,
    keepTint: trashIsLeft ? rightTint : leftTint,
    trashTint: trashIsLeft ? leftTint : rightTint,
    favoriteTint,
    laterTint,
    onDragStart,
    onDrag,
    onDragEnd,
    wasDragged: () => draggedRef.current,
  }
}
