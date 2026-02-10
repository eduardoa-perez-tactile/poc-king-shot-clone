export interface Pool<T> {
  acquire: () => T
  release: (item: T) => void
  size: () => number
}

export const createPool = <T>(factory: () => T, reset?: (item: T) => void): Pool<T> => {
  const items: T[] = []
  return {
    acquire: () => items.pop() ?? factory(),
    release: (item: T) => {
      reset?.(item)
      items.push(item)
    },
    size: () => items.length
  }
}
