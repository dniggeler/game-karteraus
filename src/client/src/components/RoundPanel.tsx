import { formatRank, formatStatus, formatSuit } from '../gameUi'
import type { CardView, GameSnapshot } from '../types'
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
              <div className="row-details">
                <RoundCardDetail label="Start:" card={row.startCard} />
                <RoundCardDetail label="Unten:" card={row.lowestCard} />
                <RoundCardDetail label="Oben:" card={row.highestCard} />
              </div>
            ) : (
              <p className="muted-copy">Noch nicht eroeffnet</p>
            )}
          </article>
        )) ?? <p>Es wurde noch keine Runde gestartet.</p>}
      </div>
    </section>
  )
}

function RoundCardDetail({ label, card }: { label: string; card: CardView | null }) {
  return (
    <div className="round-card-detail">
      <span>{label}</span>
      {card ? (
        <CardFace card={card} className="round-card-preview" />
      ) : (
        <span className="muted-copy">-</span>
      )}
    </div>
  )
}

