export interface Team {
  id: number
  name: string
  shortName?: string
  nameCode?: string
}

export type EventStatusType =
  | 'notstarted'
  | 'inprogress'
  | 'finished'
  | 'postponed'
  | 'canceled'
  | string

/** Versão enxuta de um evento do Sofascore — só o que a UI usa (importante para caber no localStorage). */
export interface SlimEvent {
  id: number
  slug: string
  customId: string
  homeTeam: Team
  awayTeam: Team
  homeScore: number | null
  awayScore: number | null
  /** 1 = mandante venceu, 2 = visitante venceu, 3 = empate */
  winnerCode: number | null
  statusType: EventStatusType
  startTimestamp: number
  tournamentName: string
  uniqueTournamentId: number | null
  seasonYear: string | null
  roundName: string | null
}

export interface Odds1x2 {
  home: number
  draw: number
  away: number
}

export interface Possession {
  home: number
  away: number
}

export interface FifaRankingEntry {
  rank: number
  points: number
  teamId: number
  teamName: string
}

export interface FifaRanking {
  updatedAt: number | null
  entries: FifaRankingEntry[]
  byTeamId: Record<number, number>
}
