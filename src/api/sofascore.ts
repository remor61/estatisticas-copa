import { cacheGet, cacheSet } from '../lib/cache'
import type {
  FifaRanking,
  FifaRankingEntry,
  Odds1x2,
  Possession,
  SlimEvent,
} from './types'

const BASE = 'https://api.sofascore.com/api/v1'

export const WC_UNIQUE_TOURNAMENT = 16
const WC_2026_SEASON_FALLBACK = 58210
const WC_2022_SEASON_FALLBACK = 41087

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 24 * HOUR

const TTL = {
  seasons: 7 * DAY,
  wcEvents: 3 * HOUR,
  teamEvents: 3 * HOUR,
  possession: 30 * DAY,
  odds: 30 * MIN,
  h2h: 12 * HOUR,
  ranking: DAY,
  wc2022: 30 * DAY,
  singleEvent: 3 * HOUR,
}

/** Início da janela de "jogos recentes": 1º de janeiro de 2024 (UTC), em segundos. */
export const SINCE_TS = Date.UTC(2024, 0, 1) / 1000

// ---------------------------------------------------------------------------
// Fila com limite de concorrência + espaçamento, para não abusar do Sofascore
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3
const GAP_MS = 120
let active = 0
let lastStart = 0
const waiters: (() => void)[] = []

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function acquire(): Promise<void> {
  while (active >= MAX_CONCURRENT) {
    await new Promise<void>((r) => waiters.push(r))
  }
  active++
  const wait = lastStart + GAP_MS - Date.now()
  lastStart = Math.max(Date.now(), lastStart + GAP_MS)
  if (wait > 0) await sleep(wait)
}

function release(): void {
  active--
  const next = waiters.shift()
  if (next) next()
}

async function rawGet(path: string): Promise<unknown | null> {
  await acquire()
  try {
    for (let attempt = 0; ; attempt++) {
      // Sofascore bloqueia requisições com Referer de outros domínios
      const res = await fetch(BASE + path, { referrerPolicy: 'no-referrer' })
      if (res.status === 404) return null
      if (res.ok) return (await res.json()) as unknown
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= 2) {
        throw new Error(`Sofascore respondeu HTTP ${res.status}`)
      }
      await sleep(900 * (attempt + 1))
    }
  } finally {
    release()
  }
}

// dedupe de chamadas concorrentes à mesma chave (StrictMode, dois painéis etc.)
const inflight = new Map<string, Promise<unknown>>()

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const p = (async () => {
    try {
      const v = await load()
      cacheSet(key, v, ttlMs)
      return v
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

interface RawEvent {
  id: number
  slug: string
  customId: string
  homeTeam: { id: number; name: string; shortName?: string; nameCode?: string }
  awayTeam: { id: number; name: string; shortName?: string; nameCode?: string }
  homeScore?: { current?: number; display?: number }
  awayScore?: { current?: number; display?: number }
  winnerCode?: number
  status?: { type?: string }
  startTimestamp: number
  tournament?: { name?: string; uniqueTournament?: { id?: number } }
  season?: { year?: string }
  roundInfo?: { round?: number; name?: string }
}

interface EventsPage {
  events?: RawEvent[]
  hasNextPage?: boolean
}

function slim(e: RawEvent): SlimEvent {
  return {
    id: e.id,
    slug: e.slug,
    customId: e.customId,
    homeTeam: {
      id: e.homeTeam.id,
      name: e.homeTeam.name,
      shortName: e.homeTeam.shortName,
      nameCode: e.homeTeam.nameCode,
    },
    awayTeam: {
      id: e.awayTeam.id,
      name: e.awayTeam.name,
      shortName: e.awayTeam.shortName,
      nameCode: e.awayTeam.nameCode,
    },
    homeScore: e.homeScore?.display ?? e.homeScore?.current ?? null,
    awayScore: e.awayScore?.display ?? e.awayScore?.current ?? null,
    winnerCode: e.winnerCode ?? null,
    statusType: e.status?.type ?? 'notstarted',
    startTimestamp: e.startTimestamp,
    tournamentName: e.tournament?.name ?? '',
    uniqueTournamentId: e.tournament?.uniqueTournament?.id ?? null,
    seasonYear: e.season?.year ?? null,
    roundName: e.roundInfo?.name ?? (e.roundInfo?.round != null ? String(e.roundInfo.round) : null),
  }
}

/** "2/5" -> 1.4 (odd decimal) */
function fractionToDecimal(frac: string): number | null {
  const m = frac.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (m) return 1 + Number(m[1]) / Number(m[2])
  const n = Number(frac)
  return Number.isFinite(n) ? 1 + n : null
}

interface RawMarket {
  marketId?: number
  marketName?: string
  choices?: { name: string; fractionalValue: string }[]
}

function marketTo1x2(market: RawMarket | undefined): Odds1x2 | null {
  if (!market?.choices) return null
  const by = (n: string) => market.choices!.find((c) => c.name === n)
  const h = by('1') && fractionToDecimal(by('1')!.fractionalValue)
  const d = by('X') && fractionToDecimal(by('X')!.fractionalValue)
  const a = by('2') && fractionToDecimal(by('2')!.fractionalValue)
  if (!h || !d || !a) return null
  return { home: h, draw: d, away: a }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

async function getSeasonId(year: '2026' | '2022'): Promise<number> {
  const fallback = year === '2026' ? WC_2026_SEASON_FALLBACK : WC_2022_SEASON_FALLBACK
  try {
    const seasons = await cached<{ year: string; id: number }[]>('seasons', TTL.seasons, async () => {
      const j = (await rawGet(`/unique-tournament/${WC_UNIQUE_TOURNAMENT}/seasons`)) as {
        seasons?: { year?: string; id: number }[]
      } | null
      return (j?.seasons ?? []).map((s) => ({ year: s.year ?? '', id: s.id }))
    })
    return seasons.find((s) => s.year === year)?.id ?? fallback
  } catch {
    return fallback
  }
}

async function collectSeasonEvents(seasonId: number, direction: 'next' | 'last'): Promise<SlimEvent[]> {
  const out: SlimEvent[] = []
  for (let page = 0; page < 8; page++) {
    const j = (await rawGet(
      `/unique-tournament/${WC_UNIQUE_TOURNAMENT}/season/${seasonId}/events/${direction}/${page}`,
    )) as EventsPage | null
    if (!j?.events?.length) break
    out.push(...j.events.map(slim))
    if (!j.hasNextPage) break
  }
  return out
}

/** Todos os jogos da Copa 2026 (passados + futuros), ordenados por data. */
export async function getWorldCupEvents(): Promise<SlimEvent[]> {
  return cached('wc26', TTL.wcEvents, async () => {
    const sid = await getSeasonId('2026')
    const [past, upcoming] = await Promise.all([
      collectSeasonEvents(sid, 'last'),
      collectSeasonEvents(sid, 'next'),
    ])
    const byId = new Map<number, SlimEvent>()
    for (const e of [...past, ...upcoming]) byId.set(e.id, e)
    return [...byId.values()].sort((a, b) => a.startTimestamp - b.startTimestamp)
  })
}

/** Todos os jogos da Copa 2022 (imutável — cache longo). */
export async function getWorldCup2022Events(): Promise<SlimEvent[]> {
  return cached('wc22', TTL.wc2022, async () => {
    const sid = await getSeasonId('2022')
    const events = await collectSeasonEvents(sid, 'last')
    return events.sort((a, b) => b.startTimestamp - a.startTimestamp)
  })
}

/** Um evento específico (para deep link direto na página do jogo). */
export async function getEvent(eventId: number): Promise<SlimEvent | null> {
  return cached(`ev:${eventId}`, TTL.singleEvent, async () => {
    const j = (await rawGet(`/event/${eventId}`)) as { event?: RawEvent } | null
    return j?.event ? slim(j.event) : null
  })
}

/**
 * Jogos passados do time, do mais recente ao mais antigo, voltando até
 * 01/01/2024 (ou até juntar 10 jogos encerrados, o que demorar mais).
 */
export async function getTeamRecentEvents(teamId: number): Promise<SlimEvent[]> {
  return cached(`team:${teamId}`, TTL.teamEvents, async () => {
    const out: SlimEvent[] = []
    let finishedCount = 0
    for (let page = 0; page < 8; page++) {
      const j = (await rawGet(`/team/${teamId}/events/last/${page}`)) as EventsPage | null
      if (!j?.events?.length) break
      const slimmed = j.events.map(slim)
      out.push(...slimmed)
      finishedCount += slimmed.filter((e) => e.statusType === 'finished').length
      const oldest = Math.min(...slimmed.map((e) => e.startTimestamp))
      if ((oldest < SINCE_TS && finishedCount >= 10) || !j.hasNextPage) break
    }
    return out
      .filter((e) => e.statusType === 'finished')
      .sort((a, b) => b.startTimestamp - a.startTimestamp)
  })
}

/** Posse de bola de um jogo encerrado ({home, away} em %), ou null se não houver. */
export async function getEventPossession(eventId: number): Promise<Possession | null> {
  return cached(`poss:${eventId}`, TTL.possession, async () => {
    const j = (await rawGet(`/event/${eventId}/statistics`)) as {
      statistics?: {
        period: string
        groups?: { statisticsItems?: { name: string; home: string; away: string }[] }[]
      }[]
    } | null
    const all = j?.statistics?.find((s) => s.period === 'ALL')
    for (const g of all?.groups ?? []) {
      for (const item of g.statisticsItems ?? []) {
        if (/ball possession/i.test(item.name)) {
          const h = parseInt(item.home, 10)
          const a = parseInt(item.away, 10)
          if (Number.isFinite(h) && Number.isFinite(a)) return { home: h, away: a }
        }
      }
    }
    return null
  })
}

/** Odds decimais 1X2 de um jogo. */
export async function getEventOdds(eventId: number): Promise<Odds1x2 | null> {
  return cached(`odds:${eventId}`, TTL.odds, async () => {
    const j = (await rawGet(`/event/${eventId}/odds/1/all`)) as { markets?: RawMarket[] } | null
    const market = j?.markets?.find((m) => m.marketName === 'Full time' || m.marketId === 1)
    return marketTo1x2(market)
  })
}

/** Odds 1X2 de todos os jogos de futebol de uma data (YYYY-MM-DD), por id de evento. */
export async function getOddsForDate(date: string): Promise<Record<number, Odds1x2>> {
  return cached(`dodds:${date}`, TTL.odds, async () => {
    const j = (await rawGet(`/sport/football/odds/1/${date}`)) as {
      odds?: Record<string, RawMarket>
    } | null
    const out: Record<number, Odds1x2> = {}
    for (const [id, market] of Object.entries(j?.odds ?? {})) {
      const o = marketTo1x2(market)
      if (o) out[Number(id)] = o
    }
    return out
  })
}

/** Confrontos diretos anteriores (jogos encerrados), do mais recente ao mais antigo. */
export async function getHeadToHead(customId: string): Promise<SlimEvent[]> {
  return cached(`h2h:${customId}`, TTL.h2h, async () => {
    const j = (await rawGet(`/event/${customId}/h2h/events`)) as EventsPage | null
    return (j?.events ?? [])
      .map(slim)
      .filter((e) => e.statusType === 'finished')
      .sort((a, b) => b.startTimestamp - a.startTimestamp)
  })
}

/** Ranking FIFA masculino completo, direto do Sofascore (ids de time compatíveis). */
export async function getFifaRanking(): Promise<FifaRanking> {
  return cached('fifarank', TTL.ranking, async () => {
    const j = (await rawGet('/rankings/type/2')) as {
      updatedAtTimestamp?: number
      rankings?: { ranking: number; points: number; team?: { id: number; name: string } }[]
    } | null
    const entries: FifaRankingEntry[] = (j?.rankings ?? [])
      .filter((r) => r.team)
      .map((r) => ({
        rank: r.ranking,
        points: r.points,
        teamId: r.team!.id,
        teamName: r.team!.name,
      }))
    const byTeamId: Record<number, number> = {}
    for (const e of entries) byTeamId[e.teamId] = e.rank
    return { updatedAt: j?.updatedAtTimestamp ?? null, entries, byTeamId }
  })
}

/** URL da página do jogo no Sofascore. */
export function sofascoreMatchUrl(e: SlimEvent): string {
  return `https://www.sofascore.com/football/match/${e.slug}/${e.customId}#id:${e.id}`
}

/** URL do escudo/bandeira do time (PNG servido pelo Sofascore). */
export function teamImageUrl(teamId: number): string {
  return `${BASE}/team/${teamId}/image`
}
