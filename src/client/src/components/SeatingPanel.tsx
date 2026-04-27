import type { CSSProperties } from 'react'
import { formatRank, formatStatus, formatSuit, getRankSortIndex, RANK_ORDER } from '../gameUi'
import type { CardView, GameSnapshot, RowView, SessionState } from '../types'
import { CardFace } from './CardFace'

interface SeatingPanelProps {
  session: SessionState | null
  snapshot: GameSnapshot | null
  isBusy: boolean
  onStartGame: (targetPlayerCount: number) => void
  onEndGame: () => void
  onResetGame: () => void
  onSelectStartRank: (rank: string) => void
}

export function SeatingPanel({
  session,
  snapshot,
  isBusy,
  onStartGame,
  onEndGame,
  onResetGame,
  onSelectStartRank,
}: SeatingPanelProps) {
  const currentRound = snapshot?.currentRound ?? null
  const visibleRows = snapshot?.currentRound?.rows.filter((row) => !isRowCompleted(row)) ?? []
  const totalScores = new Map<string, number>(
    snapshot?.players.map((player) => [player.id, 0] as const) ?? [],
  )

  for (const result of snapshot?.results ?? []) {
    for (const score of result.scores) {
      totalScores.set(score.playerId, (totalScores.get(score.playerId) ?? 0) + score.remainingCardCount)
    }
  }

  const rankingByPlayerId = buildRankingMap(snapshot?.players.map((player) => player.id) ?? [], totalScores)

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

      {snapshot?.canSelectStartRank ? (
        <div className="message-box action-box">
          <p>Du bestimmst den Startwert dieser Runde.</p>
          <div className="button-row">
            {snapshot.startRankOptions.map((rank) => (
              <button key={rank} onClick={() => onSelectStartRank(rank)} disabled={isBusy}>
                {formatRank(rank)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {snapshot?.players.length ? (
        <div className="round-table">
          <div className="round-table__felt">
            {currentRound ? (
              <div className="table-round-layout">
                <div className="table-round-summary">
                  <strong>Runde {currentRound.number}</strong>
                  <span className="muted-copy">{formatStatus(currentRound.phase)}</span>
                </div>
                <div className="table-round-rows">
                  {visibleRows.map((row) => (
                    <div key={row.suit} className="table-round-row">
                      <span className="table-round-row__label">{formatSuit(row.suit)}</span>
                      <RoundRowStacks row={row} startRank={currentRound.startRank} />
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

          {snapshot.players.map((player, index) => (
            <div
              key={player.id}
              className="round-table__seat"
              style={getSeatStyle(index, snapshot.players.length)}
            >
              <article
                className={`player-card${player.isViewer ? ' player-card--viewer' : ''}${player.isCurrentTurn ? ' player-card--current-turn' : ''}`}
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
                  <span>{formatScore(totalScores.get(player.id) ?? 0)}</span>
                  <span>{formatRankPosition(rankingByPlayerId.get(player.id) ?? rankingByPlayerId.size)}</span>
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

function RoundRowStacks({ row, startRank }: { row: RowView; startRank: string | null }) {
  const startCard = row.startCard
  const lowerCards = startCard ? buildStackCards(row.suit, row.lowestCard, startCard, 'lower') : []
  const upperCards = startCard ? buildStackCards(row.suit, row.highestCard, startCard, 'upper') : []
  const startPlaceholderCard = !startCard ? createPlaceholderStartCard(row.suit, startRank) : null

  return (
    <div className="table-round-row__stacks">
      <RoundCardStack cards={lowerCards} />
      <RoundCardStack cards={startCard ? [startCard] : []} placeholderCard={startPlaceholderCard} />
      <RoundCardStack cards={upperCards} />
    </div>
  )
}

function RoundCardStack({
  cards,
  placeholderCard = null,
}: {
  cards: CardView[]
  placeholderCard?: CardView | null
}) {
  return cards.length > 0 ? (
    <div className="round-card-stack">
      <div className="round-card-stack__cards">
        {cards.map((card) => (
          <CardFace key={card.code} card={card} className="round-card-preview" />
        ))}
      </div>
    </div>
  ) : placeholderCard ? (
    <div className="round-card-stack" aria-label={`${placeholderCard.label} noch nicht gespielt`}>
      <CardFace card={placeholderCard} className="round-card-preview round-card-preview--placeholder" />
    </div>
  ) : (
    <div className="round-card-stack round-card-stack--empty" aria-hidden="true">
      <div className="round-card-stack__empty" />
    </div>
  )
}

function buildStackCards(
  suit: string,
  boundaryCard: CardView | null,
  startCard: CardView,
  direction: 'lower' | 'upper',
) {
  const startIndex = getRankSortIndex(startCard.rank)
  const boundaryIndex = boundaryCard ? getRankSortIndex(boundaryCard.rank) : Number.MAX_SAFE_INTEGER

  if (startIndex === Number.MAX_SAFE_INTEGER || boundaryIndex === Number.MAX_SAFE_INTEGER) {
    return []
  }

  if (direction === 'lower') {
    if (boundaryIndex >= startIndex) {
      return []
    }

    return RANK_ORDER.slice(boundaryIndex, startIndex)
      .reverse()
      .map((rank) => createStackCard(suit, rank))
  }

  if (boundaryIndex <= startIndex) {
    return []
  }

  return RANK_ORDER.slice(startIndex + 1, boundaryIndex + 1).map((rank) =>
    createStackCard(suit, rank),
  )
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

function isRowCompleted(row: RowView) {
  return row.isOpen && row.lowestCard?.rank === 'Six' && row.highestCard?.rank === 'Ace'
}

function formatScore(score: number) {
  return `${score} ${score === 1 ? 'Punkt' : 'Punkte'}`
}

function formatRankPosition(rank: number) {
  return `Platz ${rank}`
}

function buildRankingMap(playerIds: string[], totalScores: Map<string, number>) {
  const orderedScores = [...new Set(playerIds.map((playerId) => totalScores.get(playerId) ?? 0))].sort(
    (left, right) => left - right,
  )

  return new Map(
    playerIds.map((playerId) => [
      playerId,
      orderedScores.indexOf(totalScores.get(playerId) ?? 0) + 1,
    ] as const),
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
