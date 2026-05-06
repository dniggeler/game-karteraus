import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { api } from './api'
import { AuthPanel } from './components/AuthPanel'
import { HandPanel } from './components/HandPanel'
import { HeroPanel } from './components/HeroPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { RulesPanel } from './components/RulesPanel'
import { SeatingPanel } from './components/SeatingPanel'
import { getApiBaseUrl } from './config'
import { SUIT_ORDER, compareCardsByRank, getRankSortIndex } from './gameUi'
import { buildRankingEntries, formatRankPosition, formatScore } from './ranking'
import type {
  AiCardFlightView,
  CardView,
  GameSnapshot,
  RoundResultView,
  SessionState,
  TableStackPosition,
} from './types'

const LEGACY_STORAGE_KEY = 'kartenreihen-session'
type StartupPage = SessionState['role']

function App() {
  const startupPage = getStartupPage()
  const [session, setSession] = useState<SessionState | null>(() => loadStoredSession(startupPage))
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [playerName, setPlayerName] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [winnerSplash, setWinnerSplash] = useState<RoundResultView | null>(null)
  const [aiCardFlightQueue, setAiCardFlightQueue] = useState<AiCardFlightView[]>([])
  const [activeAiCardFlight, setActiveAiCardFlight] = useState<AiCardFlightView | null>(null)
  const lastSeenRoundResultRef = useRef<number | null>(null)
  const hasWinnerSplashBaselineRef = useRef(false)
  const lastSeenActionKeyRef = useRef<string | null>(null)
  const hasAiActionBaselineRef = useRef(false)

  useEffect(() => {
    const canonicalPath = getPathForPage(startupPage)

    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath)
    }

    document.title = startupPage === 'admin' ? 'Kartenreihen Admin' : 'Kartenreihen Spieler'
  }, [startupPage])

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
    clearSession(startupPage)
    setSession(null)
    setSnapshot(null)
    setSelectedCards([])
    setError(null)
    setWinnerSplash(null)
    setAiCardFlightQueue([])
    setActiveAiCardFlight(null)
    lastSeenRoundResultRef.current = null
    hasWinnerSplashBaselineRef.current = false
    lastSeenActionKeyRef.current = null
    hasAiActionBaselineRef.current = false
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
          clearSession(startupPage)
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
  const pendingAiCardFlights = useMemo(
    () => (activeAiCardFlight ? [activeAiCardFlight, ...aiCardFlightQueue] : aiCardFlightQueue),
    [activeAiCardFlight, aiCardFlightQueue],
  )
  const finalRankingEntries = useMemo(
    () => buildRankingEntries(snapshot?.players ?? [], snapshot?.results ?? []),
    [snapshot?.players, snapshot?.results],
  )

  useEffect(() => {
    const currentRound = snapshot?.currentRound ?? null
    if (!currentRound) {
      setAiCardFlightQueue([])
      setActiveAiCardFlight(null)
      lastSeenActionKeyRef.current = null
      hasAiActionBaselineRef.current = false
      return
    }

    const latestAction = currentRound.actions.at(-1) ?? null
    const latestActionKey = latestAction
      ? `${currentRound.number}:${latestAction.turnNumber}:${latestAction.playerId}:${latestAction.type}:${latestAction.cards.map((card) => card.code).join(',')}`
      : `${currentRound.number}:none`

    if (!hasAiActionBaselineRef.current) {
      lastSeenActionKeyRef.current = latestActionKey
      hasAiActionBaselineRef.current = true
      return
    }

    if (lastSeenActionKeyRef.current === latestActionKey) {
      return
    }

    lastSeenActionKeyRef.current = latestActionKey

    if (!latestAction || latestAction.type !== 'play' || latestAction.cards.length === 0) {
      return
    }

    const actingPlayer = snapshot?.players.find((player) => player.id === latestAction.playerId)
    if (actingPlayer?.kind !== 'Ai') {
      return
    }

    setAiCardFlightQueue((currentQueue) => [
      ...currentQueue,
      ...latestAction.cards.map((card, index) => ({
        id: `${latestActionKey}:${card.code}:${index}`,
        playerId: latestAction.playerId,
        card,
        targetSuit: card.suit,
        targetStack: getTargetStackPosition(currentRound, card),
      })),
    ])
  }, [snapshot])

  useEffect(() => {
    if (activeAiCardFlight || aiCardFlightQueue.length === 0) {
      return
    }

    setActiveAiCardFlight(aiCardFlightQueue[0])
    setAiCardFlightQueue((currentQueue) => currentQueue.slice(1))
  }, [activeAiCardFlight, aiCardFlightQueue])

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
      const seenWinnerRound = readSeenWinnerRound(startupPage, session.token)
      hasWinnerSplashBaselineRef.current = true

      if (!latestRoundResult) {
        lastSeenRoundResultRef.current = null
        return
      }

      lastSeenRoundResultRef.current = latestRoundResult.roundNumber

      if (seenWinnerRound === null) {
        persistSeenWinnerRound(startupPage, session.token, latestRoundResult.roundNumber)
        return
      }

      if (latestRoundResult.roundNumber <= seenWinnerRound) {
        return
      }

      persistSeenWinnerRound(startupPage, session.token, latestRoundResult.roundNumber)
      setWinnerSplash(latestRoundResult)

      const timeoutId = window.setTimeout(() => {
        setWinnerSplash((current) =>
          current?.roundNumber === latestRoundResult.roundNumber ? null : current,
        )
      }, 2000)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    if (!latestRoundResult) {
      return
    }

    if (latestRoundResult.roundNumber === lastSeenRoundResultRef.current) {
      return
    }

    lastSeenRoundResultRef.current = latestRoundResult.roundNumber
    persistSeenWinnerRound(startupPage, session.token, latestRoundResult.roundNumber)
    setWinnerSplash(latestRoundResult)

    const timeoutId = window.setTimeout(() => {
      setWinnerSplash((current) =>
        current?.roundNumber === latestRoundResult.roundNumber ? null : current,
      )
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [latestRoundResult, session?.role, session?.token, snapshot, startupPage])

  const joinAsPlayer = async () => {
    await runAction(async () => {
      const response = await api.joinPlayer(playerName)
      persistSession({ role: 'player', token: response.token }, 'player')
      setSession({ role: 'player', token: response.token })
      setSnapshot(response.snapshot)
      setPlayerName('')
    })
  }

  const loginAsAdmin = async () => {
    await runAction(async () => {
      const response = await api.loginAdmin(adminCode)
      persistSession({ role: 'admin', token: response.token }, 'admin')
      setSession({ role: 'admin', token: response.token })
      setSnapshot(response.snapshot)
      setAdminCode('')
    })
  }

  const startGame = async (targetPlayerCount: number, roundLimit: number | null) => {
    if (!session || session.role !== 'admin') {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.startGame(session.token, targetPlayerCount, roundLimit)
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

  const playEntireHand = async () => {
    if (!session || session.role !== 'player' || !snapshot?.canFinishEntireHand) {
      return
    }

    await runAction(async () => {
      const nextSnapshot = await api.playCards(session.token, snapshot.viewerHand)
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

  const handleAiCardFlightComplete = useCallback(() => {
    setActiveAiCardFlight(null)
  }, [])

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
      className={`app-shell${startupPage === 'admin' ? ' app-shell--admin' : ' app-shell--player'}`}
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
        startupPage={startupPage}
        session={session}
        snapshot={snapshot}
        showRules={showRules}
        onLogout={logout}
        onToggleRules={() => setShowRules((current) => !current)}
      />

      {showRules ? <RulesPanel /> : null}

      {error ? <div className="error-banner">{error}</div> : null}
      {snapshot?.finalRankingMessage ? (
        <section className="message-box final-ranking-banner" aria-live="polite">
          <strong>Endrangliste</strong>
          <p>{snapshot.finalRankingMessage}</p>
          <div className="final-ranking-banner__entries">
            {finalRankingEntries.map((entry) => (
              <span key={entry.playerId}>
                {formatRankPosition(entry.rank)}: {entry.playerName} ({formatScore(entry.score)})
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="layout-grid">
        <AuthPanel
          startupPage={startupPage}
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
          aiCardFlight={activeAiCardFlight}
          pendingAiCardFlights={pendingAiCardFlights}
          isBusy={isBusy}
          onAiCardFlightComplete={handleAiCardFlightComplete}
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
          onPlayEntireHand={playEntireHand}
          onPassTurn={passTurn}
        />
        {session?.role === 'admin' ? <HistoryPanel currentRound={snapshot?.currentRound ?? null} /> : null}
      </section>
    </main>
  )
}

function getStartupPage(): StartupPage {
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'player'
}

function getPathForPage(page: StartupPage) {
  return page === 'admin' ? '/admin' : '/player'
}

function getStorageKey(page: StartupPage) {
  return `${LEGACY_STORAGE_KEY}-${page}`
}

function readStoredSession(storageKey: string) {
  const rawValue = window.localStorage.getItem(storageKey)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as SessionState
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

function loadStoredSession(page: StartupPage): SessionState | null {
  const pageSession = readStoredSession(getStorageKey(page))

  if (pageSession?.role === page) {
    return pageSession
  }

  const legacySession = readStoredSession(LEGACY_STORAGE_KEY)

  if (legacySession?.role !== page) {
    return null
  }

  persistSession(legacySession, page)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  return legacySession
}

function persistSession(session: SessionState, page: StartupPage) {
  window.localStorage.setItem(getStorageKey(page), JSON.stringify(session))
}

function clearSession(page: StartupPage) {
  window.localStorage.removeItem(getStorageKey(page))
}

function getSeenWinnerRoundStorageKey(page: StartupPage, token: string) {
  return `kartenreihen-seen-winner-round-${page}-${token}`
}

function readSeenWinnerRound(page: StartupPage, token: string) {
  const rawValue = window.sessionStorage.getItem(getSeenWinnerRoundStorageKey(page, token))
  if (!rawValue) {
    return null
  }

  const roundNumber = Number.parseInt(rawValue, 10)
  return Number.isNaN(roundNumber) ? null : roundNumber
}

function persistSeenWinnerRound(page: StartupPage, token: string, roundNumber: number) {
  window.sessionStorage.setItem(getSeenWinnerRoundStorageKey(page, token), roundNumber.toString())
}

function getTargetStackPosition(
  currentRound: NonNullable<GameSnapshot['currentRound']>,
  card: CardView,
): TableStackPosition {
  const row = currentRound.rows.find((candidate) => candidate.suit === card.suit)
  if (!row?.startCard) {
    return 'start'
  }

  const startIndex = getRankSortIndex(row.startCard.rank)
  const cardIndex = getRankSortIndex(card.rank)

  if (startIndex === Number.MAX_SAFE_INTEGER || cardIndex === Number.MAX_SAFE_INTEGER) {
    return 'start'
  }

  if (cardIndex === startIndex) {
    return 'start'
  }

  return cardIndex < startIndex ? 'lower' : 'upper'
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.'
}

export default App
