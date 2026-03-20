import { useState, useCallback, useRef } from 'react'

interface BlackjackGameProps {
  credits: number
  onCreditsChange: (delta: number) => void
  onBack: () => void
}

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000] as const

const CHIP_CLASS: Record<number, string> = {
  1: 'bg-zinc-200 text-zinc-900 border-zinc-400 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]',
  5: 'bg-red-600 text-white border-red-800 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  10: 'bg-blue-600 text-white border-blue-800 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  25: 'bg-emerald-600 text-white border-emerald-800 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  50: 'bg-orange-500 text-white border-orange-700 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  100: 'bg-zinc-900 text-amber-100 border-zinc-700 shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)]',
  500: 'bg-purple-700 text-purple-100 border-purple-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  1000: 'bg-amber-600 text-white border-amber-800 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  5000: 'bg-rose-700 text-white border-rose-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
  10000: 'bg-cyan-700 text-white border-cyan-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]',
}

function chipsFromTotal(total: number): number[] {
  const out: number[] = []
  let left = Math.floor(total)
  const denoms = [...CHIP_VALUES].sort((a, b) => b - a)
  for (const v of denoms) {
    while (left >= v) {
      out.push(v)
      left -= v
    }
  }
  return out
}

function ChipButton({ value, disabled, onPick }: { value: number; disabled: boolean; onPick: () => void }) {
  const cls = CHIP_CLASS[value] ?? CHIP_CLASS[100]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`relative w-12 h-12 rounded-full border-2 text-[10px] font-bold shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${cls}`}
    >
      <span className="absolute inset-0 flex items-center justify-center leading-tight px-0.5">{chipLabel(value)}</span>
    </button>
  )
}

function chipLabel(v: number) {
  if (v >= 10000) return `${v / 1000}k`
  if (v >= 1000) return `${v / 1000}k`
  return String(v)
}

function ChipStackVisual({ chips }: { chips: number[] }) {
  if (chips.length === 0) return null
  const show = chips.slice(-14)
  return (
    <div className="relative h-[72px] w-16 mx-auto">
      {show.map((v, i) => {
        const cls = CHIP_CLASS[v] ?? CHIP_CLASS[100]
        return (
          <div
            key={`${show.length}-${i}-${v}`}
            style={{ bottom: i * 4, zIndex: i }}
            className={`absolute left-1/2 -translate-x-1/2 w-11 h-11 rounded-full border-2 text-[9px] font-bold flex items-center justify-center shadow-md ${cls}`}
          >
            {chipLabel(v)}
          </div>
        )
      })}
    </div>
  )
}
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

function canDouble911(hand: Card[] | undefined): boolean {
  if (!hand || hand.length !== 2) return false
  const v = cardValue(hand)
  return v === 9 || v === 10 || v === 11
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
  const [wager, setWager] = useState({ total: 0, chips: [] as number[] })
  const [bet, setBet] = useState(1)
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

  const addChip = useCallback((v: number) => {
    setWager(w => {
      if (w.total + v > credits) return w
      return { total: w.total + v, chips: [...w.chips, v] }
    })
  }, [credits])

  const clearWager = useCallback(() => {
    setWager({ total: 0, chips: [] })
  }, [])

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
    const amount = Math.floor(wager.total)
    if (amount < 1 || credits < amount) return
    setBet(amount)
    onCreditsChange(-amount)
    const d = createDeck()
    const ph = [d.pop()!, d.pop()!]
    const dh = [d.pop()!, d.pop()!]
    dealingGen.current += 1
    setDeck(d)
    setPlayerHands([ph])
    setHandStakes([amount])
    setActiveHandIdx(0)
    setDealerHand(dh)
    setDealerReveal(false)
    setResult('')

    if (cardValue(ph) === 21) {
      const dealerBJ = cardValue(dh) === 21
      setDealerReveal(true)
      if (dealerBJ) {
        setResult('Push — both Blackjack')
        onCreditsChange(amount)
      } else {
        setResult('Blackjack!')
        onCreditsChange(amount * 2.5)
      }
      setPhase('done')
      return
    }
    setPhase('playing')
  }, [credits, wager.total, onCreditsChange])

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
    const h = playerHands[activeHandIdx]
    if (!canDouble911(h)) return
    const baseStakes = handStakes.length > 0 ? handStakes : [bet]
    const stakeNow = baseStakes[activeHandIdx]
    if (credits < stakeNow) return
    onCreditsChange(-stakeNow)
    const d = [...deck]
    const nh = playerHands.map((row, i) => (i === activeHandIdx ? [...row, d.pop()!] : row))
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
  const activeStake = handStakes[activeHandIdx] ?? bet

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-dark mb-3 cursor-pointer">
        ← Back to Casino
      </button>
      <h2 className="text-xl font-bold text-dark mb-3">🃏 Blackjack</h2>

      <div className="rounded-2xl border-4 border-amber-900/45 bg-gradient-to-b from-emerald-700 via-emerald-900 to-emerald-950 p-4 sm:p-6 shadow-xl ring-1 ring-black/20">
        {phase === 'bet' && (
          <div className="flex flex-col items-stretch">
            <p className="text-center text-xs font-semibold tracking-wider text-emerald-100/90 uppercase mb-4">Place your bet</p>
            <div className="relative min-h-[168px] flex flex-col items-center justify-center rounded-xl bg-black/20 border border-white/10 mb-4 overflow-hidden">
              <div className="absolute w-[85%] max-w-[280px] aspect-[2/1] rounded-[50%] border-2 border-dashed border-white/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10 flex flex-col items-center gap-1 py-2">
                <ChipStackVisual chips={wager.chips} />
                <div className="text-3xl font-bold text-amber-100 tabular-nums drop-shadow-md">
                  {wager.total > 0 ? wager.total.toLocaleString() : '—'}
                </div>
                <div className="text-[11px] text-emerald-200/85 font-medium">Total bet</div>
              </div>
            </div>
            <p className="text-center text-[11px] text-emerald-200/70 mb-2">Tap chips to stack · max your balance</p>
            <div className="flex flex-wrap justify-center gap-2.5 mb-4 px-1">
              {CHIP_VALUES.map(v => (
                <ChipButton key={v} value={v} disabled={wager.total + v > credits} onPick={() => addChip(v)} />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearWager}
                disabled={wager.total === 0}
                className="flex-1 py-3 rounded-xl border-2 border-white/20 bg-black/25 text-emerald-100 font-semibold text-sm hover:bg-black/35 disabled:opacity-30 cursor-pointer transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={deal}
                disabled={wager.total < 1 || credits < wager.total}
                className="flex-[1.4] py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg cursor-pointer transition-colors"
              >
                Deal {wager.total > 0 ? `(${wager.total.toLocaleString()})` : ''}
              </button>
            </div>
          </div>
        )}

        {(phase === 'playing' || phase === 'done') && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200/80 px-1">
              <span>
                Table min 1 · Bet: <span className="text-amber-200 font-bold">{bet.toLocaleString()}</span>
              </span>
              <span className="text-emerald-200/65">Double on 9, 10, or 11</span>
            </div>
            <div>
              <div className="text-xs text-emerald-100/90 mb-2 font-medium">
                Dealer {phase === 'done' || dealerReveal ? `(${cardValue(dealerHand)})` : ''}
              </div>
              <div className="flex gap-2 flex-wrap perspective-midrange">
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
                    className={`text-xs mb-2 font-medium ${hi === activeHandIdx && showActions ? 'text-amber-200' : 'text-emerald-200/80'}`}
                  >
                    {playerHands.length > 1 ? `Hand ${hi + 1}` : 'You'} ({cardValue(hand)})
                    {playerHands.length > 1 && hi === activeHandIdx && showActions ? ' — your turn' : ''}
                  </div>
                  <div className="flex gap-2 flex-wrap perspective-midrange">
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
                  className="flex-1 min-w-[100px] bg-emerald-950/80 border border-white/20 hover:bg-emerald-950 text-emerald-50 font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Stand
                </button>
                {canDouble911(playerHands[activeHandIdx]) && credits >= activeStake && (
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
              <div className="text-center text-sm text-emerald-200/90 animate-pulse">Dealer plays…</div>
            )}

            {phase === 'done' && (
              <div className="space-y-3">
                <div className="text-center text-lg font-bold text-amber-100 drop-shadow-sm px-2">{result}</div>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('bet')
                    setWager({ total: bet, chips: chipsFromTotal(bet) })
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors shadow-lg"
                >
                  Play again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-text-muted">
        Balance: <span className="font-bold text-dark">{credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> credits
      </div>
    </div>
  )
}
