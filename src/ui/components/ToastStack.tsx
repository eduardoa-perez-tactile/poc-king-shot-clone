import React from 'react'

export interface Toast {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export const ToastStack: React.FC<{
  toasts: Toast[]
  onDismiss: (id: string) => void
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <div>{toast.message}</div>
          <div className="button-row">
            {toast.actionLabel && toast.onAction && (
              <button className="btn" onClick={toast.onAction}>{toast.actionLabel}</button>
            )}
            <button className="btn" onClick={() => onDismiss(toast.id)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  )
}
