import type { CardView, GameSnapshot, SessionResponse } from './types'
import { getApiBaseUrl } from './config'

const API_BASE_URL = getApiBaseUrl()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Die Anfrage ist fehlgeschlagen.')
  }

  return (await response.json()) as T
}

export const api = {
  joinPlayer: (name: string) =>
    request<SessionResponse>('/api/session/player', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  restorePlayer: (token: string) =>
    request<SessionResponse>(`/api/session/player/${token}`),

  loginAdmin: (code: string) =>
    request<SessionResponse>('/api/session/admin', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  restoreAdmin: (token: string) =>
    request<SessionResponse>(`/api/session/admin/${token}`),

  startGame: (adminToken: string, targetPlayerCount: number) =>
    request<GameSnapshot>('/api/admin/start', {
      method: 'POST',
      body: JSON.stringify({ adminToken, targetPlayerCount }),
    }),

  endGame: (adminToken: string) =>
    request<GameSnapshot>('/api/admin/end', {
      method: 'POST',
      body: JSON.stringify({ adminToken }),
    }),

  resetGame: (adminToken: string) =>
    request<{ reset: boolean }>('/api/admin/reset', {
      method: 'POST',
      body: JSON.stringify({ adminToken }),
    }),

  playCards: (playerToken: string, cards: CardView[]) =>
    request<GameSnapshot>('/api/game/play', {
      method: 'POST',
      body: JSON.stringify({
        playerToken,
        cards: cards.map((card) => ({ suit: card.suit, rank: card.rank })),
      }),
    }),

  passTurn: (playerToken: string) =>
    request<GameSnapshot>('/api/game/pass', {
      method: 'POST',
      body: JSON.stringify({ playerToken }),
    }),
}
