import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatRank, formatSuit, getRankSortIndex, RANK_ORDER } from '../gameUi'
import { buildRankingEntries, formatRankPosition, formatScore, type RankingEntry } from '../ranking'
import type { AiCardFlightView, CardView, GameSnapshot, RowView, SessionState, TableStackPosition } from '../types'
import { CardFace } from './CardFace'

interface SeatingPanelProps {
  session: SessionState | null
  snapshot: GameSnapshot | null
  aiCardFlight: AiCardFlightView | null
  pendingAiCardFlights: AiCardFlightView[]
  isBusy: boolean
  onAiCardFlightComplete: () => void
  onStartGame: (targetPlayerCount: number, roundLimit: number | null) => void
  onEndGame: () => void
  onResetGame: () => void
}

export function SeatingPanel({
  session,
  snapshot,
  aiCardFlight,
  pendingAiCardFlights,
  isBusy,
  onAiCardFlightComplete,
  onStartGame,
  onEndGame,
  onResetGame,
}: SeatingPanelProps) {
  const roundTableRef = useRef<HTMLDivElement | null>(null)
  const seatRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const stackRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [flightOverlay, setFlightOverlay] = useState<FlightOverlay | null>(null)
  const [roundLimitInput, setRoundLimitInput] = useState('')
  const currentRound = snapshot?.currentRound ?? null
  const visibleRows = snapshot?.currentRound?.rows.filter((row) => !isRowCompleted(row)) ?? []
  const rankingEntries = useMemo(
    () => buildRankingEntries(snapshot?.players ?? [], snapshot?.results ?? []),
    [snapshot?.players, snapshot?.results],
  )
  const showInterimRanking = rankingEntries.length > 0 && !snapshot?.finalRankingMessage
  const parsedRoundLimit = parseRoundLimitInput(roundLimitInput)
  const isRoundLimitValid = parsedRoundLimit !== 'invalid'
  const lastPlayedCardByPlayerId = useMemo(
    () => buildLastPlayedCardMap(currentRound?.actions ?? []),
    [currentRound?.actions],
  )
  const hiddenCardCodesByStack = useMemo(() => {
    const entries = pendingAiCardFlights.map((flight) => [getStackId(flight.targetSuit, flight.targetStack), flight.card.code] as const)
    const hiddenCodes = new Map<string, Set<string>>()

    for (const [stackId, cardCode] of entries) {
      const codes = hiddenCodes.get(stackId) ?? new Set<string>()
      codes.add(cardCode)
      hiddenCodes.set(stackId, codes)
    }

    return hiddenCodes
  }, [pendingAiCardFlights])

  useEffect(() => {
    if (!aiCardFlight) {
      return
    }

    const roundTable = roundTableRef.current
    const sourceSeat = seatRefs.current[aiCardFlight.playerId]
    const targetStackId = getStackId(aiCardFlight.targetSuit, aiCardFlight.targetStack)
    const targetStack = stackRefs.current[targetStackId]

    if (!roundTable || !sourceSeat || !targetStack) {
      onAiCardFlightComplete()
      return
    }

    const roundTableRect = roundTable.getBoundingClientRect()
    const sourceRect = sourceSeat.getBoundingClientRect()
    const targetRect = targetStack.getBoundingClientRect()
    const width = Math.max(60, Math.min(92, sourceRect.width * 0.34))

    setFlightOverlay({
      id: aiCardFlight.id,
      card: aiCardFlight.card,
      left: sourceRect.left - roundTableRect.left + sourceRect.width / 2,
      top: sourceRect.top - roundTableRect.top + Math.min(sourceRect.height * 0.4, 52),
      width,
      deltaX:
        targetRect.left - roundTableRect.left + targetRect.width / 2 - (sourceRect.left - roundTableRect.left + sourceRect.width / 2),
      deltaY:
        targetRect.top - roundTableRect.top + Math.min(targetRect.height / 2, 48) - (sourceRect.top - roundTableRect.top + Math.min(sourceRect.height * 0.4, 52)),
      lift: Math.max(56, Math.min(128, Math.abs(targetRect.top - sourceRect.top) * 0.3 + 42)),
      targetStackId,
      isActive: false,
    })

    const activateTimeoutId = window.setTimeout(() => {
      setFlightOverlay((currentFlight) =>
        currentFlight?.id === aiCardFlight.id ? { ...currentFlight, isActive: true } : currentFlight,
      )
    }, 16)

    const completeTimeoutId = window.setTimeout(() => {
      setFlightOverlay((currentFlight) => (currentFlight?.id === aiCardFlight.id ? null : currentFlight))
      onAiCardFlightComplete()
    }, AI_CARD_FLIGHT_DURATION_MS)

    return () => {
      window.clearTimeout(activateTimeoutId)
      window.clearTimeout(completeTimeoutId)
    }
  }, [aiCardFlight, onAiCardFlightComplete])

  useEffect(() => {
    if (snapshot?.players.length) {
      return
    }

    setFlightOverlay(null)
  }, [snapshot?.players.length])

  return (
    <section className={`panel seating-panel${showInterimRanking ? ' seating-panel--with-ranking' : ''}`}>
      {showInterimRanking ? (
        <div className="seating-panel__floating-ranking">
          <RankingPanel
            entries={rankingEntries}
            activePlayerId={snapshot?.activePlayerId ?? null}
            roundNumber={currentRound?.number ?? null}
          />
        </div>
      ) : null}
      {session?.role !== 'player' ? (
        <div className="section-header">
          <h2>Lobby und Sitzordnung</h2>
          <div className="seating-panel__header-side">
            {session?.role === 'admin' && snapshot ? (
              <>
                <div className="button-row">
                  <button
                    onClick={() => onStartGame(3, parsedRoundLimit === 'invalid' ? null : parsedRoundLimit)}
                    disabled={isBusy || !snapshot.canStartGame || !isRoundLimitValid}
                  >
                    3 Spieler starten
                  </button>
                  <button
                    onClick={() => onStartGame(4, parsedRoundLimit === 'invalid' ? null : parsedRoundLimit)}
                    disabled={isBusy || !snapshot.canStartGame || !isRoundLimitValid}
                  >
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
                <label className="round-limit-field">
                  <span>Feste Rundenzahl</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={roundLimitInput}
                    onChange={(event) => setRoundLimitInput(event.target.value)}
                    placeholder="unbegrenzt"
                    inputMode="numeric"
                  />
                  <small>{isRoundLimitValid ? 'Leer lassen fuer unbegrenzt.' : 'Bitte eine ganze Zahl ab 1 eingeben.'}</small>
                </label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {snapshot?.players.length ? (
        <div className="round-table" ref={roundTableRef}>
          <div className="round-table__felt">
            {currentRound ? (
              <div className="table-round-layout">
                <div className="table-round-rows">
                  {visibleRows.map((row) => (
                    <div key={row.suit} className="table-round-row">
                      <RoundRowStacks
                        row={row}
                        startRank={currentRound.startRank}
                        flightTargetStackId={flightOverlay?.targetStackId ?? null}
                        hiddenCardCodesByStack={hiddenCardCodesByStack}
                        onRegisterStackRef={(stackId, element) => {
                          if (element) {
                            stackRefs.current[stackId] = element
                            return
                          }

                          delete stackRefs.current[stackId]
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <span className="round-table__label">Tischmitte</span>
                <strong>{snapshot.players.length} Spieler</strong>
                <span className="muted-copy">Wartet auf den Spielstart</span>
              </>
            )}
          </div>

          {snapshot.players.map((player, index) => {
            const lastPlayedCard = lastPlayedCardByPlayerId.get(player.id)

            return (
              <div
                key={player.id}
                className={`round-table__seat${player.isCurrentTurn ? ' round-table__seat--current-turn' : ''}`}
                ref={(element) => {
                  if (element) {
                    seatRefs.current[player.id] = element
                    return
                  }

                  delete seatRefs.current[player.id]
                }}
                style={getSeatStyle(index, snapshot.players.length)}
              >
                <article
                  className={`player-card${player.isViewer ? ' player-card--viewer' : ''}${player.isCurrentTurn ? ' player-card--current-turn' : ''}`}
                >
                  <div>
                    <strong className="player-name">
                      <span className="player-name__content">
                        <span>{player.name}</span>
                        {player.isRoundStarter ? (
                          <span
                            className="player-name__badge player-name__badge--starter"
                            aria-label="Hat die Runde eroeffnet"
                            title="Hat die Runde eroeffnet"
                          >
                            ⚑
                          </span>
                        ) : null}
                        {player.kind === 'Ai' ? (
                          <span className="player-name__badge" aria-label="AI-Spieler" title="AI-Spieler">
                            ✦
                          </span>
                        ) : null}
                        {lastPlayedCard ? (
                          <span
                            className="player-name__last-card"
                            aria-label={`Zuletzt gespielt: ${lastPlayedCard.label}`}
                            title={`Zuletzt gespielt: ${lastPlayedCard.label}`}
                          >
                            <CardFace card={lastPlayedCard} className="player-name__last-card-face" />
                          </span>
                        ) : null}
                      </span>
                      {player.isCurrentTurn ? (
                        <span className="player-name__turn-indicator" aria-label="Am Zug" title="Am Zug">
                          👈
                        </span>
                      ) : null}
                    </strong>
                  </div>
                </article>
              </div>
            )
          })}

          {flightOverlay ? (
            <div
              className={`ai-card-flight${flightOverlay.isActive ? ' ai-card-flight--active' : ''}`}
              style={
                {
                  left: `${flightOverlay.left}px`,
                  top: `${flightOverlay.top}px`,
                  width: `${flightOverlay.width}px`,
                  '--ai-flight-delta-x': `${flightOverlay.deltaX}px`,
                  '--ai-flight-delta-y': `${flightOverlay.deltaY}px`,
                  '--ai-flight-lift': `${flightOverlay.lift}px`,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              <CardFace card={flightOverlay.card} className="round-card-preview" />
            </div>
          ) : null}
        </div>
      ) : (
        <p>Noch keine Spieler in der Lobby.</p>
      )}
    </section>
  )
}

function RoundRowStacks({
  row,
  startRank,
  flightTargetStackId,
  hiddenCardCodesByStack,
  onRegisterStackRef,
}: {
  row: RowView
  startRank: string | null
  flightTargetStackId: string | null
  hiddenCardCodesByStack: Map<string, Set<string>>
  onRegisterStackRef: (stackId: string, element: HTMLDivElement | null) => void
}) {
  const startCard = row.startCard
  const lowerStackId = getStackId(row.suit, 'lower')
  const startStackId = getStackId(row.suit, 'start')
  const upperStackId = getStackId(row.suit, 'upper')
  const lowerCards = startCard
    ? buildVisibleBoundaryStackCards(
        row.lowestCard,
        startCard,
        'lower',
        hiddenCardCodesByStack.get(lowerStackId),
      )
    : []
  const upperCards = startCard
    ? buildVisibleBoundaryStackCards(
        row.highestCard,
        startCard,
        'upper',
        hiddenCardCodesByStack.get(upperStackId),
      )
    : []
  const visibleStartCards = filterHiddenCards(startCard ? [startCard] : [], hiddenCardCodesByStack.get(startStackId))
  const startPlaceholderCard =
    !startCard && visibleStartCards.length === 0 ? createPlaceholderStartCard(row.suit, startRank) : null

  return (
    <div className="table-round-row__stacks">
      <RoundCardStack
        cards={lowerCards}
        stackId={lowerStackId}
        isFlightTarget={flightTargetStackId === lowerStackId}
        onRegisterRef={onRegisterStackRef}
      />
      <RoundCardStack
        cards={visibleStartCards}
        placeholderCard={startPlaceholderCard}
        stackId={startStackId}
        isFlightTarget={flightTargetStackId === startStackId}
        onRegisterRef={onRegisterStackRef}
      />
      <RoundCardStack
        cards={upperCards}
        stackId={upperStackId}
        isFlightTarget={flightTargetStackId === upperStackId}
        onRegisterRef={onRegisterStackRef}
      />
    </div>
  )
}

function RankingPanel({
  entries,
  activePlayerId,
  roundNumber,
}: {
  entries: RankingEntry[]
  activePlayerId: string | null
  roundNumber: number | null
}) {
  return (
    <section className="ranking-panel" aria-label="Zwischenstand">
      <div className="ranking-panel__header">
        <strong className="ranking-panel__title">Zwischenstand</strong>
        {roundNumber ? <span className="ranking-panel__round">Runde {roundNumber}</span> : null}
      </div>
      <div className="ranking-panel__list">
        {entries.map((entry) => (
          <div
            key={entry.playerId}
            className={`ranking-panel__item${entry.playerId === activePlayerId ? ' ranking-panel__item--active' : ''}`}
          >
            <span className="ranking-panel__place">{formatRankPosition(entry.rank)}</span>
            <span className="ranking-panel__name">{entry.playerName}</span>
            <span className="ranking-panel__score">{formatScore(entry.score)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RoundCardStack({
  cards,
  placeholderCard = null,
  stackId,
  isFlightTarget,
  onRegisterRef,
}: {
  cards: CardView[]
  placeholderCard?: CardView | null
  stackId: string
  isFlightTarget: boolean
  onRegisterRef: (stackId: string, element: HTMLDivElement | null) => void
}) {
  return cards.length > 0 ? (
    <div
      className={`round-card-stack${isFlightTarget ? ' round-card-stack--flight-target' : ''}`}
      ref={(element) => onRegisterRef(stackId, element)}
    >
      <div className="round-card-stack__cards">
        {cards.map((card) => (
          <CardFace key={card.code} card={card} className="round-card-preview" />
        ))}
      </div>
    </div>
  ) : placeholderCard ? (
    <div
      className={`round-card-stack${isFlightTarget ? ' round-card-stack--flight-target' : ''}`}
      ref={(element) => onRegisterRef(stackId, element)}
      aria-label={`${placeholderCard.label} noch nicht gespielt`}
    >
      <CardFace card={placeholderCard} className="round-card-preview round-card-preview--placeholder" />
    </div>
  ) : (
    <div
      className={`round-card-stack round-card-stack--empty${isFlightTarget ? ' round-card-stack--flight-target' : ''}`}
      ref={(element) => onRegisterRef(stackId, element)}
      aria-hidden="true"
    >
      <div className="round-card-stack__empty" />
    </div>
  )
}

function buildVisibleBoundaryStackCards(
  boundaryCard: CardView | null,
  startCard: CardView,
  direction: 'lower' | 'upper',
  hiddenCardCodes: Set<string> | undefined,
) {
  const startIndex = getRankSortIndex(startCard.rank)
  const boundaryIndex = boundaryCard ? getRankSortIndex(boundaryCard.rank) : Number.MAX_SAFE_INTEGER

  if (startIndex === Number.MAX_SAFE_INTEGER || boundaryIndex === Number.MAX_SAFE_INTEGER) {
    return []
  }

  if (direction === 'lower') {
    if (boundaryIndex >= startIndex || !boundaryCard) {
      return []
    }

    if (!hiddenCardCodes?.has(boundaryCard.code)) {
      return [boundaryCard]
    }

    const fallbackIndex = boundaryIndex + 1
    return fallbackIndex < startIndex ? [createStackCard(boundaryCard.suit, RANK_ORDER[fallbackIndex])] : []
  }

  if (boundaryIndex <= startIndex || !boundaryCard) {
    return []
  }

  if (!hiddenCardCodes?.has(boundaryCard.code)) {
    return [boundaryCard]
  }

  const fallbackIndex = boundaryIndex - 1
  return fallbackIndex > startIndex ? [createStackCard(boundaryCard.suit, RANK_ORDER[fallbackIndex])] : []
}

function createStackCard(suit: string, rank: (typeof RANK_ORDER)[number]): CardView {
  return {
    code: `${suit}-${rank}`,
    suit,
    rank,
    label: `${formatRank(rank)} ${formatSuit(suit)}`,
  }
}

function createPlaceholderStartCard(suit: string, startRank: string | null) {
  if (!startRank || !RANK_ORDER.includes(startRank as (typeof RANK_ORDER)[number])) {
    return null
  }

  return createStackCard(suit, startRank as (typeof RANK_ORDER)[number])
}

function filterHiddenCards(cards: CardView[], hiddenCardCodes: Set<string> | undefined) {
  if (!hiddenCardCodes?.size) {
    return cards
  }

  return cards.filter((card) => !hiddenCardCodes.has(card.code))
}

function isRowCompleted(row: RowView) {
  return row.isOpen && row.lowestCard?.rank === 'Six' && row.highestCard?.rank === 'Ace'
}

function buildLastPlayedCardMap(actions: NonNullable<GameSnapshot['currentRound']>['actions']) {
  const lastPlayedCardByPlayerId = new Map<string, CardView>()

  for (const action of actions) {
    if (action.type !== 'play' || action.cards.length === 0) {
      continue
    }

    const lastPlayedCard = action.cards.at(-1)
    if (lastPlayedCard) {
      lastPlayedCardByPlayerId.set(action.playerId, lastPlayedCard)
    }
  }

  return lastPlayedCardByPlayerId
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

function getStackId(suit: string, stackPosition: TableStackPosition) {
  return `${suit}:${stackPosition}`
}

interface FlightOverlay {
  id: string
  card: CardView
  left: number
  top: number
  width: number
  deltaX: number
  deltaY: number
  lift: number
  targetStackId: string
  isActive: boolean
}

function parseRoundLimitInput(value: string): number | null | 'invalid' {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return null
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return 'invalid'
  }

  const parsedValue = Number.parseInt(trimmedValue, 10)
  return parsedValue >= 1 ? parsedValue : 'invalid'
}

const AI_CARD_FLIGHT_DURATION_MS = 1100
