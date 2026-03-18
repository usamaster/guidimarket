import { useState, useCallback } from 'react'

interface BlackjackGameProps {
  credits: number
  onCreditsChange: (delta: number) => void
  onBack: () => void
}

const BET_OPTIONS = [1, 2, 5, 8, 10, 20, 50, 100]
const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

interface Card {
  rank: typeof RANKS[number]
  suit: typeof SUITS[number]
}

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardValue(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11 }
    else if (['K', 'Q', 'J'].includes(c.rank)) total += 10
    else total += parseInt(c.rank)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function CardEl({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="w-16 h-24 rounded-lg bg-primary/80 border-2 border-primary flex items-center justify-center text-white text-xl font-bold shadow-md">
        ?
      </div>
    )
  }
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`w-16 h-24 rounded-lg bg-white border-2 border-border flex flex-col items-center justify-center shadow-md ${red ? 'text-red-500' : 'text-gray-900'}`}>
      <span className="text-lg font-bold leading-none">{card.rank}</span>
      <span className="text-xl leading-none">{card.suit}</span>
    </div>
  )
}

type Phase = 'bet' | 'playing' | 'done'

export function BlackjackGame({ credits, onCreditsChange, onBack }: BlackjackGameProps) {
  const [bet, setBet] = useState(BET_OPTIONS[2])
  const [phase, setPhase] = useState<Phase>('bet')
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [result, setResult] = useState('')

  const deal = useCallback(() => {
    if (credits < bet) return
    onCreditsChange(-bet)
    const d = createDeck()
    const ph = [d.pop()!, d.pop()!]
    const dh = [d.pop()!, d.pop()!]
    setDeck(d)
    setPlayerHand(ph)
    setDealerHand(dh)
    setResult('')

    if (cardValue(ph) === 21) {
      const dealerBJ = cardValue(dh) === 21
      if (dealerBJ) {
        setResult('Push — both Blackjack')
        onCreditsChange(bet)
      } else {
        setResult('Blackjack! 🎉')
        onCreditsChange(bet * 2.5)
      }
      setPhase('done')
      return
    }
    setPhase('playing')
  }, [credits, bet, onCreditsChange])

  const hit = useCallback(() => {
    const d = [...deck]
    const hand = [...playerHand, d.pop()!]
    setDeck(d)
    setPlayerHand(hand)
    if (cardValue(hand) > 21) {
      setResult('Bust! 💥')
      setPhase('done')
    }
  }, [deck, playerHand])

  const stand = useCallback(() => {
    const d = [...deck]
    let dh = [...dealerHand]
    while (cardValue(dh) < 17) dh = [...dh, d.pop()!]
    setDeck(d)
    setDealerHand(dh)

    const pv = cardValue(playerHand)
    const dv = cardValue(dh)

    if (dv > 21) {
      setResult('Dealer busts — you win! 🎉')
      onCreditsChange(bet * 2)
    } else if (pv > dv) {
      setResult('You win! 🎉')
      onCreditsChange(bet * 2)
    } else if (pv === dv) {
      setResult('Push')
      onCreditsChange(bet)
    } else {
      setResult('Dealer wins 😔')
    }
    setPhase('done')
  }, [deck, dealerHand, playerHand, bet, onCreditsChange])

  const doubleDown = useCallback(() => {
    if (credits < bet) return
    onCreditsChange(-bet)
    const d = [...deck]
    const hand = [...playerHand, d.pop()!]
    setDeck(d)
    setPlayerHand(hand)

    if (cardValue(hand) > 21) {
      setResult('Bust! 💥')
      setPhase('done')
      return
    }

    let dh = [...dealerHand]
    while (cardValue(dh) < 17) dh = [...dh, d.pop()!]
    setDeck(d)
    setDealerHand(dh)

    const pv = cardValue(hand)
    const dv = cardValue(dh)
    const doubleBet = bet * 2

    if (dv > 21) {
      setResult('Dealer busts — you win! 🎉')
      onCreditsChange(doubleBet * 2)
    } else if (pv > dv) {
      setResult('You win! 🎉')
      onCreditsChange(doubleBet * 2)
    } else if (pv === dv) {
      setResult('Push')
      onCreditsChange(doubleBet)
    } else {
      setResult('Dealer wins 😔')
    }
    setPhase('done')
  }, [credits, bet, deck, playerHand, dealerHand, onCreditsChange])

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={onBack} className="text-xs text-text-muted hover:text-dark mb-4 cursor-pointer">← Back to Casino</button>
      <h2 className="text-xl font-bold text-dark mb-4">🃏 Blackjack</h2>

      {phase === 'bet' && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-text-muted">Chip:</span>
            {BET_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => setBet(b)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  bet === b ? 'bg-primary text-white' : 'bg-bg text-text-muted hover:text-dark border border-border'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <button
            onClick={deal}
            disabled={credits < bet}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
          >
            Deal ({bet} credits)
          </button>
        </>
      )}

      {(phase === 'playing' || phase === 'done') && (
        <div className="space-y-6">
          <div>
            <div className="text-xs text-text-muted mb-2">Dealer {phase === 'done' ? `(${cardValue(dealerHand)})` : ''}</div>
            <div className="flex gap-2 flex-wrap">
              {dealerHand.map((c, i) => (
                <CardEl key={i} card={c} hidden={phase === 'playing' && i === 1} />
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-text-muted mb-2">You ({cardValue(playerHand)})</div>
            <div className="flex gap-2 flex-wrap">
              {playerHand.map((c, i) => <CardEl key={i} card={c} />)}
            </div>
          </div>

          {phase === 'playing' && (
            <div className="flex gap-2">
              <button onClick={hit} className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors">Hit</button>
              <button onClick={stand} className="flex-1 bg-surface border border-border hover:bg-bg text-dark font-semibold py-2.5 rounded-xl cursor-pointer transition-colors">Stand</button>
              {playerHand.length === 2 && credits >= bet && (
                <button onClick={doubleDown} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors">Double</button>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-3">
              <div className="text-center text-lg font-bold text-dark">{result}</div>
              <button
                onClick={() => setPhase('bet')}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-xl cursor-pointer transition-colors"
              >
                Play again
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-center text-sm text-text-muted">
        Balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span> credits
      </div>
    </div>
  )
}
