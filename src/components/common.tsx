import type { ReactNode } from 'react'
import type { Odds1x2 } from '../api/types'
import { teamImageUrl } from '../api/sofascore'
import { formatOdd } from '../lib/format'

export function TeamFlag({ teamId, size = 22 }: { teamId: number; size?: number }) {
  return (
    <img
      className="flag"
      src={teamImageUrl(teamId)}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(ev) => {
        ev.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

export function OddsChips({ odds, compact = false }: { odds: Odds1x2 | null; compact?: boolean }) {
  if (!odds) return <span className="muted odds-empty">{compact ? '' : 'sem odds'}</span>
  return (
    <span className="odds">
      <span className="odd-chip" title="Vitória do mandante">
        <em>1</em> {formatOdd(odds.home)}
      </span>
      <span className="odd-chip" title="Empate">
        <em>X</em> {formatOdd(odds.draw)}
      </span>
      <span className="odd-chip" title="Vitória do visitante">
        <em>2</em> {formatOdd(odds.away)}
      </span>
    </span>
  )
}

export function ResultBadge({ r }: { r: 'V' | 'E' | 'D' | null }) {
  if (!r) return <span className="muted">–</span>
  const cls = r === 'V' ? 'win' : r === 'E' ? 'draw' : 'loss'
  return <span className={`badge ${cls}`}>{r}</span>
}

export function SectionCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <p>Não foi possível carregar os dados do Sofascore.</p>
      <p className="muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}
