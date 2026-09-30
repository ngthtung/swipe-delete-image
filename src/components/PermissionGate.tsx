import { useI18n } from '../i18n/useI18n'
import { IconPhotos } from './Icons'
import './PermissionGate.css'

interface PermissionGateProps {
  /** True while the initial checkPermissions() round-trip is in flight. */
  checking: boolean
  onOpenSettings: () => void
  onRecheck: () => void
}

export function PermissionGate({
  checking,
  onOpenSettings,
  onRecheck,
}: PermissionGateProps) {
  const { t } = useI18n()

  if (checking) {
    return (
      <div className="gate">
        <div className="spinner" />
        <p className="gate-body">{t('perm.checking')}</p>
      </div>
    )
  }

  return (
    <div className="gate">
      <div className="gate-icon">
        <IconPhotos size={34} />
      </div>
      <h1 className="gate-title">{t('perm.denied.title')}</h1>
      <p className="gate-body">{t('perm.denied.body')}</p>
      <div className="gate-actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onOpenSettings}
        >
          {t('perm.denied.settings')}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onRecheck}>
          {t('perm.denied.recheck')}
        </button>
      </div>
    </div>
  )
}
