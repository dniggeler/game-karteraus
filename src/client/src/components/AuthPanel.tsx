import type { GameSnapshot, SessionState } from '../types'
import { formatStatus } from '../gameUi'

interface AuthPanelProps {
  startupPage: SessionState['role']
  sessionRole: SessionState['role'] | null
  snapshot: GameSnapshot | null
  playerName: string
  adminCode: string
  isBusy: boolean
  onPlayerNameChange: (value: string) => void
  onAdminCodeChange: (value: string) => void
  onJoinAsPlayer: () => void
  onLoginAsAdmin: () => void
}

export function AuthPanel({
  startupPage,
  sessionRole,
  snapshot,
  playerName,
  adminCode,
  isBusy,
  onPlayerNameChange,
  onAdminCodeChange,
  onJoinAsPlayer,
  onLoginAsAdmin,
}: AuthPanelProps) {
  function handlePlayerJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isBusy || playerName.trim().length === 0) {
      return
    }

    onJoinAsPlayer()
  }

  function handleAdminLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isBusy || adminCode.trim().length === 0) {
      return
    }

    onLoginAsAdmin()
  }

  if (sessionRole === 'player') {
    return null
  }

  return (
    <aside className="panel auth-panel">
      <h2>{startupPage === 'admin' ? 'Admin-Zugang' : 'Spielerbeitritt'}</h2>
      {!sessionRole ? (
        <div className="auth-grid">
          {startupPage === 'player' ? (
            <form className="auth-card" onSubmit={handlePlayerJoinSubmit}>
              <h3>Als Spieler beitreten</h3>
              <input
                value={playerName}
                onChange={(event) => onPlayerNameChange(event.target.value)}
                placeholder="Dein Name"
              />
              <button type="submit" disabled={isBusy || playerName.trim().length === 0}>
                Beitreten
              </button>
            </form>
          ) : (
            <form className="auth-card" onSubmit={handleAdminLoginSubmit}>
              <h3>Als Administrator anmelden</h3>
              <input
                value={adminCode}
                onChange={(event) => onAdminCodeChange(event.target.value)}
                placeholder="Admin-Code"
                type="password"
              />
              <button type="submit" disabled={isBusy || adminCode.trim().length === 0}>
                Admin Login
              </button>
            </form>
          )}
        </div>
      ) : snapshot ? (
        <div className="status-stack">
          <p className="message-box">{snapshot.message}</p>
          <dl className="facts-grid">
            <div>
              <dt>Status</dt>
              <dd>{formatStatus(snapshot.matchStatus)}</dd>
            </div>
            <div>
              <dt>Reale Spieler</dt>
              <dd>{snapshot.humanPlayers}</dd>
            </div>
            <div>
              <dt>Zielgroesse</dt>
              <dd>{snapshot.targetPlayerCount ?? '-'}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p>Session wird geladen ...</p>
      )}
    </aside>
  )
}

