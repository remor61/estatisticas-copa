import { useEffect, useState } from 'react'
import { getEventPossession } from '../api/sofascore'
import type { Possession, SlimEvent } from '../api/types'

/**
 * Busca (com cache) a posse de bola de cada jogo encerrado da lista.
 * Retorna mapa id -> Possession | null (null = jogo sem estatísticas).
 * Ausência da chave significa "ainda carregando".
 */
export function usePossessions(events: SlimEvent[]): Record<number, Possession | null> {
  const [map, setMap] = useState<Record<number, Possession | null>>({})
  const key = events.map((e) => e.id).join(',')

  useEffect(() => {
    let alive = true
    for (const e of events) {
      if (e.statusType !== 'finished') continue
      getEventPossession(e.id)
        .then((p) => {
          if (alive) setMap((m) => (e.id in m ? m : { ...m, [e.id]: p }))
        })
        .catch(() => {
          if (alive) setMap((m) => (e.id in m ? m : { ...m, [e.id]: null }))
        })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return map
}
