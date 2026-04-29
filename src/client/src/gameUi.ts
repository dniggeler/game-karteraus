import type { CardView } from './types'

export const SUIT_ORDER = ['Hearts', 'Spades', 'Diamonds', 'Clubs'] as const
export const RANK_ORDER = [
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Jack',
  'Queen',
  'King',
  'Ace',
] as const

export function formatSuit(suit: string) {
  return (
    {
      Hearts: 'Herz',
      Diamonds: 'Karo',
      Clubs: 'Kreuz',
      Spades: 'Pik',
    }[suit] ?? suit
  )
}

export function formatRank(rank: string) {
  return (
    {
      Six: '6',
      Seven: '7',
      Eight: '8',
      Nine: '9',
      Ten: '10',
      Jack: 'Bube',
      Queen: 'Dame',
      King: 'Koenig',
      Ace: 'As',
    }[rank] ?? rank
  )
}

export function formatStatus(status: string) {
  return (
    {
      Lobby: 'Lobby',
      Active: 'Aktiv',
      Completed: 'Beendet',
      InProgress: 'Laeuft',
    }[status] ?? status
  )
}

export function compareCardsByRank(left: CardView, right: CardView) {
  return getRankSortIndex(left.rank) - getRankSortIndex(right.rank)
}

export function getRankSortIndex(rank: string) {
  const index = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number])
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

