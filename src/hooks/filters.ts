import type { PhotoFilters, Settings } from '../photos/types'

export const MB = 1024 * 1024
export const SIZE_PRESETS_MB = [5, 20, 100] as const

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]) {
  return allowed.includes(value as T) ? (value as T) : undefined
}

/** Drops unknown / malformed fields coming from localStorage. */
export function normalizeFilters(raw: unknown): PhotoFilters {
  const input = (raw ?? {}) as Partial<PhotoFilters>
  const filters: PhotoFilters = {
    mediaType: oneOf(input.mediaType, ['all', 'image', 'video'] as const) ?? 'all',
  }
  const dateFrom = positiveNumber(input.dateFrom)
  const dateTo = positiveNumber(input.dateTo)
  if (dateFrom !== undefined) filters.dateFrom = dateFrom
  if (dateTo !== undefined) filters.dateTo = dateTo
  if (input.screenshotsOnly === true) filters.screenshotsOnly = true
  const minByteSize = positiveNumber(input.minByteSize)
  const maxByteSize = positiveNumber(input.maxByteSize)
  if (minByteSize !== undefined) filters.minByteSize = minByteSize
  if (maxByteSize !== undefined) filters.maxByteSize = maxByteSize
  return filters
}

export function activeFilterCount(filters: PhotoFilters): number {
  let count = 0
  if (filters.mediaType && filters.mediaType !== 'all') count += 1
  if (filters.screenshotsOnly) count += 1
  if (filters.dateFrom !== undefined || filters.dateTo !== undefined) count += 1
  if (filters.minByteSize !== undefined || filters.maxByteSize !== undefined) {
    count += 1
  }
  return count
}

/** True when the request cannot be served by PhotoKit predicates alone. */
export function requiresSizeIndex(
  filters: PhotoFilters,
  sortBy: Settings['sortBy'],
): boolean {
  return (
    sortBy === 'size' ||
    filters.minByteSize !== undefined ||
    filters.maxByteSize !== undefined
  )
}

/** Stable identity for a filter set — used to detect "reload the deck". */
export function filtersKey(
  filters: PhotoFilters,
  sortBy: Settings['sortBy'],
  sortOrder: Settings['sortOrder'],
): string {
  return [
    filters.mediaType ?? 'all',
    filters.dateFrom ?? '',
    filters.dateTo ?? '',
    filters.screenshotsOnly ? '1' : '',
    filters.minByteSize ?? '',
    filters.maxByteSize ?? '',
    sortBy,
    sortOrder,
  ].join('|')
}

// ------------------------------------------------------------- date helpers
// Bounds are inclusive and must be expressed in LOCAL time, otherwise the
// first/last day of the range silently drops out.

export function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** ms epoch -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInputValue(ms: number | undefined): string {
  if (ms === undefined) return ''
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" (local) -> inclusive start/end ms epoch. */
export function fromDateInputValue(
  value: string,
  edge: 'start' | 'end',
): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (Number.isNaN(date.getTime())) return undefined
  return edge === 'start' ? startOfDay(date) : endOfDay(date)
}

export function startOfThisYear(now = new Date()): number {
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()
}

export function oneYearAgo(now = new Date()): number {
  const d = new Date(now)
  d.setFullYear(d.getFullYear() - 1)
  return endOfDay(d)
}

export type DatePreset = 'all' | 'thisYear' | 'older1y' | 'custom'

export function detectDatePreset(filters: PhotoFilters): DatePreset {
  const { dateFrom, dateTo } = filters
  if (dateFrom === undefined && dateTo === undefined) return 'all'
  if (dateFrom === startOfThisYear() && dateTo === undefined) return 'thisYear'
  if (dateFrom === undefined && dateTo === oneYearAgo()) return 'older1y'
  return 'custom'
}

export type SizePreset = 'all' | 'over5' | 'over20' | 'over100' | 'custom'

export function detectSizePreset(filters: PhotoFilters): SizePreset {
  const { minByteSize, maxByteSize } = filters
  if (minByteSize === undefined && maxByteSize === undefined) return 'all'
  if (maxByteSize === undefined) {
    if (minByteSize === 5 * MB) return 'over5'
    if (minByteSize === 20 * MB) return 'over20'
    if (minByteSize === 100 * MB) return 'over100'
  }
  return 'custom'
}
