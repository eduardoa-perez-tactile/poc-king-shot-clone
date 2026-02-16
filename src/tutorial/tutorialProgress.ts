const STORAGE_KEY = 'roguelike3d-tutorial-progress-v1'

interface TutorialProgressFile {
  completed: boolean
  completedAt?: string
  skipped?: boolean
}

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const readFile = (): TutorialProgressFile => {
  if (!isBrowser()) return { completed: false }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { completed: false }
  try {
    const parsed = JSON.parse(raw) as Partial<TutorialProgressFile>
    return {
      completed: Boolean(parsed.completed),
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
      skipped: Boolean(parsed.skipped)
    }
  } catch {
    return { completed: false }
  }
}

const writeFile = (file: TutorialProgressFile) => {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
}

export const isTutorialCompleted = () => readFile().completed

export const setTutorialCompleted = (completed: boolean, options?: { skipped?: boolean }) => {
  if (!completed) {
    writeFile({ completed: false })
    return
  }
  writeFile({
    completed: true,
    completedAt: new Date().toISOString(),
    skipped: options?.skipped ?? false
  })
}

export const getTutorialStorageKey = () => STORAGE_KEY
