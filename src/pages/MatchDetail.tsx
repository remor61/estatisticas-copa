import { useMemo, useState } from 'react'
import {
  getEvent,
  getEventOdds,
  getFifaRanking,
  getHeadToHead,
  getTeamRecentEvents,
  getWorldCup2022Events,
  getWorldCupEvents,
  SINCE_TS,
  sofascoreMatchUrl,
} from '../api/sofascore'
import type { FifaRanking, SlimEvent, Team } from '../api/types'
import { ErrorBox, Loading, OddsChips, SectionCard, TeamFlag } from '../components/common'
import { FormTable } from '../components/FormTable'
import { formatDateLong, formatTime, goalsAgainst, goalsFor, resultFor, stageLabel } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { usePossessions } from '../lib/usePossessions'

function TeamFormSummary({ team }: { team: Team }) {
  const { data, loading } = useAsync(() => getTeamRecentEvents(team.id), [team.id])
  const last10 = useMemo(() => (data ?? []).slice(0, 10), [data])

  const stats = useMemo(() => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, count = 0
    for (const e of last10) {
      const r = resultFor(e, team.id)
      if (r === 'V') w++
      else if (r === 'E') d++
      else if (r === 'D') l++
      const g = goalsFor(e, team.id)
      const gc = goalsAgainst(e, team.id)
      if (g != null && gc != null) { gf += g; ga += gc; count++ }
    }
    return { w, d, l, n: last10.length, gf: count ? gf / count : null, ga: count ? ga / count : null }
  }, [last10, team.id])

  const fmt = (v: number | null) => v == null ? '–' : v.toFixed(1).replace('.', ',')

  if (loading) return <div className="form-summary"><span className="muted">carregando…</span></div>
  if (!last10.length) return null

  return (
    <div className="form-summary">
      <TeamFlag teamId={team.id} size={16} />
      <span className="form-team">{team.shortName ?? team.nameCode ?? team.name}</span>
      <span className="muted">últ.&thinsp;{stats.n}:</span>
      <span className="fs-w">{stats.w}V</span>
      <span className="fs-d">{stats.d}E</span>
      <span className="fs-l">{stats.l}D</span>
      <span className="muted fs-avg">{fmt(stats.gf)}&thinsp;/&thinsp;{fmt(stats.ga)}&thinsp;g</span>
    </div>
  )
}

function HeadToHead({ event, ranking }: { event: SlimEvent; ranking: FifaRanking | null }) {
  const { data, loading, error, reload } = useAsync(
    () => getHeadToHead(event.customId),
    [event.customId],
  )
  const h2h = useMemo(
    () => (data ?? []).filter((e) => e.id !== event.id).slice(0, 10),
    [data, event.id],
  )
  const possessions = usePossessions(h2h)

  return (
    <SectionCard title={`Confrontos diretos · ${event.homeTeam.name} x ${event.awayTeam.name}`}>
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!loading && !error && (
        <FormTable
          events={h2h}
          teamId={event.homeTeam.id}
          possessions={possessions}
          rankByTeamId={ranking?.byTeamId}
          emptyMessage="Nenhum confronto anterior entre as duas seleções."
        />
      )}
      {h2h.length > 0 && (
        <p className="muted note">Placar, resultado e posse do ponto de vista de {event.homeTeam.name}.</p>
      )}
    </SectionCard>
  )
}

function TeamPanel({
  team,
  adversary,
  ranking,
  windowN,
}: {
  team: Team
  adversary: Team
  ranking: FifaRanking | null
  windowN: number
}) {
  const recent = useAsync(() => getTeamRecentEvents(team.id), [team.id])
  const wc22 = useAsync(getWorldCup2022Events, [])

  const last10 = useMemo(() => (recent.data ?? []).slice(0, 10), [recent.data])

  const neighbors = useMemo(() => {
    if (!ranking) return []
    const advRank = ranking.byTeamId[adversary.id]
    if (advRank == null) return []
    const since2024 = (recent.data ?? []).filter((e) => e.startTimestamp >= SINCE_TS)
    const inWc22 = (wc22.data ?? []).filter(
      (e) => e.homeTeam.id === team.id || e.awayTeam.id === team.id,
    )
    const seen = new Set<number>()
    const out: SlimEvent[] = []
    for (const e of [...since2024, ...inWc22]) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const opp = e.homeTeam.id === team.id ? e.awayTeam : e.homeTeam
      if (opp.id === adversary.id) continue // confrontos diretos têm seção própria
      const oppRank = ranking.byTeamId[opp.id]
      if (oppRank == null || Math.abs(oppRank - advRank) > windowN) continue
      out.push(e)
    }
    return out.sort((a, b) => b.startTimestamp - a.startTimestamp)
  }, [ranking, recent.data, wc22.data, team.id, adversary.id, windowN])

  const possLast10 = usePossessions(last10)
  const possNeighbors = usePossessions(neighbors)

  const teamRank = ranking?.byTeamId[team.id]
  const advRank = ranking?.byTeamId[adversary.id]

  return (
    <div className="team-panel">
      <header className="panel-head">
        <TeamFlag teamId={team.id} size={28} />
        <h2>{team.name}</h2>
        {teamRank != null && <span className="muted">#{teamRank} no ranking FIFA</span>}
      </header>

      <SectionCard title="Últimos 10 jogos">
        {recent.loading && <Loading />}
        {recent.error && <ErrorBox message={recent.error} onRetry={recent.reload} />}
        {!recent.loading && !recent.error && (
          <FormTable
            events={last10}
            teamId={team.id}
            possessions={possLast10}
            rankByTeamId={ranking?.byTeamId}
            showAverages
            emptyMessage="Nenhum jogo recente encontrado."
          />
        )}
      </SectionCard>

      <SectionCard title={`Contra times do nível de ${adversary.name}`}>
        <p className="muted note">
          Jogos de {team.name} desde jan/2024 ou na Copa de 2022 contra seleções até {windowN}{' '}
          posições acima/abaixo de {adversary.name}
          {advRank != null ? ` (#${advRank})` : ''} no ranking FIFA.
        </p>
        {(recent.loading || wc22.loading) && <Loading />}
        {recent.error && <ErrorBox message={recent.error} onRetry={recent.reload} />}
        {!recent.loading && !wc22.loading && !recent.error && (
          <FormTable
            events={neighbors}
            teamId={team.id}
            possessions={possNeighbors}
            rankByTeamId={ranking?.byTeamId}
            emptyMessage="Nenhum jogo nesse recorte. Aumente a janela do ranking (±)."
          />
        )}
      </SectionCard>
    </div>
  )
}

export function MatchDetail({ eventId }: { eventId: number }) {
  const [windowN, setWindowN] = useState(5)

  const eventState = useAsync(async () => {
    const list = await getWorldCupEvents()
    return list.find((e) => e.id === eventId) ?? (await getEvent(eventId))
  }, [eventId])

  const rankingState = useAsync(getFifaRanking, [])
  const ranking = rankingState.data

  const event = eventState.data
  const oddsState = useAsync(
    async () => (event && event.statusType === 'notstarted' ? getEventOdds(event.id) : null),
    [event?.id, event?.statusType],
  )

  if (eventState.loading) return <Loading label="Carregando jogo…" />
  if (eventState.error) return <ErrorBox message={eventState.error} onRetry={eventState.reload} />
  if (!event) return <ErrorBox message="Jogo não encontrado." />

  const played = event.statusType === 'finished'

  return (
    <div className="match-detail">
      <a className="back" href="#/">
        ← Todos os jogos
      </a>

      <header className="detail-head card">
        <div className="detail-stage muted">
          {stageLabel(event)} · {formatDateLong(event.startTimestamp)} ·{' '}
          {formatTime(event.startTimestamp)}
        </div>
        <div className="detail-teams">
          <span className="team home">
            <span className="team-name">{event.homeTeam.name}</span>
            <TeamFlag teamId={event.homeTeam.id} size={32} />
          </span>
          <span className={`score ${played ? 'played' : ''}`}>
            {played || event.statusType === 'inprogress'
              ? `${event.homeScore ?? ''} x ${event.awayScore ?? ''}`
              : 'x'}
          </span>
          <span className="team away">
            <TeamFlag teamId={event.awayTeam.id} size={32} />
            <span className="team-name">{event.awayTeam.name}</span>
          </span>
        </div>
        <div className="detail-meta">
          {event.statusType === 'notstarted' && (
            <span className="detail-odds">
              {oddsState.loading ? (
                <span className="muted">carregando odds…</span>
              ) : (
                <OddsChips odds={oddsState.data} />
              )}
            </span>
          )}
          <a
            className="ext-link"
            href={sofascoreMatchUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver no Sofascore ↗
          </a>
        </div>
        <div className="form-summaries">
          <TeamFormSummary team={event.homeTeam} />
          <TeamFormSummary team={event.awayTeam} />
        </div>

        <div className="window-control">
          <span className="muted">Janela do ranking FIFA:</span>
          <button type="button" onClick={() => setWindowN((n) => Math.max(1, n - 1))}>
            −
          </button>
          <strong>±{windowN}</strong>
          <button type="button" onClick={() => setWindowN((n) => Math.min(30, n + 1))}>
            +
          </button>
        </div>
        {rankingState.error && (
          <p className="muted note">Ranking FIFA indisponível no momento — seções de nível parecido ficam vazias.</p>
        )}
      </header>

      <HeadToHead event={event} ranking={ranking} />

      <div className="panels">
        <TeamPanel
          team={event.homeTeam}
          adversary={event.awayTeam}
          ranking={ranking}
          windowN={windowN}
        />
        <TeamPanel
          team={event.awayTeam}
          adversary={event.homeTeam}
          ranking={ranking}
          windowN={windowN}
        />
      </div>
    </div>
  )
}
