import type { TutorialEvent, TutorialEventPayloadMap, TutorialEventType } from './tutorialTypes'

type Listener = (event: TutorialEvent) => void

class TutorialEventBus {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit<T extends TutorialEventType>(type: T, payload: TutorialEventPayloadMap[T]) {
    const event: TutorialEvent<T> = {
      type,
      payload,
      at: Date.now()
    }
    this.listeners.forEach((listener) => listener(event))
  }
}

export const tutorialEventBus = new TutorialEventBus()

export const emitTutorialEvent = <T extends TutorialEventType>(type: T, payload: TutorialEventPayloadMap[T]) => {
  tutorialEventBus.emit(type, payload)
}
