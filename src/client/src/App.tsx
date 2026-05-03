import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { api } from './api'
import { AuthPanel } from './components/AuthPanel'
import { HandPanel } from './components/HandPanel'
import { HeroPanel } from './components/HeroPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { RulesPanel } from './components/RulesPanel'
import { SeatingPanel } from './components/SeatingPanel'
import { getApiBaseUrl } from './config'
import { SUIT_ORDER, compareCardsByRank } from './gameUi'
import type { CardView, GameSnapshot, RoundResultView, SessionState } from './types'

const STORAGE_KEY = 'kartenreihen-session'

function App() {
  const [session, setSession] = useState<SessionState | null>(loadStoredSession)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [playerName, setPlayerName] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [winnerSplash, setWinnerSplash] = useState<RoundResultView | null>(null)
  const lastSeenRoundResultRef = useRef<number | null>(null)
  const hasWinnerSplashBaselineRef = useRef(false)

  async function refreshSnapshot(currentSession: SessionState) {
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

  function logout() {
    clearSession()
    setSession(null)
    setSnapshot(null)
    setSelectedCards([])
    setError(null)
    setWinnerSplash(null)
    lastSeenRoundResultRef.current = null
    hasWinnerSplashBaselineRef.current = false
  }

  useEffect(() => {
    if (!session) {
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

    connection.on('Reset', () => {
      logout()
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
  const latestRoundResult = snapshot?.results[0] ?? null

  useEffect(() => {
    if (session?.role !== 'player') {
      setWinnerSplash(null)
      lastSeenRoundResultRef.current = latestRoundResult?.roundNumber ?? null
      hasWinnerSplashBaselineRef.current = false
      return
    }

    if (!snapshot) {
      return
    }

    if (!hasWinnerSplashBaselineRef.current) {
      lastSeenRoundResultRef.current = latestRoundResult?.roundNumber ?? null
      hasWinnerSplashBaselineRef.current = true
      return
    }

    if (!latestRoundResult) {
      return
    }

    if (latestRoundResult.roundNumber === lastSeenRoundResultRef.current) {
      return
    }

    lastSeenRoundResultRef.current = latestRoundResult.roundNumber
    setWinnerSplash(latestRoundResult)

    const timeoutId = window.setTimeout(() => {
      setWinnerSplash((current) =>
        current?.roundNumber === latestRoundResult.roundNumber ? null : current,
      )
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [latestRoundResult, session?.role, snapshot])

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

  const resetGame = async () => {
    if (!session || session.role !== 'admin') {
      return
    }

    await runAction(async () => {
      await api.resetGame(session.token)
      logout()
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

  const playCard = async (card: CardView) => {
    if (!session || session.role !== 'player' || !snapshot?.canPlay || !playableCardCodes.has(card.code)) {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.playCards(session.token, [card])
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

  const toggleCardSelection = (card: CardView) => {
    setSelectedCards((currentSelection) =>
      currentSelection.includes(card.code)
        ? currentSelection.filter((code) => code !== card.code)
        : [...currentSelection, card.code],
    )
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
      {winnerSplash ? (
        <div className="winner-splash" role="status" aria-live="polite">
          <div className="winner-splash__content">
            <span className="winner-splash__eyebrow">Runde {winnerSplash.roundNumber}</span>
            <strong>{winnerSplash.winnerName} gewinnt</strong>
          </div>
        </div>
      ) : null}

      <HeroPanel
        session={session}
        snapshot={snapshot}
        showRules={showRules}
        onLogout={logout}
        onToggleRules={() => setShowRules((current) => !current)}
      />

      {showRules ? <RulesPanel /> : null}

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="layout-grid">
        <AuthPanel
          sessionRole={session?.role ?? null}
          snapshot={snapshot}
          playerName={playerName}
          adminCode={adminCode}
          isBusy={isBusy}
          onPlayerNameChange={setPlayerName}
          onAdminCodeChange={setAdminCode}
          onJoinAsPlayer={joinAsPlayer}
          onLoginAsAdmin={loginAsAdmin}
        />
        <SeatingPanel
          session={session}
          snapshot={snapshot}
          isBusy={isBusy}
          onStartGame={startGame}
          onEndGame={endGame}
          onResetGame={resetGame}
        />
        <HandPanel
          snapshot={snapshot}
          isBusy={isBusy}
          selectedCards={selectedCards}
          playableCardCodes={playableCardCodes}
          handRows={handRows}
          selectedCardCount={selectedCardViews.length}
          onToggleCardSelection={toggleCardSelection}
          onPlayCard={playCard}
          onPlaySelectedCards={playSelectedCards}
          onPassTurn={passTurn}
        />
        {session?.role === 'admin' ? <HistoryPanel currentRound={snapshot?.currentRound ?? null} /> : null}
      </section>
    </main>
  )
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

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.'
}

export default App
