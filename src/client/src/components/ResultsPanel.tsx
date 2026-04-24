import { formatRank } from '../gameUi'
import type { RoundResultView } from '../types'

interface ResultsPanelProps {
  results: RoundResultView[]
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  return (
    <section className="panel">
      <h2>Gewonnene Runden</h2>
      <div className="history-list">
        {results.length ? (
          results.map((result) => (
            <article key={result.roundNumber} className="history-entry">
              <strong>Runde {result.roundNumber}</strong>
              <p>
                {result.winnerName} gewinnt bei Startwert {formatRank(result.startRank)}.
              </p>
            </article>
          ))
        ) : (
          <p className="muted-copy">Noch keine beendeten Runden.</p>
        )}
      </div>
    </section>
  )
}

