import type { CardView, GameSnapshot } from '../types'
import { CardFace } from './CardFace'
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
                          <CardFace card={card} />
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
