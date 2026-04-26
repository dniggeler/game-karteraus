import type { CSSProperties } from 'react'
import type { GameSnapshot, SessionState } from '../types'

interface SeatingPanelProps {
  session: SessionState | null
  snapshot: GameSnapshot | null
  isBusy: boolean
  onStartGame: (targetPlayerCount: number) => void
  onEndGame: () => void
  onResetGame: () => void
}

export function SeatingPanel({
  session,
  snapshot,
  isBusy,
  onStartGame,
  onEndGame,
  onResetGame,
}: SeatingPanelProps) {
  return (
    <section className="panel seating-panel">
      <div className="section-header">
        <h2>Lobby und Sitzordnung</h2>
        {session?.role === 'admin' && snapshot ? (
          <div className="button-row">
            <button onClick={() => onStartGame(3)} disabled={isBusy || !snapshot.canStartGame}>
              3 Spieler starten
            </button>
            <button onClick={() => onStartGame(4)} disabled={isBusy || !snapshot.canStartGame}>
              4 Spieler starten
            </button>
            <button
              className="secondary-button"
              onClick={onEndGame}
              disabled={isBusy || !snapshot.canEndGame}
            >
              Partie beenden
            </button>
            <button className="secondary-button" onClick={onResetGame} disabled={isBusy}>
              Alles zuruecksetzen
            </button>
          </div>
        ) : null}
      </div>

      {snapshot?.players.length ? (
        <div className="round-table">
          <div className="round-table__felt">
            <span className="round-table__label">Tischmitte</span>
            <strong>{snapshot.players.length} Spieler</strong>
            <span className="muted-copy">
              {snapshot.currentRound
                ? `Runde ${snapshot.currentRound.number} laeuft`
                : 'Wartet auf den Spielstart'}
            </span>
          </div>

          {snapshot.players.map((player, index) => (
            <div
              key={player.id}
              className="round-table__seat"
              style={getSeatStyle(index, snapshot.players.length)}
            >
              <article className={`player-card${player.isViewer ? ' player-card--viewer' : ''}`}>
                <div>
                  <strong className="player-name">
                    <span>{player.name}</span>
                    {player.kind === 'Ai' ? (
                      <span className="player-name__badge" aria-label="AI-Spieler" title="AI-Spieler">
                        ✦
                      </span>
                    ) : null}
                  </strong>
                </div>
                <div className="player-meta">
                  <span>{player.cardCount} Karten</span>
                  {player.isCurrentTurn ? <span>am Zug</span> : null}
                  {player.isStartValueChooser ? <span>waehlt Startwert</span> : null}
                </div>
              </article>
            </div>
          ))}
        </div>
      ) : (
        <p>Noch keine Spieler in der Lobby.</p>
      )}
    </section>
  )
}

function getSeatStyle(index: number, totalPlayers: number): CSSProperties {
  if (totalPlayers <= 0) {
    return {}
  }

  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / totalPlayers
  const radius =
    totalPlayers === 1 ? 36 : totalPlayers === 2 ? 39 : totalPlayers === 3 ? 41 : 42

  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
  }
}

