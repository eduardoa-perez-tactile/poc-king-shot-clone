import type { BuildingPad } from '../../config/levels'
import type { RunBuilding, RunState } from '../../run/types'
import type { CombatDefinition, CombatResult } from '../../rts/types'
import type { SelectionInfo } from '../store/uiStore'

export interface CanvasTelemetry {
  waveIndex: number
  waveCount: number
  enemiesRemaining: number
  hqHp: number
  hqMaxHp: number
  heroHp: number
  heroMaxHp: number
  qReadyIn: number
  eReadyIn: number
  camera: { x: number; y: number; zoom: number; viewW: number; viewH: number }
  playerUnits: Array<{ x: number; y: number; kind: 'hero' | 'unit' }>
  enemyUnits: Array<{ x: number; y: number }>
}

export interface CanvasHandle {
  panTo: (x: number, y: number) => void
  castAbility: (key: 'q' | 'e') => void
  resetDay: () => void
}

export interface CanvasLayerProps {
  combat: CombatDefinition
  run: RunState
  phase: 'build' | 'combat'
  resetOnBuild?: boolean
  buildingPads: BuildingPad[]
  buildings: RunBuilding[]
  inputBlocked?: boolean
  onPadClick: (padId: string) => void
  onPadBlocked: () => void
  onPadLocked?: (padId: string) => void
  onComplete: (result: CombatResult) => void
  onSelectionChange?: (selection: SelectionInfo) => void
  onTelemetry?: (telemetry: CanvasTelemetry) => void
  onPauseToggle?: () => void
  paused?: boolean
  selectedPadId?: string | null
  padUnlockLevels?: Record<string, number>
  showUnitLabels?: boolean
  onEliteWarning?: (message: string) => void
}
