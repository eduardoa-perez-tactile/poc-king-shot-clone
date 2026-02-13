import React, { useEffect, useRef, useState } from 'react'
import type { LevelDefinition } from '../../../game/types/LevelDefinition'
import { createLevelPreviewScene, LevelPreviewOptions, type LevelPreviewSceneController } from './createLevelPreviewScene'

interface LevelPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  levelDraft: LevelDefinition
  revision: number
  onGenerated?: () => void
}

const DEFAULT_OPTIONS: Required<LevelPreviewOptions> = {
  showLabels: true,
  showObstacles: true,
  showSpawns: true,
  showPaths: false
}

const ROTATION_STEP_RADIANS = Math.PI / 10
const ZOOM_IN_FACTOR = 0.85
const ZOOM_OUT_FACTOR = 1.18

export const LevelPreviewModal: React.FC<LevelPreviewModalProps> = ({
  isOpen,
  onClose,
  levelDraft,
  revision,
  onGenerated
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<LevelPreviewSceneController | null>(null)
  const [options, setOptions] = useState<Required<LevelPreviewOptions>>(DEFAULT_OPTIONS)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setOptions(DEFAULT_OPTIONS)
    setError(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let observer: ResizeObserver | null = null

    try {
      const preview = createLevelPreviewScene({
        canvas,
        levelConfig: levelDraft,
        options: DEFAULT_OPTIONS
      })
      previewRef.current = preview
      preview.engine.runRenderLoop(() => {
        preview.scene.render()
      })
      onGenerated?.()

      observer = new ResizeObserver(() => {
        preview.engine.resize()
      })
      observer.observe(container)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create preview scene.')
    }

    return () => {
      if (observer) observer.disconnect()
      const preview = previewRef.current
      if (preview) {
        preview.dispose()
        previewRef.current = null
      }
    }
  }, [isOpen])

  const runRegenerate = (nextOptions: LevelPreviewOptions = options) => {
    const preview = previewRef.current
    if (!preview) return
    try {
      preview.regenerate(levelDraft, nextOptions)
      setError(null)
      onGenerated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate preview.')
    }
  }

  const toggleOption = (key: keyof LevelPreviewOptions) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      runRegenerate(next)
      return next
    })
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop level-preview-backdrop" role="dialog" aria-modal="true" aria-label="Map preview">
      <div className="level-preview-modal">
        <div className="modal-header">
          <div>
            <h3>Map Preview</h3>
            <div className="muted">Draft revision: {revision}</div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="level-preview-controls">
          <button className="btn primary" onClick={() => runRegenerate()}>Regenerate</button>
          <button className="btn" onClick={() => previewRef.current?.fitToBounds()}>Fit</button>
          <button className="btn" onClick={() => previewRef.current?.rotateY(-ROTATION_STEP_RADIANS)}>Rotate Left</button>
          <button className="btn" onClick={() => previewRef.current?.rotateY(ROTATION_STEP_RADIANS)}>Rotate Right</button>
          <button className="btn" onClick={() => previewRef.current?.zoom(ZOOM_IN_FACTOR)}>Zoom In</button>
          <button className="btn" onClick={() => previewRef.current?.zoom(ZOOM_OUT_FACTOR)}>Zoom Out</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <label className="level-preview-toggle">
            <input
              type="checkbox"
              checked={options.showLabels}
              onChange={() => toggleOption('showLabels')}
            />
            Show Labels
          </label>
          <label className="level-preview-toggle">
            <input
              type="checkbox"
              checked={options.showObstacles}
              onChange={() => toggleOption('showObstacles')}
            />
            Show Obstacles
          </label>
          <label className="level-preview-toggle">
            <input
              type="checkbox"
              checked={options.showSpawns}
              onChange={() => toggleOption('showSpawns')}
            />
            Show Spawn Indicators
          </label>
          <label className="level-preview-toggle">
            <input
              type="checkbox"
              checked={options.showPaths}
              onChange={() => toggleOption('showPaths')}
            />
            Show Paths
          </label>
        </div>

        {error && <div className="muted">{error}</div>}

        <div ref={containerRef} className="level-preview-canvas-wrap">
          <canvas ref={canvasRef} className="level-preview-canvas" />
        </div>
      </div>
    </div>
  )
}
