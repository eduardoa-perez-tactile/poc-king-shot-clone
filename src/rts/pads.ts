import { BuildingPad } from '../config/levels'
import { Vec2 } from './types'

export const PAD_SIZE = { w: 72, h: 48 }

export const getPadRect = (pad: BuildingPad) => ({
  x: pad.x - PAD_SIZE.w / 2,
  y: pad.y - PAD_SIZE.h / 2,
  w: PAD_SIZE.w,
  h: PAD_SIZE.h
})

export const hitTestPad = (pad: BuildingPad, pos: Vec2) => {
  const rect = getPadRect(pad)
  return pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h
}
