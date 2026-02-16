export type TutorialStepPhase = 'ANY' | 'MAP' | 'BUILD' | 'BATTLE' | 'SUMMARY'

export type TutorialRuntimePhase = 'build' | 'battle_cry' | 'combat' | 'day_end' | 'win' | 'lose'

export interface TutorialEventPayloadMap {
  PHASE_CHANGED: { phase: TutorialRuntimePhase }
  UI_BATTLE_CRY_CLICKED: Record<string, never>
  HERO_MOVED: { dx: number; dy: number }
  UNIT_RECALL_USED: Record<string, never>
  PAD_SELECTED: { padId: string }
  STRONGHOLD_SELECTED: Record<string, never>
  BUILDING_BUILT: { padId: string; buildingType: string }
  BUILDING_UPGRADED: { padId: string; buildingId: string; level: number }
  TOWER_PLACED: { padId: string }
  TOWER_UPGRADED: { padId: string; level: number }
  WALL_PLACED: { padId: string }
  WAVE_SPAWN_INDICATOR_SHOWN: { borders: string[] }
  ENEMY_WAVE_STARTED: { waveIndex: number }
  DAY_SUMMARY_OPENED: { dayNumber: number }
  NEXT_WAVE_ENEMY_TYPES_SHOWN: { enemyTypes: string[] }
  TOWER_ATTACKED: { sourceId?: string; targetId?: string }
  TUTORIAL_SKIPPED: Record<string, never>
  TUTORIAL_COMPLETED: Record<string, never>
}

export type TutorialEventType = keyof TutorialEventPayloadMap

export interface TutorialEvent<T extends TutorialEventType = TutorialEventType> {
  type: T
  payload: TutorialEventPayloadMap[T]
  at: number
}

export interface TutorialUiAnchor {
  type: 'ui'
  testId?: string
  selector?: string
}

export interface TutorialWorldAnchor {
  type: 'world'
  target: 'stronghold' | 'hero' | 'pad'
  padId?: string
}

export interface TutorialNoAnchor {
  type: 'none'
}

export type TutorialAnchor = TutorialUiAnchor | TutorialWorldAnchor | TutorialNoAnchor

export interface TutorialEventCondition {
  event: TutorialEventType
  match?: Record<string, string | number | boolean>
}

export interface TutorialCompletionCondition {
  any?: TutorialEventCondition[]
  all?: TutorialEventCondition[]
  autoAfterMs?: number
}

export interface TutorialStepGating {
  required: boolean
  blockInput?: boolean
  allowManualAdvance?: boolean
}

export interface TutorialTextContent {
  title: string
  body: string
}

export interface TutorialStepDefinition {
  id: string
  phase: TutorialStepPhase | TutorialStepPhase[]
  text: TutorialTextContent
  anchor?: TutorialAnchor
  gating?: TutorialStepGating
  completeWhen?: TutorialCompletionCondition
  autoAdvanceAfterMs?: number
}

export type TutorialScript = TutorialStepDefinition[]

export interface TutorialManagerSnapshot {
  active: boolean
  completed: boolean
  skipped: boolean
  stepIndex: number
  step: TutorialStepDefinition | null
  canManualAdvance: boolean
  blockInput: boolean
}
