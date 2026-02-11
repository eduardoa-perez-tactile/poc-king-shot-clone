const TAGS_BLOCKING_GAMEPLAY = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export const isGameplayKeyboardBlockedByFocus = () => {
  const active = document.activeElement
  if (!active) return false
  const element = active as HTMLElement
  if (element.isContentEditable) return true
  return TAGS_BLOCKING_GAMEPLAY.has(element.tagName)
}
