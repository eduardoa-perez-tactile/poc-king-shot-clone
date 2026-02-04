import { useReducedMotion } from 'framer-motion'
import { useUiStore } from '../store/uiStore'

export const useMotionSettings = () => {
  const reducedMotionSetting = useUiStore((state) => state.settings.reducedMotion)
  const systemReduced = useReducedMotion()
  return reducedMotionSetting || systemReduced
}
