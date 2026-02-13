export interface SeededRng {
  nextFloat: () => number
  nextInt: (maxExclusive: number) => number
  pick: <T>(items: T[]) => T | undefined
}

const hashPart = (seed: number, part: string | number) => {
  const text = String(part)
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const deriveSeed = (baseSeed: number, ...parts: Array<string | number>) =>
  parts.reduce<number>((seed, part) => hashPart(seed, part), baseSeed >>> 0)

export const createSeededRng = (seed: number): SeededRng => {
  let state = seed >>> 0
  if (state === 0) state = 0x811c9dc5

  const nextFloat = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }

  const nextInt = (maxExclusive: number) => {
    if (maxExclusive <= 1) return 0
    return Math.floor(nextFloat() * maxExclusive)
  }

  const pick = <T>(items: T[]) => {
    if (items.length === 0) return undefined
    return items[nextInt(items.length)]
  }

  return {
    nextFloat,
    nextInt,
    pick
  }
}

export const pickWithoutReplacement = <T>(items: T[], count: number, rng: SeededRng) => {
  if (count <= 0 || items.length === 0) return [] as T[]
  const pool = items.slice()
  const picked: T[] = []
  const target = Math.min(count, pool.length)
  while (picked.length < target) {
    const index = rng.nextInt(pool.length)
    const [value] = pool.splice(index, 1)
    picked.push(value)
  }
  return picked
}
