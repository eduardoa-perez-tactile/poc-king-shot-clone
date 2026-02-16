import React, { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

const getFocusable = (container: HTMLElement | null) => {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled'))
}

export const Dialog: React.FC<{
  open: boolean
  title: string
  description?: string
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}> = ({ open, title, description, onOpenChange, children, footer, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    const focusable = getFocusable(container)
    focusable[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
      if (event.key !== 'Tab') return
      const items = getFocusable(container)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div ref={containerRef} className={cn('w-full max-w-md rounded-3xl border border-white/10 bg-surface p-5 shadow-soft', className)}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
        <div className="space-y-4 text-sm text-text">{children}</div>
        {footer && <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
