import { emitTutorialEvent, tutorialEventBus } from './tutorialEventBus'
import { setTutorialCompleted } from './tutorialProgress'
import type {
  TutorialEvent,
  TutorialEventCondition,
  TutorialManagerSnapshot,
  TutorialRuntimePhase,
  TutorialScript,
  TutorialStepDefinition,
  TutorialStepPhase
} from './tutorialTypes'

const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)

const clampAutoAdvanceDelay = (value: number | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.max(0, Math.min(1000, Math.floor(value)))
}

const getStepPhases = (phase: TutorialStepDefinition['phase']): TutorialStepPhase[] =>
  Array.isArray(phase) ? phase : [phase]

const getRuntimeTutorialPhases = (phase: TutorialRuntimePhase): TutorialStepPhase[] => {
  if (phase === 'build') return ['MAP', 'BUILD']
  if (phase === 'battle_cry' || phase === 'combat') return ['BATTLE']
  return ['SUMMARY']
}

const doesPhaseMatch = (step: TutorialStepDefinition, runtimePhase: TutorialRuntimePhase) => {
  const stepPhases = getStepPhases(step.phase)
  if (stepPhases.includes('ANY')) return true
  const active = getRuntimeTutorialPhases(runtimePhase)
  return stepPhases.some((phase) => active.includes(phase))
}

const eventMatches = (event: TutorialEvent, condition: TutorialEventCondition) => {
  if (event.type !== condition.event) return false
  const expected = condition.match
  if (!expected) return true
  const payload = event.payload as Record<string, unknown>
  return Object.entries(expected).every(([key, value]) => payload[key] === value)
}

const isTruthyStep = (step: TutorialStepDefinition | undefined): step is TutorialStepDefinition => Boolean(step)

export class TutorialManager {
  private readonly script: TutorialScript
  private readonly debug: boolean
  private readonly eventHistory: TutorialEvent[] = []
  private phase: TutorialRuntimePhase = 'build'
  private stepIndex = 0
  private completed = false
  private skipped = false
  private listeners = new Set<(snapshot: TutorialManagerSnapshot) => void>()
  private unsubscribeBus: (() => void) | null = null
  private autoCompleteTimer: number | null = null
  private advanceTimer: number | null = null

  constructor(script: TutorialScript, options?: { initialPhase?: TutorialRuntimePhase; debug?: boolean }) {
    this.script = script.filter(isTruthyStep)
    this.phase = options?.initialPhase ?? 'build'
    this.debug = options?.debug ?? isDev

    this.unsubscribeBus = tutorialEventBus.subscribe((event) => {
      this.pushEvent(event)
      if (event.type === 'PHASE_CHANGED') {
        this.phase = event.payload.phase
      }
      this.tryCompleteCurrentStep()
      this.armStepAutoComplete()
      this.emit()
    })

    this.armStepAutoComplete()
  }

  dispose() {
    this.clearTimers()
    this.unsubscribeBus?.()
    this.unsubscribeBus = null
    this.listeners.clear()
  }

  subscribe(listener: (snapshot: TutorialManagerSnapshot) => void) {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): TutorialManagerSnapshot {
    const rawStep = this.script[this.stepIndex] ?? null
    const isVisible = Boolean(rawStep && doesPhaseMatch(rawStep, this.phase))
    const step = isVisible ? rawStep : null
    const canManualAdvance = Boolean(step && this.canManualAdvance(step))
    const blockInput = Boolean(step?.gating?.blockInput)

    return {
      active: !this.completed,
      completed: this.completed,
      skipped: this.skipped,
      stepIndex: this.stepIndex,
      step,
      canManualAdvance,
      blockInput
    }
  }

  next() {
    const step = this.getCurrentStep()
    if (!step || !this.canManualAdvance(step)) return
    this.advanceStep()
  }

  skip() {
    if (this.completed) return
    this.skipped = true
    this.completed = true
    setTutorialCompleted(true, { skipped: true })
    emitTutorialEvent('TUTORIAL_SKIPPED', {})
    this.clearTimers()
    this.emit()
  }

  private getCurrentStep() {
    const step = this.script[this.stepIndex]
    if (!step) return null
    if (!doesPhaseMatch(step, this.phase)) return null
    return step
  }

  private canManualAdvance(step: TutorialStepDefinition) {
    const gating = step.gating
    if (!gating) return true
    if (!gating.required) return true
    return Boolean(gating.allowManualAdvance)
  }

  private pushEvent(event: TutorialEvent) {
    this.eventHistory.push(event)
    if (this.eventHistory.length > 250) {
      this.eventHistory.splice(0, this.eventHistory.length - 250)
    }
    if (this.debug) {
      console.debug(`[Tutorial] Event: ${event.type}`, event.payload)
    }
  }

  private conditionSatisfied(condition: TutorialEventCondition) {
    return this.eventHistory.some((event) => eventMatches(event, condition))
  }

  private stepCompletionSatisfied(step: TutorialStepDefinition) {
    const completion = step.completeWhen
    if (!completion) return false

    if (completion.all && completion.all.length > 0) {
      const allSatisfied = completion.all.every((condition) => this.conditionSatisfied(condition))
      if (!allSatisfied) return false
    }

    if (completion.any && completion.any.length > 0) {
      const anySatisfied = completion.any.some((condition) => this.conditionSatisfied(condition))
      if (!anySatisfied) return false
    }

    if ((!completion.all || completion.all.length === 0) && (!completion.any || completion.any.length === 0)) {
      return false
    }

    return true
  }

  private tryCompleteCurrentStep() {
    const step = this.getCurrentStep()
    if (!step) return
    if (!this.stepCompletionSatisfied(step)) return
    this.completeCurrentStep(step)
  }

  private completeCurrentStep(step: TutorialStepDefinition) {
    this.clearAutoCompleteTimer()
    const delay = clampAutoAdvanceDelay(step.autoAdvanceAfterMs ?? 350)
    if (this.debug) {
      console.debug(`[Tutorial] Step complete: ${step.id}`)
    }

    if (delay > 0) {
      if (this.advanceTimer) {
        window.clearTimeout(this.advanceTimer)
      }
      this.advanceTimer = window.setTimeout(() => {
        this.advanceTimer = null
        this.advanceStep()
      }, delay)
      return
    }

    this.advanceStep()
  }

  private advanceStep() {
    if (this.completed) return
    const nextIndex = this.stepIndex + 1
    if (nextIndex >= this.script.length) {
      this.completed = true
      this.clearTimers()
      setTutorialCompleted(true)
      emitTutorialEvent('TUTORIAL_COMPLETED', {})
      if (this.debug) {
        console.debug('[Tutorial] Completed')
      }
      this.emit()
      return
    }

    this.stepIndex = nextIndex
    this.armStepAutoComplete()
    this.tryCompleteCurrentStep()
    this.emit()
    const nextStep = this.script[this.stepIndex]
    if (this.debug && nextStep) {
      console.debug(`[Tutorial] Step start: ${nextStep.id}`)
    }
  }

  private armStepAutoComplete() {
    this.clearAutoCompleteTimer()
    const step = this.getCurrentStep()
    const autoAfterMs = step?.completeWhen?.autoAfterMs
    if (!step || typeof autoAfterMs !== 'number' || autoAfterMs <= 0) return
    this.autoCompleteTimer = window.setTimeout(() => {
      this.autoCompleteTimer = null
      if (this.completed) return
      const current = this.getCurrentStep()
      if (!current || current.id !== step.id) return
      this.completeCurrentStep(current)
    }, Math.max(10, Math.floor(autoAfterMs)))
  }

  private clearAutoCompleteTimer() {
    if (this.autoCompleteTimer) {
      window.clearTimeout(this.autoCompleteTimer)
      this.autoCompleteTimer = null
    }
  }

  private clearTimers() {
    this.clearAutoCompleteTimer()
    if (this.advanceTimer) {
      window.clearTimeout(this.advanceTimer)
      this.advanceTimer = null
    }
  }

  private emit() {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}
