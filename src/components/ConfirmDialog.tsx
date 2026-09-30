import { motion } from 'framer-motion'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  body: string
  detail?: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * In-app confirmation. For deletion this is deliberately a second, explicit
 * tap: iOS then shows its own system dialog on top of it.
 */
export function ConfirmDialog({
  title,
  body,
  detail,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <motion.div
      className="dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        className="dialog"
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>
        {detail && <p className="dialog-detail">{detail}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className={`btn btn-block ${destructive ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
