import type { CardView, GameSnapshot } from '../types'
import { formatSuit } from '../gameUi'

interface HandPanelProps {
  snapshot: GameSnapshot | null
  isBusy: boolean
  selectedCards: string[]
  playableCardCodes: Set<string>
  handRows: Array<{ suit: string; cards: CardView[] }>
  selectedCardCount: number
  onToggleCardSelection: (card: CardView) => void
  onPlaySelectedCards: () => void
  onPassTurn: () => void
}

export function HandPanel({
  snapshot,
  isBusy,
  selectedCards,
  playableCardCodes,
  handRows,
  selectedCardCount,
  onToggleCardSelection,
  onPlaySelectedCards,
  onPassTurn,
}: HandPanelProps) {
  return (
    <section className="panel hand-panel">
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
                          onClick={() => onToggleCardSelection(card)}
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
              onClick={onPlaySelectedCards}
              disabled={isBusy || !snapshot.canPlay || selectedCardCount === 0}
            >
              Ausgewaehlte Karten spielen
            </button>
            <button
              className="secondary-button"
              onClick={onPassTurn}
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
  )
}

function HandCardFace({ card }: { card: CardView }) {
  const rankGlyph = getRankGlyph(card.rank)
  const suitColor = getSuitColor(card.suit)

  return (
    <svg className="card-face" viewBox="0 0 140 196" role="img" aria-label={card.label}>
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

