import { RankingPanel } from './RankingPanel'
import type { RankingEntry } from '../ranking'

interface FinalRankingOverlayProps {
  entries: RankingEntry[]
  finalRankingMessage: string
  viewerPlayerId: string | null
  viewerWantsAnotherRound: boolean | null
  playersWantAnotherRound: number
  playersRequiredForAnotherRound: number
  isBusy: boolean
  onVote: (wantsAnotherRound: boolean) => void
}

export function FinalRankingOverlay({
  entries,
  finalRankingMessage,
  viewerPlayerId,
  viewerWantsAnotherRound,
  playersWantAnotherRound,
  playersRequiredForAnotherRound,
  isBusy,
  onVote,
}: FinalRankingOverlayProps) {
  const missingVotes = Math.max(0, playersRequiredForAnotherRound - playersWantAnotherRound)
  const rematchStatus =
    viewerWantsAnotherRound === true
      ? missingVotes > 0
        ? `Deine Zusage ist gespeichert. Noch ${missingVotes} weitere Stimme${missingVotes === 1 ? '' : 'n'} fehlt${missingVotes === 1 ? '' : 'en'}.`
        : 'Alle realen Spieler sind bereit. Eine neue Partie mit zurueckgesetztem Ranking startet automatisch.'
      : viewerWantsAnotherRound === false
        ? 'Du hast vorerst abgelehnt. Eine neue Partie startet erst, wenn alle realen Spieler zustimmen.'
        : 'Wenn alle realen Spieler zustimmen, startet automatisch eine neue Partie mit zurueckgesetztem Ranking.'

  return (
    <div className="final-ranking-overlay" role="dialog" aria-modal="true" aria-labelledby="final-ranking-title">
      <div className="final-ranking-overlay__backdrop" />
      <section className="final-ranking-overlay__panel">
        <div className="final-ranking-overlay__copy">
          <p className="eyebrow">Partie beendet</p>
          <h2 id="final-ranking-title">Endrangliste</h2>
          <p>{finalRankingMessage}</p>
        </div>

        <RankingPanel
          title="Endrangliste"
          entries={entries}
          activePlayerId={viewerPlayerId}
          ariaLabel="Endrangliste"
        />

        <div className="final-ranking-overlay__rematch">
          <strong>Noch eine Partie?</strong>
          <p>{rematchStatus}</p>
          <span className="final-ranking-overlay__progress">
            {playersWantAnotherRound}/{playersRequiredForAnotherRound} reale Spieler sind bereit.
          </span>
          <div className="button-row">
            <button
              type="button"
              onClick={() => onVote(true)}
              disabled={isBusy || viewerWantsAnotherRound === true}
            >
              Ja, noch eine Partie
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onVote(false)}
              disabled={isBusy || viewerWantsAnotherRound === false}
            >
              Nein, diesmal nicht
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
