export interface SessionState {
  role: 'player' | 'admin'
  token: string
}

export interface SessionResponse {
  token: string
  snapshot: GameSnapshot
}

export interface GameSnapshot {
  viewerRole: 'player' | 'admin'
  matchStatus: string
  humanPlayers: number
  targetPlayerCount: number | null
  canStartGame: boolean
  canEndGame: boolean
  canSelectStartRank: boolean
  canPlay: boolean
  canPass: boolean
  canFinishEntireHand: boolean
  message: string | null
  viewerPlayerId: string | null
  activePlayerId: string | null
  startValueChooserPlayerId: string | null
  players: PlayerView[]
  viewerHand: CardView[]
  playableCards: CardView[]
  startRankOptions: string[]
  currentRound: RoundView | null
  results: RoundResultView[]
}

export interface PlayerView {
  id: string
  name: string
  kind: string
  cardCount: number
  isCurrentTurn: boolean
  isStartValueChooser: boolean
  isViewer: boolean
}

export interface CardView {
  code: string
  suit: string
  rank: string
  label: string
}

export interface RowView {
  suit: string
  isOpen: boolean
  lowestCard: CardView | null
  highestCard: CardView | null
  startCard: CardView | null
}

export interface ActionView {
  turnNumber: number
  type: string
  playerId: string
  playerName: string
  summary: string
  cards: CardView[]
}

export interface RoundView {
  number: number
  phase: string
  startRank: string | null
  rows: RowView[]
  actions: ActionView[]
}

export interface RoundResultView {
  roundNumber: number
  winnerPlayerId: string
  winnerName: string
  startRank: string
}
