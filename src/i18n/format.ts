import type { Language } from '../photos/types'

export const LOCALES: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
}

const countCache = new Map<string, Intl.NumberFormat>()
const dateCache = new Map<string, Intl.DateTimeFormat>()

function numberFormat(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}:${digits}`
  let fmt = countCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    countCache.set(key, fmt)
  }
  return fmt
}

function dateFormat(locale: string): Intl.DateTimeFormat {
  let fmt = dateCache.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    dateCache.set(locale, fmt)
  }
  return fmt
}

/** 5320 -> "5.320" (vi) / "5,320" (en) */
export function formatCount(value: number, lang: Language): string {
  return numberFormat(LOCALES[lang], 0).format(Math.max(0, Math.round(value)))
}

/** Byte size -> "1,45 GB" (vi) / "1.45 GB" (en) */
export function formatBytes(bytes: number, lang: Language): string {
  const locale = LOCALES[lang]
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return `${numberFormat(locale, 0).format(0)} MB`
  }
  const kb = bytes / 1024
  if (kb < 1000) return `${numberFormat(locale, 0).format(kb)} KB`
  const mb = kb / 1024
  if (mb < 1000) {
    return `${numberFormat(locale, mb < 10 ? 1 : 0).format(mb)} MB`
  }
  const gb = mb / 1024
  return `${numberFormat(locale, gb < 10 ? 2 : 1).format(gb)} GB`
}

/** Seconds -> "1:05" / "1:02:03" (digit grouping is locale-independent here) */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatDate(msSinceEpoch: number, lang: Language): string {
  if (!msSinceEpoch) return ''
  return dateFormat(LOCALES[lang]).format(new Date(msSinceEpoch))
}
