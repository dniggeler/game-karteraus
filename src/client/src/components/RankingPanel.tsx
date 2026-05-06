import { formatRankPosition, formatScore, type RankingEntry } from '../ranking'

interface RankingPanelProps {
  title: string
  entries: RankingEntry[]
  activePlayerId: string | null
  roundNumber?: number | null
  ariaLabel?: string
}

export function RankingPanel({
  title,
  entries,
  activePlayerId,
  roundNumber = null,
  ariaLabel = title,
}: RankingPanelProps) {
  return (
    <section className="ranking-panel" aria-label={ariaLabel}>
      <div className="ranking-panel__header">
        <strong className="ranking-panel__title">{title}</strong>
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
