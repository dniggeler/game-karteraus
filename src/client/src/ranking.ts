import type { GameSnapshot } from './types'

export interface RankingEntry {
  playerId: string
  playerName: string
  score: number
  rank: number
}

export function buildRankingEntries(
  players: GameSnapshot['players'],
  results: GameSnapshot['results'],
): RankingEntry[] {
  const totalScores = new Map<string, number>(players.map((player) => [player.id, 0] as const))

  for (const result of results) {
    for (const score of result.scores) {
      totalScores.set(score.playerId, (totalScores.get(score.playerId) ?? 0) + score.remainingCardCount)
    }
  }

  const orderedScores = [...new Set(players.map((player) => totalScores.get(player.id) ?? 0))].sort(
    (left, right) => left - right,
  )

  return players
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      score: totalScores.get(player.id) ?? 0,
      rank: orderedScores.indexOf(totalScores.get(player.id) ?? 0) + 1,
    }))
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.score - right.score ||
        left.playerName.localeCompare(right.playerName, 'de'),
    )
}

export function formatScore(score: number) {
  return `${score} ${score === 1 ? 'Punkt' : 'Punkte'}`
}

export function formatRankPosition(rank: number) {
  return `Platz ${rank}`
}
