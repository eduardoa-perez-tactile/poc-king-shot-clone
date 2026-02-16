import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWorldMapScene, type WorldMapSceneController } from '../WorldMapScene'
import { MissionSelectPanel } from './MissionSelectPanel'
import { WORLD_MISSIONS, WORLD_TILES } from '../worldMapData'
import {
  buildMissionPrerequisites,
  computeMissionStates,
  getFirstSelectableMissionId,
  loadWorldProgression,
  type MissionNodeState
} from '../worldProgression'

const missionById = new Map(WORLD_MISSIONS.map((mission) => [mission.id, mission]))

export const WorldMapMissionSelect: React.FC<{
  onBack: () => void
  onStart: (missionId: string, levelId: string) => void
  onReplayTutorial?: () => void
}> = ({ onBack, onStart, onReplayTutorial }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<WorldMapSceneController | null>(null)

  const [progression] = useState(() => loadWorldProgression())
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [lockedMessage, setLockedMessage] = useState<string | null>(null)

  const missionStates = useMemo(() => computeMissionStates(WORLD_MISSIONS, progression), [progression])
  const prerequisitesByMission = useMemo(() => buildMissionPrerequisites(WORLD_MISSIONS), [])

  const selectedMissionIdRef = useRef<string | null>(selectedMissionId)
  const missionStatesRef = useRef<Record<string, MissionNodeState>>(missionStates)

  useEffect(() => {
    missionStatesRef.current = missionStates
  }, [missionStates])

  useEffect(() => {
    selectedMissionIdRef.current = selectedMissionId
  }, [selectedMissionId])

  const lockedReasonByMission = useMemo(() => {
    const completed = new Set(progression.completedMissionIds)
    return WORLD_MISSIONS.reduce<Record<string, string | undefined>>((acc, mission) => {
      if (missionStates[mission.id] !== 'locked') {
        acc[mission.id] = undefined
        return acc
      }

      const missingPrerequisites = (prerequisitesByMission[mission.id] ?? []).filter((prerequisiteId) => !completed.has(prerequisiteId))
      if (missingPrerequisites.length === 0) {
        acc[mission.id] = 'Locked'
        return acc
      }

      const names = missingPrerequisites
        .map((prerequisiteId) => missionById.get(prerequisiteId)?.name ?? prerequisiteId)
        .join(', ')
      acc[mission.id] = `Complete ${names} to unlock.`
      return acc
    }, {})
  }, [missionStates, prerequisitesByMission, progression.completedMissionIds])

  const lockedReasonByMissionRef = useRef(lockedReasonByMission)
  useEffect(() => {
    lockedReasonByMissionRef.current = lockedReasonByMission
  }, [lockedReasonByMission])

  useEffect(() => {
    const fallbackMissionId = getFirstSelectableMissionId(WORLD_MISSIONS, missionStates)
    if (!fallbackMissionId) {
      setSelectedMissionId(null)
      return
    }

    if (!selectedMissionId || !missionById.has(selectedMissionId)) {
      setSelectedMissionId(fallbackMissionId)
    }
  }, [missionStates, selectedMissionId])

  const handleMissionPicked = useCallback((missionId: string) => {
    setSelectedMissionId(missionId)
    const state = missionStatesRef.current[missionId]
    if (state === 'locked') {
      setLockedMessage(lockedReasonByMissionRef.current[missionId] ?? 'Locked')
      return
    }
    setLockedMessage(null)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return

    const worldScene = createWorldMapScene({
      canvas,
      tiles: WORLD_TILES,
      missions: WORLD_MISSIONS,
      missionStates: missionStatesRef.current,
      selectedMissionId: selectedMissionIdRef.current,
      onMissionPicked: handleMissionPicked
    })
    sceneRef.current = worldScene

    const resize = () => {
      const width = Math.max(1, Math.floor(root.clientWidth))
      const height = Math.max(1, Math.floor(root.clientHeight))
      worldScene.resize(width, height)
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(resize)
    })
    observer.observe(root)
    resize()

    return () => {
      observer.disconnect()
      worldScene.dispose()
      sceneRef.current = null
    }
  }, [handleMissionPicked])

  useEffect(() => {
    sceneRef.current?.setMissionStates(missionStates)
  }, [missionStates])

  useEffect(() => {
    sceneRef.current?.setSelectedMission(selectedMissionId)
  }, [selectedMissionId])

  const selectedMission = selectedMissionId ? missionById.get(selectedMissionId) ?? null : null
  const selectedMissionState = selectedMission ? missionStates[selectedMission.id] ?? null : null
  const bestScore = selectedMission ? progression.bestScoreByMissionId[selectedMission.id] : undefined
  const lockedReason = selectedMission ? lockedReasonByMission[selectedMission.id] : undefined

  const handleStart = () => {
    if (!selectedMission || !selectedMissionState) return
    if (selectedMissionState === 'locked') {
      setLockedMessage(lockedReasonByMission[selectedMission.id] ?? 'Locked')
      return
    }
    onStart(selectedMission.id, selectedMission.levelId)
  }

  return (
    <div className="world-map-screen" ref={rootRef}>
      <canvas ref={canvasRef} className="world-map-canvas" aria-label="World mission map" />
      <div className="world-map-header">
        <h2>World Map</h2>
        <div className="muted">Select a mission node to deploy.</div>
      </div>
      <MissionSelectPanel
        mission={selectedMission}
        missionState={selectedMissionState}
        bestScore={bestScore}
        lockedReason={lockedReason}
        lockedMessage={lockedMessage}
        onStart={handleStart}
        onReplayTutorial={onReplayTutorial}
        onBack={onBack}
      />
    </div>
  )
}
