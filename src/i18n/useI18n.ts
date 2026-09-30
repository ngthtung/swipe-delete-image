import { createContext, useContext } from 'react'
import type { Language } from '../photos/types'
import { formatBytes, formatCount, formatDate, formatDuration } from './format'
import { STRINGS } from './strings'
import type { PluralKey, StringKey } from './strings'

export type TParams = Record<string, string | number>

export interface I18n {
  lang: Language
  /** Translate a key, interpolating `{placeholders}`. */
  t: (key: StringKey, params?: TParams) => string
  /** Plural-aware translate: picks `${key}_one` / `${key}_other` by count. */
  tn: (key: PluralKey, count: number, params?: TParams) => string
  /** "{count} photos" in the active language. */
  photos: (count: number) => string
  formatCount: (value: number) => string
  formatBytes: (bytes: number) => string
  formatDate: (ms: number) => string
  formatDuration: (seconds: number) => string
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function createI18n(lang: Language): I18n {
  const table = STRINGS[lang]
  const t = (key: StringKey, params?: TParams) =>
    interpolate(table[key], params)
  const tn = (key: PluralKey, count: number, params?: TParams) => {
    const variant = (count === 1 ? `${key}_one` : `${key}_other`) as StringKey
    return interpolate(table[variant], { count, ...params })
  }
  return {
    lang,
    t,
    tn,
    photos: (count: number) =>
      tn('common.nPhotos', count, { count: formatCount(count, lang) }),
    formatCount: (value: number) => formatCount(value, lang),
    formatBytes: (bytes: number) => formatBytes(bytes, lang),
    formatDate: (ms: number) => formatDate(ms, lang),
    formatDuration,
  }
}

export const I18nContext = createContext<I18n>(createI18n('vi'))

export function useI18n(): I18n {
  return useContext(I18nContext)
}
