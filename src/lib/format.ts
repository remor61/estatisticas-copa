import type { SlimEvent } from '../api/types'

const dateLong = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const dateShort = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateLong(ts: number): string {
  const s = dateLong.format(new Date(ts * 1000))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatDateShort(ts: number): string {
  return dateShort.format(new Date(ts * 1000))
}

export function formatTime(ts: number): string {
  return timeFmt.format(new Date(ts * 1000))
}

/** YYYY-MM-DD no fuso UTC — usado para buscar odds por data no Sofascore. */
export function utcDateKey(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

export function formatOdd(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

const ROUND_PT: Record<string, string> = {
  'Round of 32': '16 avos de final',
  'Round of 16': 'Oitavas de final',
  Quarterfinals: 'Quartas de final',
  Semifinals: 'Semifinal',
  Final: 'Final',
  'Match for 3rd place': 'Disputa de 3º lugar',
  '3rd place': 'Disputa de 3º lugar',
}

/** Rótulo da fase de um jogo da Copa: "Grupo A", "Oitavas de final"… */
export function stageLabel(e: SlimEvent): string {
  const group = e.tournamentName.match(/Group ([A-L])\b/)
  if (group) return `Grupo ${group[1]}`
  if (e.roundName && ROUND_PT[e.roundName]) return ROUND_PT[e.roundName]
  if (e.roundName && /^\d+$/.test(e.roundName)) return `Rodada ${e.roundName}`
  return e.roundName ?? ''
}

/** Resultado do ponto de vista de um time: V/E/D. */
export function resultFor(e: SlimEvent, teamId: number): 'V' | 'E' | 'D' | null {
  if (e.statusType !== 'finished') return null
  const isHome = e.homeTeam.id === teamId
  // Placar igual no display = empate no tempo regulamentar (pênaltis não alteram o placar exibido)
  if (e.homeScore != null && e.awayScore != null && e.homeScore === e.awayScore) return 'E'
  if (e.winnerCode === 3) return 'E'
  if (e.winnerCode === 1) return isHome ? 'V' : 'D'
  if (e.winnerCode === 2) return isHome ? 'D' : 'V'
  if (e.homeScore != null && e.awayScore != null) {
    const homeWon = e.homeScore > e.awayScore
    return homeWon === isHome ? 'V' : 'D'
  }
  return null
}

export function opponentOf(e: SlimEvent, teamId: number) {
  return e.homeTeam.id === teamId ? e.awayTeam : e.homeTeam
}

export function goalsFor(e: SlimEvent, teamId: number): number | null {
  return e.homeTeam.id === teamId ? e.homeScore : e.awayScore
}

export function goalsAgainst(e: SlimEvent, teamId: number): number | null {
  return e.homeTeam.id === teamId ? e.awayScore : e.homeScore
}
