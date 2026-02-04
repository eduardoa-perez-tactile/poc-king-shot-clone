import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { ToastItem, uiActions, useUiStore } from '../../store/uiStore'
import { useMotionSettings } from '../../hooks/useMotionSettings'

const iconFor = (toast: ToastItem) => {
  if (toast.variant === 'danger') return <AlertTriangle className="h-4 w-4 text-danger" />
  if (toast.variant === 'success') return <CheckCircle2 className="h-4 w-4 text-success" />
  return <Info className="h-4 w-4 text-accent" />
}

export const Toasts: React.FC = () => {
  const toasts = useUiStore((state) => state.toasts)
  const reduceMotion = useMotionSettings()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-auto fixed right-4 top-20 z-40 flex w-[280px] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface/90 p-3 shadow-soft"
            onClick={() => uiActions.dismissToast(toast.id)}
          >
            <div className="flex items-start gap-2 text-sm text-text">
              {iconFor(toast)}
              <span>{toast.message}</span>
            </div>
            <span
              className="toast-progress absolute bottom-0 left-0 h-[2px] w-full bg-accent/70"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
