import React from 'react'
import { motion } from 'framer-motion'
import { BUILDING_DEFS } from '../../../config/buildings'
import { IncomeBreakdown } from '../../../run/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Progress } from '../ui/Progress'
import { useMotionSettings } from '../../hooks/useMotionSettings'

export const DayEndModal: React.FC<{
  dayNumber: number
  breakdown: IncomeBreakdown
  progressLabel: string
  progressValue: number
  progressTarget: number
  nextEnemyTypes?: string[]
  ctaLabel?: string
  onNextDay: () => void
}> = ({ dayNumber, breakdown, progressLabel, progressValue, progressTarget, nextEnemyTypes, ctaLabel, onNextDay }) => {
  const reduceMotion = useMotionSettings()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-surface p-6 shadow-soft"
        data-testid="day-summary-modal"
      >
        <div className="space-y-2">
          <div className="text-2xl font-semibold text-text">Survived Day {dayNumber}</div>
          <div className="text-sm text-muted">Collect rewards, regroup, and prepare for the next wave.</div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm font-semibold text-text">Gold Breakdown</div>
            <div className="mt-3 space-y-2 text-xs text-muted">
              <div className="flex items-center justify-between">
                <span>Survival Reward</span>
                <span className="text-text">+{breakdown.reward}</span>
              </div>
              {breakdown.items.map((item, index) => (
                <div key={`${item.id}_${item.level}_${index}`} className="flex items-center justify-between">
                  <span>{BUILDING_DEFS[item.id].name} Lv {item.level}</span>
                  <span className="text-text">+{item.amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between font-semibold text-text">
                <span>Total</span>
                <span>+{breakdown.total}</span>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-text">Mission Progress</div>
            <div className="mt-3 text-xs text-muted">{progressLabel}</div>
            <div className="mt-3 space-y-2">
              <Progress value={progressValue} max={progressTarget} />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{Math.min(progressValue, progressTarget)}</span>
                <span>{progressTarget}</span>
              </div>
            </div>
          </Card>
        </div>
        {nextEnemyTypes && nextEnemyTypes.length > 0 && (
          <Card className="mt-4 p-4" data-testid="day-summary-next-enemies">
            <div className="text-sm font-semibold text-text">Next Wave Intel</div>
            <div className="mt-2 text-xs text-muted">Distinct enemy types expected next cycle:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextEnemyTypes.map((enemyName) => (
                <span
                  key={enemyName}
                  className="rounded-full border border-cyan-200/40 bg-cyan-950 px-2 py-1 text-[11px] text-cyan-100"
                >
                  {enemyName}
                </span>
              ))}
            </div>
          </Card>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="primary" size="lg" onClick={onNextDay}>
            {ctaLabel ?? 'Start Next Day'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
