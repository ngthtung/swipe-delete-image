import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, REVIEW_ALBUM_BY_LANG } from '../photos'
import type { Language, PhotoFilters, Settings } from '../photos/types'
import { STRINGS } from '../i18n/strings'
import { normalizeFilters } from './filters'

const STORAGE_KEY = 'photoswipe.settings'

/** Shape of settings saved by older builds (flat `mediaFilter`, no filters). */
interface LegacySettings {
  mediaFilter?: unknown
}

/** First launch only: follow the device locale instead of the 'vi' default. */
export function detectLanguage(): Language {
  const tag = typeof navigator !== 'undefined' ? (navigator.language ?? '') : ''
  return tag.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function sanitize(raw: Partial<Settings> & LegacySettings): Settings {
  const albumName =
    typeof raw.albumName === 'string' && raw.albumName.trim().length > 0
      ? raw.albumName.trim()
      : DEFAULT_SETTINGS.albumName

  // Migration: the old flat `mediaFilter` becomes `filters.mediaType`.
  const filters: PhotoFilters = normalizeFilters(raw.filters)
  if (
    raw.filters === undefined &&
    (raw.mediaFilter === 'image' || raw.mediaFilter === 'video')
  ) {
    filters.mediaType = raw.mediaFilter
  }

  return {
    language: oneOf(
      raw.language,
      ['vi', 'en'] as const,
      DEFAULT_SETTINGS.language,
    ),
    trashDirection: oneOf(
      raw.trashDirection,
      ['left', 'right'] as const,
      DEFAULT_SETTINGS.trashDirection,
    ),
    filters,
    sortBy: oneOf(raw.sortBy, ['date', 'size'] as const, DEFAULT_SETTINGS.sortBy),
    sortOrder: oneOf(
      raw.sortOrder,
      ['newest', 'oldest'] as const,
      DEFAULT_SETTINGS.sortOrder,
    ),
    albumName,
    haptics:
      typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    verticalSwipes:
      typeof raw.verticalSwipes === 'boolean'
        ? raw.verticalSwipes
        : DEFAULT_SETTINGS.verticalSwipes,
  }
}

function loadSettings(): Settings {
  let saved: unknown = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) saved = JSON.parse(raw)
  } catch {
    saved = null
  }
  if (!saved || typeof saved !== 'object') {
    // Never seen this user before: seed language + album name from the locale.
    const language = detectLanguage()
    return {
      ...DEFAULT_SETTINGS,
      language,
      albumName: REVIEW_ALBUM_BY_LANG[language],
    }
  }
  // Merge over the defaults so newly added fields never break a saved config.
  return sanitize({
    ...DEFAULT_SETTINGS,
    ...(saved as Partial<Settings> & LegacySettings),
  })
}

export interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  setFilters: (filters: PhotoFilters) => void
  reset: () => void
}

export function useSettings(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Private mode / quota exceeded: preferences just will not persist.
    }
  }, [settings])

  useEffect(() => {
    document.documentElement.lang = settings.language
    // The <title> in index.html is static, so it would otherwise stay
    // Vietnamese for an English user.
    document.title = STRINGS[settings.language]['app.title']
  }, [settings.language])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => sanitize({ ...prev, ...patch }))
  }, [])

  const setFilters = useCallback((filters: PhotoFilters) => {
    setSettings((prev) => sanitize({ ...prev, filters }))
  }, [])

  const reset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, filters: { ...DEFAULT_SETTINGS.filters } })
  }, [])

  return useMemo(
    () => ({ settings, update, setFilters, reset }),
    [settings, update, setFilters, reset],
  )
}
