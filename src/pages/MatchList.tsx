import { useEffect, useMemo, useState } from 'react'
import { getOddsForDate, getWorldCupEvents } from '../api/sofascore'
import type { Odds1x2, SlimEvent } from '../api/types'
import { ErrorBox, Loading, OddsChips, TeamFlag } from '../components/common'
import { formatDateLong, formatTime, stageLabel, utcDateKey } from '../lib/format'
import { useAsync } from '../lib/useAsync'

function useListOdds(events: SlimEvent[] | null): Record<number, Odds1x2> {
  const [odds, setOdds] = useState<Record<number, Odds1x2>>({})
  const dateKeys = useMemo(() => {
    const upcoming = (events ?? []).filter((e) => e.statusType === 'notstarted')
    return [...new Set(upcoming.map((e) => utcDateKey(e.startTimestamp)))]
  }, [events])

  useEffect(() => {
    let alive = true
    for (const date of dateKeys) {
      getOddsForDate(date)
        .then((m) => {
          if (alive) setOdds((prev) => ({ ...m, ...prev }))
        })
        .catch(() => {
          /* odds são opcionais — ignora falhas */
        })
    }
    return () => {
      alive = false
    }
  }, [dateKeys])

  return odds
}

function MatchRow({ e, odds }: { e: SlimEvent; odds: Odds1x2 | null }) {
  const played = e.statusType === 'finished'
  const live = e.statusType === 'inprogress'
  return (
    <a className="match-row" href={`#/match/${e.id}`}>
      <span className="when">
        {live ? <span className="live-dot" title="Ao vivo" /> : formatTime(e.startTimestamp)}
      </span>
      <span className="stage muted">{stageLabel(e)}</span>
      <span className="teams">
        <span className="team home">
          <span className="team-name">{e.homeTeam.name}</span>
          <TeamFlag teamId={e.homeTeam.id} />
        </span>
        <span className={`score ${played || live ? 'played' : ''}`}>
          {played || live ? `${e.homeScore ?? ''} x ${e.awayScore ?? ''}` : 'x'}
        </span>
        <span className="team away">
          <TeamFlag teamId={e.awayTeam.id} />
          <span className="team-name">{e.awayTeam.name}</span>
        </span>
      </span>
      <span className="row-odds">
        {e.statusType === 'notstarted' ? <OddsChips odds={odds} compact /> : null}
      </span>
    </a>
  )
}

export function MatchList() {
  const { data: events, loading, error, reload } = useAsync(getWorldCupEvents, [])
  const odds = useListOdds(events)

  const groups = useMemo(() => {
    const map = new Map<string, { ts: number; events: SlimEvent[] }>()
    for (const e of events ?? []) {
      const d = new Date(e.startTimestamp * 1000)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const g = map.get(key) ?? { ts: e.startTimestamp, events: [] }
      g.events.push(e)
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => a.ts - b.ts)
  }, [events])

  if (loading) return <Loading label="Carregando jogos da Copa…" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!events?.length) {
    return <ErrorBox message="Nenhum jogo encontrado." onRetry={reload} />
  }

  return (
    <div className="match-list">
      {groups.map((g) => (
        <section key={g.ts} className="day-group">
          <h2>{formatDateLong(g.ts)}</h2>
          {g.events.map((e) => (
            <MatchRow key={e.id} e={e} odds={odds[e.id] ?? null} />
          ))}
        </section>
      ))}
    </div>
  )
}
