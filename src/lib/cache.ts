/**
 * Cache simples em localStorage com TTL + camada em memória.
 * Entradas: { e: epoch ms de expiração (0 = nunca expira), v: valor }
 */
const PREFIX = 'ec1:'

interface Entry<T> {
  e: number
  v: T
}

const mem = new Map<string, Entry<unknown>>()

function now(): number {
  return Date.now()
}

export function cacheGet<T>(key: string): T | undefined {
  const k = PREFIX + key
  let entry = mem.get(k) as Entry<T> | undefined
  if (!entry) {
    try {
      const raw = localStorage.getItem(k)
      if (raw) {
        entry = JSON.parse(raw) as Entry<T>
        mem.set(k, entry)
      }
    } catch {
      return undefined
    }
  }
  if (!entry) return undefined
  if (entry.e !== 0 && entry.e < now()) {
    mem.delete(k)
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
    return undefined
  }
  return entry.v
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const k = PREFIX + key
  const entry: Entry<T> = { e: ttlMs === Infinity ? 0 : now() + ttlMs, v: value }
  mem.set(k, entry)
  const raw = JSON.stringify(entry)
  try {
    localStorage.setItem(k, raw)
  } catch {
    evictExpired()
    try {
      localStorage.setItem(k, raw)
    } catch {
      // sem espaço mesmo após limpeza: segue só com cache em memória
    }
  }
}

function evictExpired(): void {
  const t = now()
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k) ?? '') as Entry<unknown>
      if (entry.e !== 0 && entry.e < t) toRemove.push(k)
    } catch {
      toRemove.push(k)
    }
  }
  // se nada expirou, remove as entradas com expiração mais próxima para liberar espaço
  if (toRemove.length === 0) {
    const keys: { k: string; e: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      try {
        const entry = JSON.parse(localStorage.getItem(k) ?? '') as Entry<unknown>
        if (entry.e !== 0) keys.push({ k, e: entry.e })
      } catch {
        /* ignore */
      }
    }
    keys.sort((a, b) => a.e - b.e)
    for (const { k } of keys.slice(0, Math.ceil(keys.length / 2))) toRemove.push(k)
  }
  for (const k of toRemove) {
    localStorage.removeItem(k)
    mem.delete(k)
  }
}
