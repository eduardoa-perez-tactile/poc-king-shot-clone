import React, { createContext, useContext } from 'react'
import { cn } from '../../lib/cn'

type TabsContextValue = {
  value: string
  onValueChange: (next: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export const Tabs: React.FC<{ value: string; onValueChange: (next: string) => void; className?: string; children: React.ReactNode }> = ({
  value,
  onValueChange,
  className,
  children
}) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={className}>{children}</div>
  </TabsContext.Provider>
)

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('inline-flex rounded-2xl border border-white/10 bg-surface/70 p-1', className)} {...props} />
)

export const TabsTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }> = ({
  className,
  value,
  ...props
}) => {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs')
  const active = ctx.value === value
  return (
    <button
      className={cn(
        'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
        active ? 'bg-accent text-slate-950 shadow-glow' : 'text-muted hover:text-text',
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  )
}

export const TabsContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { value: string }> = ({
  className,
  value,
  ...props
}) => {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabsContent must be used within Tabs')
  if (ctx.value !== value) return null
  return <div className={className} {...props} />
}
