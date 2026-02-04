import React, { useEffect, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'
import { useMotionSettings } from '../../hooks/useMotionSettings'

export const AnimatedNumber: React.FC<{ value: number; format?: (value: number) => string; className?: string }> = ({
  value,
  format = (val) => Math.round(val).toLocaleString(),
  className
}) => {
  const motionValue = useMotionValue(value)
  const reduceMotion = useMotionSettings()
  const [display, setDisplay] = useState(format(value))

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value)
      setDisplay(format(value))
      return
    }
    const controls = animate(motionValue, value, {
      duration: 0.35,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(format(latest))
    })
    return () => controls.stop()
  }, [value, format, motionValue, reduceMotion])

  return <span className={className}>{display}</span>
}
