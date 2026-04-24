import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import { api } from './api'
import type { CardView, GameSnapshot, SessionState } from './types'

const STORAGE_KEY = 'kartenreihen-session'

function App() {
  const [session, setSession] = useState<SessionState | null>(loadStoredSession)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [playerName, setPlayerName] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!session) {
      setSnapshot(null)
      return
    }

    let isDisposed = false
    const restoreSession = async () => {
      try {
        const response =
          session.role === 'player'
            ? await api.restorePlayer(session.token)
            : await api.restoreAdmin(session.token)

        if (!isDisposed) {
          setSnapshot(response.snapshot)
          setError(null)
        }
      } catch (restoreError) {
        if (!isDisposed) {
          clearSession()
          setSession(null)
          setSnapshot(null)
          setError(toMessage(restoreError))
        }
      }
    }

    void restoreSession()
    return () => {
      isDisposed = true
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      return
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiBaseUrl()}/hubs/game`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('StateChanged', () => {
      void refreshSnapshot(session)
    })

    void connection
      .start()
      .then(() => connection.invoke('Subscribe'))
      .catch((connectionError: unknown) => {
        setError(toMessage(connectionError))
      })

    return () => {
      void connection.stop()
    }
  }, [session])

  useEffect(() => {
    if (!snapshot) {
      setSelectedCards([])
      return
    }

    setSelectedCards((currentSelection) =>
      currentSelection.filter((code) =>
        snapshot.viewerHand.some((card) => card.code === code),
      ),
    )
  }, [snapshot])

  const selectedCardViews = useMemo(
    () =>
      snapshot?.viewerHand.filter((card) => selectedCards.includes(card.code)) ?? [],
    [selectedCards, snapshot],
  )

  const joinAsPlayer = async () => {
    await runAction(async () => {
      const response = await api.joinPlayer(playerName)
      persistSession({ role: 'player', token: response.token })
      setSession({ role: 'player', token: response.token })
      setSnapshot(response.snapshot)
      setPlayerName('')
    })
  }

  const loginAsAdmin = async () => {
    await runAction(async () => {
      const response = await api.loginAdmin(adminCode)
      persistSession({ role: 'admin', token: response.token })
      setSession({ role: 'admin', token: response.token })
      setSnapshot(response.snapshot)
      setAdminCode('')
    })
  }

  const startGame = async (targetPlayerCount: number) => {
    if (!session || session.role !== 'admin') {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.startGame(session.token, targetPlayerCount)
      setSnapshot(nextSnapshot)
    })
  }

  const endGame = async () => {
    if (!session || session.role !== 'admin') {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.endGame(session.token)
      setSnapshot(nextSnapshot)
    })
  }

  const selectStartRank = async (rank: string) => {
    if (!session || session.role !== 'player') {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.selectStartRank(session.token, rank)
      setSnapshot(nextSnapshot)
    })
  }

  const playSelectedCards = async () => {
    if (!session || session.role !== 'player' || selectedCardViews.length === 0) {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.playCards(session.token, selectedCardViews)
      setSnapshot(nextSnapshot)
      setSelectedCards([])
    })
  }

  const passTurn = async () => {
    if (!session || session.role !== 'player') {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.passTurn(session.token)
      setSnapshot(nextSnapshot)
      setSelectedCards([])
    })
  }

  const logout = () => {
    clearSession()
    setSession(null)
    setSnapshot(null)
    setSelectedCards([])
    setError(null)
  }

  const toggleCardSelection = (card: CardView) => {
    setSelectedCards((currentSelection) =>
      currentSelection.includes(card.code)
        ? currentSelection.filter((code) => code !== card.code)
        : [...currentSelection, card.code],
    )
  }

  const refreshSnapshot = async (currentSession: SessionState) => {
    try {
      const response =
        currentSession.role === 'player'
          ? await api.restorePlayer(currentSession.token)
          : await api.restoreAdmin(currentSession.token)
      setSnapshot(response.snapshot)
    } catch (refreshError) {
      setError(toMessage(refreshError))
    }
  }

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true)
    setError(null)

    try {
      await action()
    } catch (actionError) {
      setError(toMessage(actionError))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <main
      className={`app-shell${session?.role === 'admin' ? ' app-shell--admin' : ' app-shell--player'}`}
    >
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Kartenreihen</p>
          <h1>Mehrspieler-Partie mit Admin-Steuerung und AI-Spielern</h1>
          <p className="hero-copy">
            Spieler treten mit Namen bei. Der Administrator startet eine Partie
            mit 3 oder 4 Plaetzen. Fehlende Plaetze werden automatisch mit AI
            gefuellt.
          </p>
        </div>
        <div className="hero-actions">
          {session ? (
            <>
              <span className="session-pill">
                {session.role === 'admin' ? 'Admin angemeldet' : 'Spieler angemeldet'}
              </span>
              <button className="secondary-button" onClick={logout}>
                Abmelden
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="layout-grid">
        <aside className="panel auth-panel">
          <h2>Zugang</h2>
          {!session ? (
            <div className="auth-grid">
              <div className="auth-card">
                <h3>Als Spieler beitreten</h3>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Dein Name"
                />
                <button
                  onClick={joinAsPlayer}
                  disabled={isBusy || playerName.trim().length === 0}
                >
                  Beitreten
                </button>
              </div>
              <div className="auth-card">
                <h3>Als Administrator anmelden</h3>
                <input
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  placeholder="Admin-Code"
                  type="password"
                />
                <button
                  onClick={loginAsAdmin}
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

        <section className="panel">
          <div className="section-header">
            <h2>Lobby und Sitzordnung</h2>
            {session?.role === 'admin' && snapshot ? (
              <div className="button-row">
                <button
                  onClick={() => startGame(3)}
                  disabled={isBusy || !snapshot.canStartGame}
                >
                  3 Spieler starten
                </button>
                <button
                  onClick={() => startGame(4)}
                  disabled={isBusy || !snapshot.canStartGame}
                >
                  4 Spieler starten
                </button>
                <button
                  className="secondary-button"
                  onClick={endGame}
                  disabled={isBusy || !snapshot.canEndGame}
                >
                  Partie beenden
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
                  <article
                    className={`player-card${player.isViewer ? ' player-card--viewer' : ''}`}
                  >
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

        <section className="panel table-panel">
          <div className="section-header">
            <h2>Aktuelle Runde</h2>
            {snapshot?.currentRound ? (
              <span className="session-pill">
                Runde {snapshot.currentRound.number} ·{' '}
                {formatStatus(snapshot.currentRound.phase)}
              </span>
            ) : null}
          </div>

          {snapshot?.canSelectStartRank ? (
            <div className="message-box action-box">
              <p>Du bestimmst den Startwert dieser Runde.</p>
              <div className="button-row">
                {snapshot.startRankOptions.map((rank) => (
                  <button
                    key={rank}
                    onClick={() => selectStartRank(rank)}
                    disabled={isBusy}
                  >
                    {formatRank(rank)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="row-grid">
            {snapshot?.currentRound?.rows.map((row) => (
              <article key={row.suit} className="row-card">
                <h3>{formatSuit(row.suit)}</h3>
                {row.isOpen ? (
                  <div className="row-details">
                    <span>Start: {row.startCard?.label}</span>
                    <span>Unten: {row.lowestCard?.label}</span>
                    <span>Oben: {row.highestCard?.label}</span>
                  </div>
                ) : (
                  <p className="muted-copy">Noch nicht eroeffnet</p>
                )}
              </article>
            )) ?? <p>Es wurde noch keine Runde gestartet.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Deine Hand</h2>
            {snapshot?.canFinishEntireHand ? (
              <span className="session-pill">Kompletter Finish-Zug moeglich</span>
            ) : null}
          </div>

          {snapshot?.viewerRole === 'player' ? (
            <>
              <div className="hand-grid">
                {snapshot.viewerHand.map((card) => {
                  const isSelected = selectedCards.includes(card.code)
                  const isPlayable = snapshot.playableCards.some(
                    (playableCard) => playableCard.code === card.code,
                  )

                  return (
                    <button
                      key={card.code}
                      className={`card-button${isSelected ? ' card-button--selected' : ''}${isPlayable ? ' card-button--playable' : ''}`}
                      onClick={() => toggleCardSelection(card)}
                      disabled={isBusy || !snapshot.canPlay}
                    >
                      <span>{card.label}</span>
                      <small>{card.code}</small>
                    </button>
                  )
                })}
              </div>

              <div className="button-row">
                <button
                  onClick={playSelectedCards}
                  disabled={isBusy || !snapshot.canPlay || selectedCardViews.length === 0}
                >
                  Ausgewaehlte Karten spielen
                </button>
                <button
                  className="secondary-button"
                  onClick={passTurn}
                  disabled={isBusy || !snapshot.canPass}
                >
                  Passen
                </button>
              </div>
            </>
          ) : (
            <p className="muted-copy">
              Der Administrator sieht das Spielbrett, aber keine Handkarten.
            </p>
          )}
        </section>

        <section className="panel history-panel">
          <h2>Zughistorie</h2>
          <div className="history-list">
            {snapshot?.currentRound?.actions.length ? (
              snapshot.currentRound.actions
                .slice()
                .reverse()
                .map((action) => (
                  <article key={`${action.turnNumber}-${action.type}`} className="history-entry">
                    <strong>Zug {action.turnNumber}</strong>
                    <p>{action.summary}</p>
                  </article>
                ))
            ) : (
              <p className="muted-copy">Noch keine Aktionen in der aktuellen Runde.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Gewonnene Runden</h2>
          <div className="history-list">
            {snapshot?.results.length ? (
              snapshot.results.map((result) => (
                <article key={result.roundNumber} className="history-entry">
                  <strong>Runde {result.roundNumber}</strong>
                  <p>
                    {result.winnerName} gewinnt bei Startwert {formatRank(result.startRank)}.
                  </p>
                </article>
              ))
            ) : (
              <p className="muted-copy">Noch keine beendeten Runden.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function formatSuit(suit: string) {
  return (
    {
      Hearts: 'Herz',
      Diamonds: 'Karo',
      Clubs: 'Kreuz',
      Spades: 'Pik',
    }[suit] ?? suit
  )
}

function formatRank(rank: string) {
  return (
    {
      Six: '6',
      Seven: '7',
      Eight: '8',
      Nine: '9',
      Ten: '10',
      Jack: 'Bube',
      Queen: 'Dame',
      King: 'Koenig',
      Ace: 'As',
    }[rank] ?? rank
  )
}

function formatStatus(status: string) {
  return (
    {
      Lobby: 'Lobby',
      Active: 'Aktiv',
      Completed: 'Beendet',
      AwaitingStartValue: 'Startwert offen',
      InProgress: 'Laeuft',
    }[status] ?? status
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

function loadStoredSession(): SessionState | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as SessionState
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function persistSession(session: SessionState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY)
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5051'
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.'
}

export default App
