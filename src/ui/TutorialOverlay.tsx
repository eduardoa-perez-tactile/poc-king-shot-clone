import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './components/ui/Button'
import type { TutorialManagerSnapshot, TutorialUiAnchor, TutorialWorldAnchor } from '../tutorial/tutorialTypes'

type ScreenPoint = { x: number; y: number }

type TutorialOverlayProps = {
  snapshot: TutorialManagerSnapshot | null
  resolveWorldPoint: (anchor: TutorialWorldAnchor) => { x: number; y: number } | null
  projectWorldToScreen: (point: { x: number; y: number }) => ScreenPoint | null
  onNext: () => void
  onSkip: () => void
}

const queryAnchorElement = (anchor: TutorialUiAnchor) => {
  if (anchor.selector) {
    return document.querySelector(anchor.selector) as HTMLElement | null
  }
  if (anchor.testId) {
    return document.querySelector(`[data-testid="${anchor.testId}"]`) as HTMLElement | null
  }
  return null
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  snapshot,
  resolveWorldPoint,
  projectWorldToScreen,
  onNext,
  onSkip
}) => {
  const step = snapshot?.step ?? null
  const [uiAnchorRect, setUiAnchorRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    setUiAnchorRect(null)
    if (!step || step.anchor?.type !== 'ui') return

    const updateRect = () => {
      const target = queryAnchorElement(step.anchor as TutorialUiAnchor)
      setUiAnchorRect(target ? target.getBoundingClientRect() : null)
    }

    updateRect()
    const intervalId = window.setInterval(updateRect, 180)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [step])

  const worldAnchorScreenPoint = useMemo(() => {
    if (!step || step.anchor?.type !== 'world') return null
    const worldPoint = resolveWorldPoint(step.anchor)
    if (!worldPoint) return null
    return projectWorldToScreen(worldPoint)
  }, [projectWorldToScreen, resolveWorldPoint, step])

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (uiAnchorRect) {
      const top = Math.min(window.innerHeight - 220, uiAnchorRect.bottom + 12)
      const left = Math.max(12, Math.min(window.innerWidth - 360, uiAnchorRect.left))
      return {
        top,
        left
      }
    }

    if (worldAnchorScreenPoint) {
      const top = Math.max(16, Math.min(window.innerHeight - 220, worldAnchorScreenPoint.y + 30))
      const left = Math.max(12, Math.min(window.innerWidth - 360, worldAnchorScreenPoint.x - 150))
      return {
        top,
        left
      }
    }

    return {
      left: '50%',
      bottom: 20,
      transform: 'translateX(-50%)'
    }
  }, [uiAnchorRect, worldAnchorScreenPoint])

  if (!snapshot || !snapshot.active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" data-testid="tutorial-overlay">
      {snapshot.blockInput && (
        <div className="pointer-events-auto absolute inset-0 bg-black/30" />
      )}

      {uiAnchorRect && (
        <div
          className="pointer-events-none absolute z-[61] rounded-xl border-2 border-cyan-300"
          style={{
            left: Math.max(0, uiAnchorRect.left - 6),
            top: Math.max(0, uiAnchorRect.top - 6),
            width: uiAnchorRect.width + 12,
            height: uiAnchorRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.55)'
          }}
        />
      )}

      {worldAnchorScreenPoint && (
        <div
          className="pointer-events-none absolute z-[61] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-cyan-300/10"
          style={{
            left: worldAnchorScreenPoint.x,
            top: worldAnchorScreenPoint.y,
            boxShadow: '0 0 24px rgba(34, 211, 238, 0.45)'
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute z-[62] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/15 bg-surface/95 p-4 shadow-soft"
        style={cardStyle}
      >
        {step ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-cyan-200">Tutorial</div>
              <Button variant="ghost" size="sm" onClick={onSkip} data-testid="tutorial-skip-button">
                Skip
              </Button>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-text">{step.text.title}</h3>
            <p className="mt-2 text-sm text-muted">{step.text.body}</p>
            <div className="mt-4 flex justify-end gap-2">
              {!snapshot.canManualAdvance && (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Skip Tutorial
                </Button>
              )}
              {snapshot.canManualAdvance && (
                <Button variant="primary" size="sm" onClick={onNext} data-testid="tutorial-next-button">
                  Next
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-cyan-200">Tutorial</div>
              <Button variant="ghost" size="sm" onClick={onSkip} data-testid="tutorial-skip-button">
                Skip
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">Follow the objective. Tutorial prompts will appear when the next phase starts.</p>
          </>
        )}
      </div>
    </div>
  )
}
