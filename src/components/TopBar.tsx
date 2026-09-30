import { useI18n } from '../i18n/useI18n'
import { IconFilter, IconScreenshot, IconSettings } from './Icons'
import './Chrome.css'

interface TopBarProps {
  done: number
  total: number
  screenshotsOnly: boolean
  activeFilterCount: number
  limited: boolean
  onToggleScreenshots: () => void
  onOpenFilters: () => void
  onOpenSettings: () => void
  onManageLimited: () => void
}

export function TopBar({
  done,
  total,
  screenshotsOnly,
  activeFilterCount,
  limited,
  onToggleScreenshots,
  onOpenFilters,
  onOpenSettings,
  onManageLimited,
}: TopBarProps) {
  const { t, formatCount } = useI18n()
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0

  return (
    <header className="topbar">
      <div className="topbar-row">
        <span className="topbar-progress-text">
          {t('header.progress', {
            done: formatCount(done),
            total: formatCount(total),
          })}
        </span>
        <div className="topbar-actions">
          <button
            type="button"
            className={`chip${screenshotsOnly ? ' chip-on' : ''}`}
            onClick={onToggleScreenshots}
            aria-pressed={screenshotsOnly}
          >
            <IconScreenshot size={15} />
            {t('header.screenshots')}
          </button>
          <button
            type="button"
            className={`chip${activeFilterCount > 0 ? ' chip-on' : ''}`}
            onClick={onOpenFilters}
          >
            <IconFilter size={15} />
            {t('header.filters')}
            {activeFilterCount > 0 && (
              <span className="chip-badge">{activeFilterCount}</span>
            )}
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={onOpenSettings}
            aria-label={t('header.settings')}
          >
            <IconSettings size={19} />
          </button>
        </div>
      </div>

      <div className="topbar-bar">
        <div className="topbar-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {limited && (
        <div className="banner">
          <span>{t('perm.limited.banner', { count: formatCount(total) })}</span>
          <button type="button" className="btn btn-sm" onClick={onManageLimited}>
            {t('perm.limited.action')}
          </button>
        </div>
      )}
    </header>
  )
}
