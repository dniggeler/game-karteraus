import { formatRank, formatStatus, formatSuit, getRankSortIndex, RANK_ORDER } from '../gameUi'
import type { CardView, GameSnapshot, RowView } from '../types'
import { CardFace } from './CardFace'

interface RoundPanelProps {
  snapshot: GameSnapshot | null
  isBusy: boolean
  onSelectStartRank: (rank: string) => void
}

export function RoundPanel({ snapshot, isBusy, onSelectStartRank }: RoundPanelProps) {
  return (
    <section className="panel table-panel">
      <div className="section-header">
        <h2>Aktuelle Runde</h2>
        {snapshot?.currentRound ? (
          <span className="session-pill">
            Runde {snapshot.currentRound.number} · {formatStatus(snapshot.currentRound.phase)}
          </span>
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

      <div className="row-grid">
        {snapshot?.currentRound?.rows.map((row) => (
          <article key={row.suit} className="row-card">
            <h3>{formatSuit(row.suit)}</h3>
            {row.isOpen ? (
              <RoundRowStacks row={row} />
            ) : (
              <p className="muted-copy">Noch nicht eroeffnet</p>
            )}
          </article>
        )) ?? <p>Es wurde noch keine Runde gestartet.</p>}
      </div>
    </section>
  )
}

function RoundRowStacks({ row }: { row: RowView }) {
  const startCard = row.startCard

  if (!startCard) {
    return <p className="muted-copy">Noch nicht eroeffnet</p>
  }

  const lowerCards = buildStackCards(row.suit, row.lowestCard, startCard, 'lower')
  const upperCards = buildStackCards(row.suit, row.highestCard, startCard, 'upper')

  return (
    <div className="round-row-stacks">
      <RoundCardStack label="Unten" cards={lowerCards} />
      <RoundCardStack label="Start" cards={[startCard]} />
      <RoundCardStack label="Oben" cards={upperCards} />
    </div>
  )
}

function RoundCardStack({ label, cards }: { label: string; cards: CardView[] }) {
  return (
    <div className="round-card-stack">
      <span className="round-card-stack__label">{label}</span>
      {cards.length > 0 ? (
        <div className="round-card-stack__cards">
          {cards.map((card) => (
            <CardFace key={card.code} card={card} className="round-card-preview" />
          ))}
        </div>
      ) : (
        <div className="round-card-stack__empty" aria-hidden="true" />
      )}
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

