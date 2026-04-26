import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { api } from './api'
import { AuthPanel } from './components/AuthPanel'
import { HandPanel } from './components/HandPanel'
import { HeroPanel } from './components/HeroPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { SeatingPanel } from './components/SeatingPanel'
import { getApiBaseUrl } from './config'
import { SUIT_ORDER, compareCardsByRank } from './gameUi'
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
      <HeroPanel session={session} onLogout={logout} />

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="layout-grid">
        <AuthPanel
          sessionActive={session !== null}
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
          onSelectStartRank={selectStartRank}
        />
        <HandPanel
          snapshot={snapshot}
          isBusy={isBusy}
          selectedCards={selectedCards}
          playableCardCodes={playableCardCodes}
          handRows={handRows}
          selectedCardCount={selectedCardViews.length}
          onToggleCardSelection={toggleCardSelection}
          onPlaySelectedCards={playSelectedCards}
          onPassTurn={passTurn}
        />
        <HistoryPanel currentRound={snapshot?.currentRound ?? null} />
        <ResultsPanel results={snapshot?.results ?? []} />
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
