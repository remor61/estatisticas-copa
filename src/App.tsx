import { useEffect, useState } from 'react'
import { MatchDetail } from './pages/MatchDetail'
import { MatchList } from './pages/MatchList'

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHashRoute()
  const matchRoute = hash.match(/^#\/match\/(\d+)/)

  return (
    <div className="app">
      <header className="app-header">
        <a href="#/">
          <h1>⚽ Estatísticas da Copa 2026</h1>
        </a>
      </header>
      <main>{matchRoute ? <MatchDetail eventId={Number(matchRoute[1])} /> : <MatchList />}</main>
      <footer className="app-footer muted">
        Dados e odds via{' '}
        <a href="https://www.sofascore.com" target="_blank" rel="noopener noreferrer">
          Sofascore
        </a>{' '}
        · Ranking FIFA masculino · Feito para palpites entre amigos
      </footer>
    </div>
  )
}
