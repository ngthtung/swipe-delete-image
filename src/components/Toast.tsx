import { AnimatePresence, motion } from 'framer-motion'
import './Toast.css'

export interface ToastMessage {
  id: number
  text: string
  tone: 'info' | 'success' | 'warn' | 'error'
}

interface ToastProps {
  toast: ToastMessage | null
}

export function Toast({ toast }: ToastProps) {
  return (
    <div className="toast-layer" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
