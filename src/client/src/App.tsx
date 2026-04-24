import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import { api } from './api'
import type { CardView, GameSnapshot, SessionState } from './types'

const STORAGE_KEY = 'kartenreihen-session'
const SUIT_ORDER = ['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const
const RANK_ORDER = ['Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'] as const

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
  const playableCardCodes = useMemo(
    () => new Set(snapshot?.playableCards.map((card) => card.code) ?? []),
    [snapshot],
  )
  const handRows = useMemo(
    () =>
      SUIT_ORDER.map((suit) => ({
        suit,
        cards: (snapshot?.viewerHand ?? [])
          .filter((card) => card.suit === suit)
          .sort(compareCardsByRank),
      })),
    [snapshot],
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

        <section className="panel seating-panel">
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
              <div className="hand-suit-rows">
                {handRows.map((row) => (
                  <section key={row.suit} className="hand-suit-row">
                    <h3 className="hand-suit-title">{formatSuit(row.suit)}</h3>
                    <div className="hand-grid">
                      {row.cards.length ? (
                        row.cards.map((card) => {
                          const isSelected = selectedCards.includes(card.code)
                          const isPlayable = playableCardCodes.has(card.code)

                          return (
                            <button
                              key={card.code}
                              className={`card-button${isSelected ? ' card-button--selected' : ''}${isPlayable ? ' card-button--playable' : ''}`}
                              onClick={() => toggleCardSelection(card)}
                              disabled={isBusy || !snapshot.canPlay}
                              aria-label={card.label}
                            >
                              <HandCardFace card={card} />
                            </button>
                          )
                        })
                      ) : (
                        <p className="muted-copy hand-empty-row">Keine Karten</p>
                      )}
                    </div>
                  </section>
                ))}
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

function compareCardsByRank(left: CardView, right: CardView) {
  return getRankSortIndex(left.rank) - getRankSortIndex(right.rank)
}

function getRankSortIndex(rank: string) {
  const index = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number])
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function getRankGlyph(rank: string) {
  return (
    {
      Six: '6',
      Seven: '7',
      Eight: '8',
      Nine: '9',
      Ten: '10',
      Jack: 'J',
      Queen: 'Q',
      King: 'K',
      Ace: 'A',
    }[rank] ?? rank
  )
}

function getSuitColor(suit: string) {
  return suit === 'Hearts' || suit === 'Diamonds' ? '#c93a4f' : '#1d2438'
}

function HandCardFace({ card }: { card: CardView }) {
  const rankGlyph = getRankGlyph(card.rank)
  const suitColor = getSuitColor(card.suit)

  return (
    <svg
      className="card-face"
      viewBox="0 0 140 196"
      role="img"
      aria-label={card.label}
    >
      <rect x="6" y="6" width="128" height="184" rx="16" fill="#fffdf8" />
      <rect
        x="6"
        y="6"
        width="128"
        height="184"
        rx="16"
        fill="none"
        stroke="#d4d8e4"
        strokeWidth="2"
      />
      <text
        x="18"
        y="34"
        fill={suitColor}
        fontSize={rankGlyph === '10' ? '24' : '28'}
        fontWeight="700"
        fontFamily="Inter, Arial, sans-serif"
      >
        {rankGlyph}
      </text>
      <g transform="translate(19 48) scale(0.75)" fill={suitColor}>
        <SuitMark suit={card.suit} />
      </g>
      <g transform="translate(70 103) scale(1.55)" fill={suitColor}>
        <SuitMark suit={card.suit} />
      </g>
      <g transform="translate(122 148) rotate(180)" fill={suitColor}>
        <text
          x="0"
          y="0"
          textAnchor="end"
          fontSize={rankGlyph === '10' ? '24' : '28'}
          fontWeight="700"
          fontFamily="Inter, Arial, sans-serif"
        >
          {rankGlyph}
        </text>
        <g transform="translate(-9 14) scale(0.75)">
          <SuitMark suit={card.suit} />
        </g>
      </g>
    </svg>
  )
}

function SuitMark({ suit }: { suit: string }) {
  switch (suit) {
    case 'Hearts':
      return <path d="M0 8C0 2.9 4.2 0 7.6 0c2.1 0 4 1 5.4 2.6C14.4 1 16.3 0 18.4 0 21.8 0 26 2.9 26 8c0 7.5-8.5 12.8-13 17C8.5 20.8 0 15.5 0 8Z" />
    case 'Diamonds':
      return <path d="M13 0 25 13 13 26 1 13Z" />
    case 'Clubs':
      return <path d="M13 0c3.5 0 6.3 2.8 6.3 6.3 0 .9-.2 1.8-.6 2.6a5.8 5.8 0 1 1-5.7 9.1 5.8 5.8 0 1 1-5.7-9.1 6.3 6.3 0 1 1 11.4-2.6C18.7 2.8 16.5 0 13 0Zm-1.7 18h3.4l2.5 7H8.8l2.5-7Z" />
    case 'Spades':
      return <path d="M13 0c4.5 4.2 13 9.5 13 17 0 4.6-3.8 8-8.1 8-2.2 0-4.1-.9-4.9-2.5-.8 1.6-2.7 2.5-4.9 2.5C3.8 25 0 21.6 0 17 0 9.5 8.5 4.2 13 0Zm-1.7 24h3.4l2.5 8H8.8l2.5-8Z" />
    default:
      return <circle cx="13" cy="13" r="10" />
  }
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
