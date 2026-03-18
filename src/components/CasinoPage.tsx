import { useState } from 'react'
import { PachinkoGame } from './PachinkoGame'
import { BlackjackGame } from './BlackjackGame'
import { RouletteGame } from './RouletteGame'

interface CasinoPageProps {
  credits: number
  onCreditsChange: (delta: number) => void
}

type Game = null | 'pachinko' | 'blackjack' | 'roulette'

const GAMES = [
  { id: 'pachinko' as const, emoji: '📍', name: 'Pachinko', desc: 'Drop coins through the pyramid of pins' },
  { id: 'blackjack' as const, emoji: '🃏', name: 'Blackjack', desc: 'Beat the dealer to 21' },
  { id: 'roulette' as const, emoji: '🎡', name: 'Roulette', desc: 'Spin the wheel, place your bets' },
]

export function CasinoPage({ credits, onCreditsChange }: CasinoPageProps) {
  const [game, setGame] = useState<Game>(null)

  if (game === 'pachinko') return <PachinkoGame credits={credits} onCreditsChange={onCreditsChange} onBack={() => setGame(null)} />
  if (game === 'blackjack') return <BlackjackGame credits={credits} onCreditsChange={onCreditsChange} onBack={() => setGame(null)} />
  if (game === 'roulette') return <RouletteGame credits={credits} onCreditsChange={onCreditsChange} onBack={() => setGame(null)} />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-dark mb-1">🎰 Casino</h1>
      <p className="text-sm text-text-muted mb-6">Wager your credits — if you dare</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            className="bg-surface border border-border rounded-xl p-6 text-left hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group"
          >
            <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform inline-block">{g.emoji}</span>
            <h3 className="text-base font-bold text-dark mb-1">{g.name}</h3>
            <p className="text-xs text-text-muted">{g.desc}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 text-center text-sm text-text-muted">
        Your balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span> credits
      </div>
    </div>
  )
}
