let map: Record<string, string> | null = null

export function initClassmap(classmap: Record<string, string>): void {
  map = classmap
}

export function cls(key: string): string {
  if (!map) {
    throw new Error('Classmap not initialized — call initClassmap() first')
  }
  if (!(key in map)) {
    throw new Error(`Unknown classmap key: "${key}"`)
  }
  return map[key]
}

export function resetClassmap(): void {
  map = null
}
