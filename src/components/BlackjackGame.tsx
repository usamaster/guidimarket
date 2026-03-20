import { useState, useCallback, useRef } from 'react'

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

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function CardEl({
  card,
  hidden,
  delayMs,
  flip,
}: {
  card: Card
  hidden?: boolean
  delayMs?: number
  flip?: boolean
}) {
  if (hidden) {
    return (
      <div
        style={{ animationDelay: `${delayMs ?? 0}ms` }}
        className="w-16 h-24 rounded-lg bg-primary/80 border-2 border-primary flex items-center justify-center text-white text-xl font-bold shadow-md bj-card-in"
      >
        ?
      </div>
    )
  }
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <div
      style={{ animationDelay: `${delayMs ?? 0}ms` }}
      className={`w-16 h-24 rounded-lg bg-card border-2 border-border flex flex-col items-center justify-center shadow-md bj-card-in ${flip ? 'bj-flip-in' : ''} ${red ? 'text-red-500' : 'text-card-ink'}`}
    >
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
  const [playerHands, setPlayerHands] = useState<Card[][]>([])
  const [activeHandIdx, setActiveHandIdx] = useState(0)
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [dealerReveal, setDealerReveal] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [result, setResult] = useState('')
  const [handStakes, setHandStakes] = useState<number[]>([])
  const dealingGen = useRef(0)

  const finishDealer = useCallback(
    async (pile: Card[], dh: Card[], hands: Card[][], stakes: number[]) => {
      setResolving(true)
      setDealerReveal(true)
      await delay(420)
      let curPile = [...pile]
      let dealer = [...dh]
      const allBust = hands.every(h => cardValue(h) > 21)
      if (!allBust) {
        while (cardValue(dealer) < 17) {
          await delay(480)
          const next = curPile.pop()
          if (!next) break
          dealer = [...dealer, next]
          setDealerHand([...dealer])
          setDeck([...curPile])
        }
      }
      const dv = cardValue(dealer)
      const msgs: string[] = []
      let delta = 0
      for (let i = 0; i < hands.length; i++) {
        const stake = stakes[i] ?? bet
        const pv = cardValue(hands[i])
        const label = hands.length > 1 ? `Hand ${i + 1}: ` : ''
        if (pv > 21) {
          msgs.push(`${label}Bust`)
          continue
        }
        if (dv > 21) {
          delta += stake * 2
          msgs.push(`${label}Win`)
        } else if (pv > dv) {
          delta += stake * 2
          msgs.push(`${label}Win`)
        } else if (pv === dv) {
          delta += stake
          msgs.push(`${label}Push`)
        } else {
          msgs.push(`${label}Lose`)
        }
      }
      setResult(msgs.join(' · '))
      onCreditsChange(delta)
      setPhase('done')
      setResolving(false)
    },
    [bet, onCreditsChange],
  )

  const deal = useCallback(() => {
    if (credits < bet) return
    onCreditsChange(-bet)
    const d = createDeck()
    const ph = [d.pop()!, d.pop()!]
    const dh = [d.pop()!, d.pop()!]
    dealingGen.current += 1
    setDeck(d)
    setPlayerHands([ph])
    setHandStakes([bet])
    setActiveHandIdx(0)
    setDealerHand(dh)
    setDealerReveal(false)
    setResult('')

    if (cardValue(ph) === 21) {
      const dealerBJ = cardValue(dh) === 21
      setDealerReveal(true)
      if (dealerBJ) {
        setResult('Push — both Blackjack')
        onCreditsChange(bet)
      } else {
        setResult('Blackjack!')
        onCreditsChange(bet * 2.5)
      }
      setPhase('done')
      return
    }
    setPhase('playing')
  }, [credits, bet, onCreditsChange])

  const hit = useCallback(async () => {
    if (resolving) return
    const d = [...deck]
    const nh = playerHands.map((h, i) => (i === activeHandIdx ? [...h, d.pop()!] : h))
    const hand = nh[activeHandIdx]
    setDeck(d)
    setPlayerHands(nh)
    const v = cardValue(hand)
    const multi = playerHands.length > 1
    const idx = activeHandIdx
    const stakes = handStakes.length > 0 ? handStakes : [bet]

    if (v > 21) {
      if (multi && idx === 0) {
        setActiveHandIdx(1)
        return
      }
      if (multi && idx === 1) {
        await finishDealer(d, dealerHand, nh, stakes)
        return
      }
      setResult('Bust!')
      setDealerReveal(true)
      setPhase('done')
      return
    }

    if (v === 21) {
      if (multi && idx === 0) {
        setActiveHandIdx(1)
        return
      }
      await finishDealer(d, dealerHand, nh, stakes)
    }
  }, [resolving, deck, playerHands, activeHandIdx, dealerHand, handStakes, bet, finishDealer])

  const stand = useCallback(async () => {
    if (resolving) return
    if (playerHands.length > 1 && activeHandIdx === 0) {
      setActiveHandIdx(1)
      return
    }
    await finishDealer(deck, dealerHand, playerHands, handStakes)
  }, [resolving, deck, dealerHand, playerHands, handStakes, activeHandIdx, finishDealer])

  const split = useCallback(() => {
    if (resolving || phase !== 'playing') return
    if (playerHands.length !== 1) return
    const h = playerHands[0]
    if (h.length !== 2 || h[0].rank !== h[1].rank) return
    if (credits < bet) return
    onCreditsChange(-bet)
    const d = [...deck]
    const a = h[0]
    const b = h[1]
    const nc1 = d.pop()!
    const nc2 = d.pop()!
    setDeck(d)
    const h1: Card[][] = [[a, nc1], [b, nc2]]
    setPlayerHands(h1)
    setHandStakes([bet, bet])
    const v0 = cardValue(h1[0])
    const v1 = cardValue(h1[1])
    if (v0 === 21 && v1 === 21) {
      void finishDealer(d, dealerHand, h1, [bet, bet])
      return
    }
    if (v0 === 21) {
      setActiveHandIdx(1)
      return
    }
    setActiveHandIdx(0)
  }, [resolving, phase, playerHands, credits, bet, onCreditsChange, deck, dealerHand, finishDealer])

  const doubleDown = useCallback(async () => {
    if (resolving) return
    if (credits < bet) return
    const h = playerHands[activeHandIdx]
    if (h.length !== 2) return
    onCreditsChange(-bet)
    const d = [...deck]
    const nh = playerHands.map((row, i) => (i === activeHandIdx ? [...row, d.pop()!] : row))
    const baseStakes = handStakes.length > 0 ? handStakes : [bet]
    const stakesAfter = baseStakes.map((s, i) => (i === activeHandIdx ? s * 2 : s))
    setDeck(d)
    setPlayerHands(nh)
    setHandStakes(stakesAfter)
    const hand = nh[activeHandIdx]
    const v = cardValue(hand)
    const multi = playerHands.length > 1
    const idx = activeHandIdx

    if (v > 21) {
      if (multi && idx === 0) {
        setActiveHandIdx(1)
        return
      }
      if (multi && idx === 1) {
        await finishDealer(d, dealerHand, nh, stakesAfter)
        return
      }
      setResult('Bust!')
      setDealerReveal(true)
      setPhase('done')
      return
    }

    if (multi && idx === 0) {
      setActiveHandIdx(1)
      return
    }
    await finishDealer(d, dealerHand, nh, stakesAfter)
  }, [resolving, credits, bet, playerHands, activeHandIdx, deck, dealerHand, handStakes, finishDealer, onCreditsChange])

  const splittable =
    phase === 'playing' &&
    !resolving &&
    playerHands.length === 1 &&
    playerHands[0]?.length === 2 &&
    playerHands[0][0].rank === playerHands[0][1].rank

  const showActions = phase === 'playing' && !resolving
  const gen = dealingGen.current

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-dark mb-4 cursor-pointer">
        ← Back to Casino
      </button>
      <h2 className="text-xl font-bold text-dark mb-4">🃏 Blackjack</h2>

      {phase === 'bet' && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-text-muted">Chip:</span>
            {BET_OPTIONS.map(b => (
              <button
                type="button"
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
            type="button"
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
            <div className="text-xs text-text-muted mb-2">
              Dealer {phase === 'done' || dealerReveal ? `(${cardValue(dealerHand)})` : ''}
            </div>
            <div className="flex gap-2 flex-wrap [perspective:800px]">
              {dealerHand.map((c, i) => (
                <CardEl
                  key={`d-${gen}-${i}-${dealerReveal && i === 1 ? 'v' : 'h'}`}
                  card={c}
                  hidden={!dealerReveal && phase === 'playing' && i === 1}
                  delayMs={i * 95}
                  flip={dealerReveal && i === 1}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {playerHands.map((hand, hi) => (
              <div key={`p-${gen}-${hi}`}>
                <div
                  className={`text-xs mb-2 ${hi === activeHandIdx && showActions ? 'text-primary font-semibold' : 'text-text-muted'}`}
                >
                  {playerHands.length > 1 ? `Hand ${hi + 1}` : 'You'} ({cardValue(hand)})
                  {playerHands.length > 1 && hi === activeHandIdx && showActions ? ' — your turn' : ''}
                </div>
                <div className="flex gap-2 flex-wrap [perspective:800px]">
                  {hand.map((c, ci) => (
                    <CardEl key={`p-${gen}-${hi}-${ci}`} card={c} delayMs={(hi * 3 + ci + 2) * 95} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {showActions && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void hit()}
                className="flex-1 min-w-[100px] bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Hit
              </button>
              <button
                type="button"
                onClick={() => void stand()}
                className="flex-1 min-w-[100px] bg-surface border border-border hover:bg-bg text-dark font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Stand
              </button>
              {playerHands[activeHandIdx]?.length === 2 && credits >= bet && (
                <button
                  type="button"
                  onClick={() => void doubleDown()}
                  className="flex-1 min-w-[100px] bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Double
                </button>
              )}
              {splittable && credits >= bet && (
                <button
                  type="button"
                  onClick={split}
                  className="flex-1 min-w-[100px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Split
                </button>
              )}
            </div>
          )}

          {resolving && (
            <div className="text-center text-sm text-text-muted animate-pulse">Dealer plays…</div>
          )}

          {phase === 'done' && (
            <div className="space-y-3">
              <div className="text-center text-lg font-bold text-dark">{result}</div>
              <button
                type="button"
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
