import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Carrega dados assíncronos com estados de loading/erro e recarga manual. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    const mySeq = ++seq.current
    setLoading(true)
    setError(null)
    load().then(
      (v) => {
        if (seq.current === mySeq) {
          setData(v)
          setLoading(false)
        }
      },
      (err: unknown) => {
        if (seq.current === mySeq) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}
