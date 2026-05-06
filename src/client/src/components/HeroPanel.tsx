import type { GameSnapshot, SessionState } from '../types'

interface HeroPanelProps {
  startupPage: SessionState['role']
  session: SessionState | null
  snapshot: GameSnapshot | null
  showRules: boolean
  onLogout: () => void
  onToggleRules: () => void
}

export function HeroPanel({
  startupPage,
  session,
  snapshot,
  showRules,
  onLogout,
  onToggleRules,
}: HeroPanelProps) {
  const viewerName = snapshot?.players.find((player) => player.isViewer)?.name
  const eyebrowLabel = startupPage === 'admin' ? 'Kartenreihen · Admin' : 'Kartenreihen · Spieler'
  const heroCopy =
    startupPage === 'admin'
      ? 'Hier meldet sich der Administrator an, startet Partien mit 3 oder 4 Plaetzen und steuert den gemeinsamen Spielraum.'
      : null

  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">{eyebrowLabel}</p>
        <h1>Schweizer Kartenlegen</h1>
        {heroCopy ? <p className="hero-copy">{heroCopy}</p> : null}
      </div>
      <div className="hero-actions">
        <button className="secondary-button" onClick={onToggleRules}>
          {showRules ? 'Regeln ausblenden' : 'Spielregeln'}
        </button>
        {session ? (
          <>
            <span className="session-pill">
              {session.role === 'admin' ? 'Admin angemeldet' : viewerName ?? 'Spieler angemeldet'}
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

