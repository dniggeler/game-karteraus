import type { SessionState } from '../types'

interface HeroPanelProps {
  session: SessionState | null
  onLogout: () => void
}

export function HeroPanel({ session, onLogout }: HeroPanelProps) {
  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">Kartenreihen</p>
        <h1>Kartenlegen Schweizer Art</h1>
        <p className="hero-copy">
          Spieler treten mit Namen bei. Der Administrator startet eine Partie mit 3 oder 4
          Plaetzen. Fehlende Plaetze werden automatisch mit AI gefuellt.
        </p>
      </div>
      <div className="hero-actions">
        {session ? (
          <>
            <span className="session-pill">
              {session.role === 'admin' ? 'Admin angemeldet' : 'Spieler angemeldet'}
            </span>
            <button className="secondary-button" onClick={onLogout}>
              Abmelden
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}

