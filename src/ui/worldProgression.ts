import type { MissionNodeDef } from './worldMapData'

const STORAGE_KEY = 'roguelike3d-world-map-progression-v1'

export type MissionNodeState = 'locked' | 'available' | 'completed'

export type WorldProgressionSave = {
  completedMissionIds: string[]
  bestScoreByMissionId: Record<string, number>
}

export type MissionResult = {
  missionId: string
  completed: boolean
  score: number
}

const EMPTY_PROGRESSION: WorldProgressionSave = {
  completedMissionIds: [],
  bestScoreByMissionId: {}
}

const sanitizeScoreMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, raw]) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return acc
    acc[key] = Math.max(0, Math.round(raw))
    return acc
  }, {})
}

export const loadWorldProgression = (): WorldProgressionSave => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...EMPTY_PROGRESSION }
  try {
    const parsed = JSON.parse(raw) as Partial<WorldProgressionSave>
    const completedMissionIds = Array.isArray(parsed.completedMissionIds)
      ? parsed.completedMissionIds.filter((entry): entry is string => typeof entry === 'string')
      : []

    return {
      completedMissionIds: Array.from(new Set(completedMissionIds)),
      bestScoreByMissionId: sanitizeScoreMap(parsed.bestScoreByMissionId)
    }
  } catch (error) {
    console.warn('Failed to load world map progression, using defaults.', error)
    return { ...EMPTY_PROGRESSION }
  }
}

export const saveWorldProgression = (save: WorldProgressionSave) => {
  const payload: WorldProgressionSave = {
    completedMissionIds: Array.from(new Set(save.completedMissionIds)),
    bestScoreByMissionId: { ...save.bestScoreByMissionId }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const clearWorldProgression = () => {
  localStorage.removeItem(STORAGE_KEY)
}

export const buildMissionPrerequisites = (missions: MissionNodeDef[]) => {
  const prerequisites: Record<string, string[]> = missions.reduce<Record<string, string[]>>((acc, mission) => {
    acc[mission.id] = []
    return acc
  }, {})

  missions.forEach((mission) => {
    mission.unlocks.forEach((nextId) => {
      if (!prerequisites[nextId]) prerequisites[nextId] = []
      prerequisites[nextId].push(mission.id)
    })
  })

  Object.keys(prerequisites).forEach((missionId) => {
    prerequisites[missionId] = Array.from(new Set(prerequisites[missionId]))
  })

  return prerequisites
}

export const computeMissionStates = (
  missions: MissionNodeDef[],
  progression: WorldProgressionSave
): Record<string, MissionNodeState> => {
  const completed = new Set(progression.completedMissionIds)
  const prerequisites = buildMissionPrerequisites(missions)

  return missions.reduce<Record<string, MissionNodeState>>((acc, mission) => {
    if (completed.has(mission.id)) {
      acc[mission.id] = 'completed'
      return acc
    }

    const required = prerequisites[mission.id] ?? []
    const hasNoRequirements = mission.start === true || required.length === 0
    const unlockedByCompletion = required.every((requiredId) => completed.has(requiredId))
    acc[mission.id] = hasNoRequirements || unlockedByCompletion ? 'available' : 'locked'
    return acc
  }, {})
}

export const getFirstSelectableMissionId = (
  missions: MissionNodeDef[],
  missionStates: Record<string, MissionNodeState>
) => missions.find((mission) => missionStates[mission.id] !== 'locked')?.id ?? missions[0]?.id ?? null

export const applyMissionResult = (
  progression: WorldProgressionSave,
  missions: MissionNodeDef[],
  result: MissionResult
): WorldProgressionSave => {
  const missionExists = missions.some((mission) => mission.id === result.missionId)
  if (!missionExists) return progression

  const nextCompleted = new Set(progression.completedMissionIds)
  const nextBest = { ...progression.bestScoreByMissionId }

  if (result.completed) {
    nextCompleted.add(result.missionId)
    const score = Math.max(0, Math.round(result.score))
    nextBest[result.missionId] = Math.max(nextBest[result.missionId] ?? 0, score)
  }

  return {
    completedMissionIds: Array.from(nextCompleted),
    bestScoreByMissionId: nextBest
  }
}
