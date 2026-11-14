import { createHash } from 'node:crypto'

export interface Seed {
  state: bigint
}

/**
 * Create a deterministic seed from a site slug.
 * Uses SHA-256, takes the first 16 hex chars as a 64-bit state.
 */
export function createSeed(slug: string): Seed {
  const hash = createHash('sha256').update(slug).digest('hex')
  const state = BigInt('0x' + hash.slice(0, 16))
  return { state }
}

/**
 * SplitMix64 — a fast, well-distributed PRNG.
 * Advances the seed state and returns a value in [0, 1).
 */
function nextFloat(seed: Seed, namespace?: string): number {
  // If namespace is provided, mix it into a derived state
  let s = seed.state
  if (namespace) {
    const nsHash = createHash('sha256').update(namespace).digest('hex')
    s = s ^ BigInt('0x' + nsHash.slice(0, 16))
  }

  // SplitMix64 step
  s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn
  let z = s
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn
  z = z ^ (z >> 31n)

  // Convert to float [0, 1)
  return Number(z & 0x1fffffffffffffn) / 0x20000000000000
}

/**
 * Pick one item from an array using the seed.
 * Optional namespace ensures different picks for different purposes.
 */
export function seedPick<T>(seed: Seed, items: T[], namespace?: string): T {
  const f = nextFloat(seed, namespace)
  const index = Math.floor(f * items.length)
  return items[index]
}

/**
 * Shuffle an array deterministically using the seed (Fisher-Yates).
 * Returns a new array; does not modify the original.
 */
export function seedShuffle<T>(
  seed: Seed,
  items: T[],
  namespace?: string
): T[] {
  const arr = [...items]

  // Generate a derived seed state for shuffling
  let s = seed.state
  if (namespace) {
    const nsHash = createHash('sha256').update(namespace).digest('hex')
    s = s ^ BigInt('0x' + nsHash.slice(0, 16))
  }

  // Fisher-Yates with SplitMix64 steps
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn
    let z = s
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn
    z = z ^ (z >> 31n)
    const f = Number(z & 0x1fffffffffffffn) / 0x20000000000000
    const j = Math.floor(f * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}
