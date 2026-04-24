import type { GameSnapshot } from '../types'
import { formatStatus } from '../gameUi'

interface AuthPanelProps {
  sessionActive: boolean
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
  sessionActive,
  snapshot,
  playerName,
  adminCode,
  isBusy,
  onPlayerNameChange,
  onAdminCodeChange,
  onJoinAsPlayer,
  onLoginAsAdmin,
}: AuthPanelProps) {
  return (
    <aside className="panel auth-panel">
      <h2>Zugang</h2>
      {!sessionActive ? (
        <div className="auth-grid">
          <div className="auth-card">
            <h3>Als Spieler beitreten</h3>
            <input
              value={playerName}
              onChange={(event) => onPlayerNameChange(event.target.value)}
              placeholder="Dein Name"
            />
            <button onClick={onJoinAsPlayer} disabled={isBusy || playerName.trim().length === 0}>
              Beitreten
            </button>
          </div>
          <div className="auth-card">
            <h3>Als Administrator anmelden</h3>
            <input
              value={adminCode}
              onChange={(event) => onAdminCodeChange(event.target.value)}
              placeholder="Admin-Code"
              type="password"
            />
            <button
              onClick={onLoginAsAdmin}
              disabled={isBusy || adminCode.trim().length === 0}
            >
              Admin Login
            </button>
          </div>
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

