import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { REVIEW_ALBUM_BY_LANG } from '../photos'
import type { Language, Settings } from '../photos/types'
import { activeFilterCount } from '../hooks/filters'
import { IconClose, IconFilter } from './Icons'
import './SettingsScreen.css'

interface SettingsScreenProps {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  onReset: () => void
  onOpenFilters: () => void
  onClose: () => void
}

export function SettingsScreen({
  settings,
  onUpdate,
  onReset,
  onOpenFilters,
  onClose,
}: SettingsScreenProps) {
  const { t, tn, formatCount } = useI18n()
  const [albumDraft, setAlbumDraft] = useState(settings.albumName)

  const otherLanguage: Language = settings.language === 'vi' ? 'en' : 'vi'
  const suggestedAlbum = REVIEW_ALBUM_BY_LANG[settings.language]
  /**
   * Only offer the rename when the album is still the *other* language's
   * default — i.e. the user never customised it. Renaming is opt-in because
   * the album is a real album on the device.
   */
  const offerRename =
    settings.albumName === REVIEW_ALBUM_BY_LANG[otherLanguage] &&
    settings.albumName !== suggestedAlbum

  const commitAlbum = () => {
    const next = albumDraft.trim()
    if (next.length === 0) {
      setAlbumDraft(settings.albumName)
      return
    }
    if (next !== settings.albumName) onUpdate({ albumName: next })
  }

  const filterCount = activeFilterCount(settings.filters)

  return (
    <div className="sheet">
      <div className="sheet-header">
        <div className="sheet-title">{t('settings.title')}</div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <IconClose size={20} />
        </button>
      </div>

      <div className="sheet-body">
        <div className="group">
          <span className="group-label">{t('settings.language')}</span>
          <div className="segmented">
            {(['vi', 'en'] as const).map((lang) => (
              <button
                type="button"
                key={lang}
                className={`seg${settings.language === lang ? ' seg-on' : ''}`}
                onClick={() => onUpdate({ language: lang })}
              >
                {t(lang === 'vi' ? 'settings.language.vi' : 'settings.language.en')}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <span className="group-label">{t('settings.direction')}</span>
          <div className="segmented segmented-vertical">
            {(['left', 'right'] as const).map((direction) => (
              <button
                type="button"
                key={direction}
                className={`seg${settings.trashDirection === direction ? ' seg-on' : ''}`}
                onClick={() => onUpdate({ trashDirection: direction })}
              >
                {t(
                  direction === 'left'
                    ? 'settings.direction.left'
                    : 'settings.direction.right',
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <div className="row">
            <span className="row-text">
              <span className="row-label">{t('settings.vertical')}</span>
            </span>
            <button
              type="button"
              className={`switch${settings.verticalSwipes ? ' switch-on' : ''}`}
              role="switch"
              aria-checked={settings.verticalSwipes}
              aria-label={t('settings.vertical')}
              onClick={() => onUpdate({ verticalSwipes: !settings.verticalSwipes })}
            />
          </div>
          <span className="group-hint">{t('settings.vertical.hint')}</span>
        </div>

        <div className="group">
          <div className="row">
            <span className="row-text">
              <span className="row-label">{t('settings.haptics')}</span>
            </span>
            <button
              type="button"
              className={`switch${settings.haptics ? ' switch-on' : ''}`}
              role="switch"
              aria-checked={settings.haptics}
              aria-label={t('settings.haptics')}
              onClick={() => onUpdate({ haptics: !settings.haptics })}
            />
          </div>
          <span className="group-hint">{t('settings.haptics.hint')}</span>
        </div>

        <div className="group">
          <span className="group-label">{t('settings.album')}</span>
          <input
            className="field"
            type="text"
            value={albumDraft}
            onChange={(event) => setAlbumDraft(event.target.value)}
            onBlur={commitAlbum}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <span className="group-hint">{t('settings.album.hint')}</span>
          {offerRename && (
            <div className="rename-hint">
              <span>
                {t('settings.album.renameHint', {
                  current: settings.albumName,
                  suggested: suggestedAlbum,
                })}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setAlbumDraft(suggestedAlbum)
                  onUpdate({ albumName: suggestedAlbum })
                }}
              >
                {t('settings.album.renameAction', { suggested: suggestedAlbum })}
              </button>
              <span className="rename-warning">
                {t('settings.album.renameWarning')}
              </span>
            </div>
          )}
        </div>

        <div className="group">
          <span className="group-label">{t('settings.filters')}</span>
          <button type="button" className="btn btn-block" onClick={onOpenFilters}>
            <IconFilter size={17} />
            {t('settings.filters.open')}
            {filterCount > 0 && (
              <span className="chip-badge">
                {tn('filters.active', filterCount, {
                  count: formatCount(filterCount),
                })}
              </span>
            )}
          </button>
          <span className="group-hint">{t('settings.reloadNote')}</span>
        </div>

        <button type="button" className="btn btn-ghost btn-block" onClick={onReset}>
          {t('settings.reset')}
        </button>
      </div>

      <div className="sheet-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          {t('settings.done')}
        </button>
      </div>
    </div>
  )
}
