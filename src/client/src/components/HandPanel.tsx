import { useEffect, useRef } from 'react'
import type { CardView, GameSnapshot } from '../types'
import { CardFace } from './CardFace'

interface HandPanelProps {
  snapshot: GameSnapshot | null
  isBusy: boolean
  selectedCards: string[]
  playableCardCodes: Set<string>
  handRows: Array<{ suit: string; cards: CardView[] }>
  selectedCardCount: number
  onToggleCardSelection: (card: CardView) => void
  onPlayCard: (card: CardView) => void
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
  onPlayCard,
  onPlaySelectedCards,
  onPassTurn,
}: HandPanelProps) {
  const pendingClickRef = useRef<number | null>(null)
  const handCards = handRows.flatMap((row) => row.cards)

  useEffect(() => {
    return () => {
      if (pendingClickRef.current !== null) {
        window.clearTimeout(pendingClickRef.current)
      }
    }
  }, [])

  function handleCardClick(card: CardView) {
    if (pendingClickRef.current !== null) {
      window.clearTimeout(pendingClickRef.current)
    }

    pendingClickRef.current = window.setTimeout(() => {
      pendingClickRef.current = null
      onToggleCardSelection(card)
    }, 200)
  }

  function handleCardDoubleClick(card: CardView, isPlayable: boolean) {
    if (pendingClickRef.current !== null) {
      window.clearTimeout(pendingClickRef.current)
      pendingClickRef.current = null
    }

    if (isPlayable) {
      onPlayCard(card)
    }
  }

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
            <div className="hand-grid">
              {handCards.length ? (
                handCards.map((card) => {
                  const isSelected = selectedCards.includes(card.code)
                  const isPlayable = playableCardCodes.has(card.code)

                  return (
                    <button
                      key={card.code}
                      className={`card-button${isSelected ? ' card-button--selected' : ''}${isPlayable ? ' card-button--playable' : ''}`}
                      onClick={() => handleCardClick(card)}
                      onDoubleClick={() => handleCardDoubleClick(card, isPlayable)}
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
