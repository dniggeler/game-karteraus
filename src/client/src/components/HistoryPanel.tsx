import type { RoundView } from '../types'

interface HistoryPanelProps {
  currentRound: RoundView | null
}

export function HistoryPanel({ currentRound }: HistoryPanelProps) {
  return (
    <section className="panel history-panel">
      <h2>Zughistorie</h2>
      <div className="history-list">
        {currentRound?.actions.length ? (
          currentRound.actions
            .slice()
            .reverse()
            .map((action) => (
              <article key={`${action.turnNumber}-${action.type}`} className="history-entry">
                <strong>Zug {action.turnNumber}</strong>
                <p>{action.summary}</p>
              </article>
            ))
        ) : (
          <p className="muted-copy">Noch keine Aktionen in der aktuellen Runde.</p>
        )}
      </div>
    </section>
  )
}

