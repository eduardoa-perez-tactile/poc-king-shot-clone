import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { useMotionSettings } from '../../hooks/useMotionSettings'

export const Panel: React.FC<{
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  isMobile: boolean
  children: React.ReactNode
}> = ({ title, subtitle, open, onToggle, isMobile, children }) => {
  const reduceMotion = useMotionSettings()
  const variants = isMobile
    ? {
        open: { y: 0, opacity: 1 },
        closed: { y: '100%', opacity: 0 }
      }
    : {
        open: { x: 0, opacity: 1 },
        closed: { x: '-90%', opacity: 0.4 }
      }

  return (
    <motion.aside
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={variants}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={[
        'pointer-events-auto z-20 flex max-h-[82vh] w-full flex-col rounded-3xl border border-white/10 bg-surface shadow-soft',
        isMobile ? 'fixed bottom-0 left-0 right-0 mx-auto max-w-full pb-[env(safe-area-inset-bottom)]' : 'max-w-[360px]'
      ].join(' ')}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-surface px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
    </motion.aside>
  )
}
