import React from 'react'
import { renderMode } from '../../config/rendering'
import { CanvasLayer2D } from './CanvasLayer2D'
import { CanvasLayer3D } from './CanvasLayer3D'
import type { CanvasHandle, CanvasLayerProps } from './CanvasLayer.types'

export type { CanvasHandle, CanvasTelemetry, CanvasLayerProps } from './CanvasLayer.types'

export const CanvasLayer = React.memo(
  React.forwardRef<CanvasHandle, CanvasLayerProps>((props, ref) => {
    if (renderMode === '2d') {
      return <CanvasLayer2D {...props} ref={ref} />
    }
    return <CanvasLayer3D {...props} ref={ref} />
  })
)

CanvasLayer.displayName = 'CanvasLayer'
