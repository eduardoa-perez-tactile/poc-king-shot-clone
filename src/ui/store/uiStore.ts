import { useSyncExternalStore } from 'react'

export type SelectionInfo =
  | { kind: 'none' }
  | { kind: 'hero'; id: string; name: string; description: string; hp: number; maxHp: number; attack?: number; range?: number; speed?: number; cooldown?: number }
  | { kind: 'unit'; id: string; name: string; description: string; hp: number; maxHp: number }
  | { kind: 'multi'; units: Array<{ id: string; name: string; hp: number; maxHp: number }> }
  | { kind: 'stronghold' }

export interface ToastItem {
  id: string
  message: string
  variant?: 'default' | 'danger' | 'success'
  duration: number
  createdAt: number
}

export interface UiState {
  selectedPadId: string | null
  selection: SelectionInfo
  panelOpen: boolean
  settingsOpen: boolean
  pauseOpen: boolean
  toasts: ToastItem[]
  settings: {
    reducedMotion: boolean
    sound: boolean
    showUnitLabels: boolean
  }
}

type Listener = () => void

const listeners = new Set<Listener>()

let state: UiState = {
  selectedPadId: null,
  selection: { kind: 'none' },
  panelOpen: true,
  settingsOpen: false,
  pauseOpen: false,
  toasts: [],
  settings: {
    reducedMotion: false,
    sound: true,
    showUnitLabels: true
  }
}

const emit = () => {
  listeners.forEach((listener) => listener())
}

const setState = (next: UiState | ((prev: UiState) => UiState)) => {
  state = typeof next === 'function' ? next(state) : next
  emit()
}

export const uiActions = {
  setSelection: (selection: SelectionInfo) => setState((prev) => ({ ...prev, selection })),
  setSelectedPad: (padId: string | null) => setState((prev) => ({ ...prev, selectedPadId: padId })),
  setPanelOpen: (open: boolean) => setState((prev) => ({ ...prev, panelOpen: open })),
  openSettings: () => setState((prev) => ({ ...prev, settingsOpen: true })),
  closeSettings: () => setState((prev) => ({ ...prev, settingsOpen: false })),
  togglePause: (open?: boolean) =>
    setState((prev) => ({ ...prev, pauseOpen: typeof open === 'boolean' ? open : !prev.pauseOpen })),
  toggleSetting: (key: 'reducedMotion' | 'sound' | 'showUnitLabels') =>
    setState((prev) => ({ ...prev, settings: { ...prev.settings, [key]: !prev.settings[key] } })),
  pushToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`
    const createdAt = Date.now()
    const nextToast: ToastItem = { id, createdAt, ...toast }
    setState((prev) => ({ ...prev, toasts: [...prev.toasts, nextToast] }))
    window.setTimeout(() => {
      setState((prev) => ({ ...prev, toasts: prev.toasts.filter((item) => item.id !== id) }))
    }, toast.duration)
  },
  dismissToast: (id: string) => setState((prev) => ({ ...prev, toasts: prev.toasts.filter((item) => item.id !== id) }))
}

export const useUiStore = <T,>(selector: (state: UiState) => T) =>
  selector(
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      () => state,
      () => state
    )
  )
