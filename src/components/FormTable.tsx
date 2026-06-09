import { sofascoreMatchUrl } from '../api/sofascore'
import type { Possession, SlimEvent } from '../api/types'
import {
  formatDateShort,
  goalsAgainst,
  goalsFor,
  opponentOf,
  resultFor,
} from '../lib/format'
import { ResultBadge, TeamFlag } from './common'

interface Props {
  events: SlimEvent[]
  /** Time de referência: resultado, gols e posse são do ponto de vista dele. */
  teamId: number
  possessions: Record<number, Possession | null>
  /** Ranking FIFA por id de time — quando presente, mostra a posição do adversário. */
  rankByTeamId?: Record<number, number>
  showAverages?: boolean
  emptyMessage: string
}

function possessionFor(e: SlimEvent, teamId: number, p: Possession | null | undefined): string {
  if (p === undefined) return '…'
  if (p === null) return '–'
  return `${e.homeTeam.id === teamId ? p.home : p.away}%`
}

export function FormTable({ events, teamId, possessions, rankByTeamId, showAverages, emptyMessage }: Props) {
  if (events.length === 0) {
    return <p className="muted empty">{emptyMessage}</p>
  }

  const finished = events.filter((e) => e.statusType === 'finished')
  const gf = finished.map((e) => goalsFor(e, teamId)).filter((v): v is number => v != null)
  const ga = finished.map((e) => goalsAgainst(e, teamId)).filter((v): v is number => v != null)
  const poss = finished
    .map((e) => {
      const p = possessions[e.id]
      return p ? (e.homeTeam.id === teamId ? p.home : p.away) : null
    })
    .filter((v): v is number => v != null)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const fmtAvg = (v: number | null, suffix = '') =>
    v == null ? '–' : v.toFixed(1).replace('.', ',') + suffix

  return (
    <div className="table-wrap">
      <table className="form-table">
        <thead>
          <tr>
            <th>Data</th>
            <th className="col-comp">Competição</th>
            <th>Adversário</th>
            <th className="num">Placar</th>
            <th className="num">Res.</th>
            <th className="num" title="Posse de bola">
              Posse
            </th>
            <th aria-label="Link Sofascore" />
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const opp = opponentOf(e, teamId)
            const isHome = e.homeTeam.id === teamId
            const rank = rankByTeamId?.[opp.id]
            const isWc22 = e.seasonYear === '2022' && /world cup/i.test(e.tournamentName)
            return (
              <tr key={e.id}>
                <td className="nowrap">{formatDateShort(e.startTimestamp)}</td>
                <td className="muted comp col-comp">{e.tournamentName}</td>
                <td>
                  <span className="team-cell">
                    <TeamFlag teamId={opp.id} size={18} />
                    {opp.name}
                    {rank != null && <span className="muted rank-tag">#{rank}</span>}
                    <span className="muted side-tag" title={isHome ? 'jogou em casa' : 'jogou fora'}>
                      {isHome ? 'C' : 'F'}
                    </span>
                    {isWc22 && <span className="chip wc22">Copa 2022</span>}
                  </span>
                </td>
                <td className="num nowrap score">
                  {goalsFor(e, teamId) ?? '–'}&thinsp;x&thinsp;{goalsAgainst(e, teamId) ?? '–'}
                </td>
                <td className="num">
                  <ResultBadge r={resultFor(e, teamId)} />
                </td>
                <td className="num">{possessionFor(e, teamId, possessions[e.id])}</td>
                <td className="num">
                  <a
                    className="ext"
                    href={sofascoreMatchUrl(e)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no Sofascore"
                  >
                    ↗
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
        {showAverages && (
          <tfoot>
            <tr>
              <td className="nowrap">Médias</td>
              <td className="col-comp" />
              <td />
              <td className="num nowrap">
                {fmtAvg(avg(gf))}&thinsp;x&thinsp;{fmtAvg(avg(ga))}
              </td>
              <td />
              <td className="num">{fmtAvg(avg(poss), '%')}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
