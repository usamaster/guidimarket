import { useState, useRef, useCallback } from 'react'

interface RouletteGameProps {
  credits: number
  onCreditsChange: (delta: number) => void
  onBack: () => void
}

const BET_OPTIONS = [1, 2, 5, 8, 10, 20, 50, 100]

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
]

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

type BetType =
  | { kind: 'number'; value: number }
  | { kind: 'red' }
  | { kind: 'black' }
  | { kind: 'odd' }
  | { kind: 'even' }
  | { kind: '1-18' }
  | { kind: '19-36' }
  | { kind: '1st12' }
  | { kind: '2nd12' }
  | { kind: '3rd12' }

function payout(bt: BetType, result: number): number {
  switch (bt.kind) {
    case 'number': return bt.value === result ? 36 : 0
    case 'red': return RED_NUMBERS.has(result) ? 2 : 0
    case 'black': return result > 0 && !RED_NUMBERS.has(result) ? 2 : 0
    case 'odd': return result > 0 && result % 2 === 1 ? 2 : 0
    case 'even': return result > 0 && result % 2 === 0 ? 2 : 0
    case '1-18': return result >= 1 && result <= 18 ? 2 : 0
    case '19-36': return result >= 19 && result <= 36 ? 2 : 0
    case '1st12': return result >= 1 && result <= 12 ? 3 : 0
    case '2nd12': return result >= 13 && result <= 24 ? 3 : 0
    case '3rd12': return result >= 25 && result <= 36 ? 3 : 0
  }
}

function betLabel(bt: BetType): string {
  switch (bt.kind) {
    case 'number': return `#${bt.value}`
    case 'red': return 'Red'
    case 'black': return 'Black'
    case 'odd': return 'Odd'
    case 'even': return 'Even'
    case '1-18': return '1-18'
    case '19-36': return '19-36'
    case '1st12': return '1st 12'
    case '2nd12': return '2nd 12'
    case '3rd12': return '3rd 12'
  }
}

function numColor(n: number): string {
  if (n === 0) return 'bg-green-600'
  return RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-gray-900'
}

export function RouletteGame({ credits, onCreditsChange, onBack }: RouletteGameProps) {
  const [chip, setChip] = useState(BET_OPTIONS[2])
  const [bets, setBets] = useState<{ type: BetType; amount: number }[]>([])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [winAmount, setWinAmount] = useState<number | null>(null)
  const [angle, setAngle] = useState(0)
  const animRef = useRef<number>(0)

  const totalBet = bets.reduce((s, b) => s + b.amount, 0)

  const placeBet = useCallback((bt: BetType) => {
    if (spinning) return
    if (credits - totalBet < chip) return
    setBets(prev => {
      const key = JSON.stringify(bt)
      const existing = prev.findIndex(b => JSON.stringify(b.type) === key)
      if (existing >= 0) {
        const copy = [...prev]
        copy[existing] = { ...copy[existing], amount: copy[existing].amount + chip }
        return copy
      }
      return [...prev, { type: bt, amount: chip }]
    })
  }, [spinning, credits, totalBet, chip])

  const spin = useCallback(() => {
    if (bets.length === 0 || spinning) return

    onCreditsChange(-totalBet)
    setSpinning(true)
    setResult(null)
    setWinAmount(null)

    const resultIdx = Math.floor(Math.random() * WHEEL_NUMBERS.length)
    const resultNum = WHEEL_NUMBERS[resultIdx]
    const segAngle = 360 / WHEEL_NUMBERS.length
    const targetAngle = 360 * 5 + (360 - resultIdx * segAngle - segAngle / 2)

    const start = performance.now()
    const duration = 4000
    const startAngle = angle

    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const current = startAngle + (targetAngle - startAngle) * ease
      setAngle(current)

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setResult(resultNum)
        let totalWin = 0
        for (const b of bets) {
          const mult = payout(b.type, resultNum)
          totalWin += b.amount * mult
        }
        if (totalWin > 0) onCreditsChange(totalWin)
        setWinAmount(totalWin)
        setSpinning(false)
      }
    }
    animRef.current = requestAnimationFrame(animate)
  }, [bets, spinning, totalBet, angle, onCreditsChange])

  const clearBets = () => { if (!spinning) { setBets([]); setResult(null); setWinAmount(null) } }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-xs text-text-muted hover:text-dark mb-4 cursor-pointer">← Back to Casino</button>
      <h2 className="text-xl font-bold text-dark mb-4">🎡 Roulette</h2>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-text-muted">Chip:</span>
        {BET_OPTIONS.map(b => (
          <button
            key={b}
            onClick={() => setChip(b)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              chip === b ? 'bg-primary text-white' : 'bg-bg text-text-muted hover:text-dark border border-border'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="flex justify-center mb-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-primary" />
        <svg width="220" height="220" viewBox="-110 -110 220 220" className="drop-shadow-lg">
          <g transform={`rotate(${angle})`}>
            {WHEEL_NUMBERS.map((n, i) => {
              const seg = 360 / WHEEL_NUMBERS.length
              const a1 = (i * seg - 90) * Math.PI / 180
              const a2 = ((i + 1) * seg - 90) * Math.PI / 180
              const r = 100
              const x1 = Math.cos(a1) * r
              const y1 = Math.sin(a1) * r
              const x2 = Math.cos(a2) * r
              const y2 = Math.sin(a2) * r
              const mid = ((i + 0.5) * seg - 90) * Math.PI / 180
              const fill = n === 0 ? '#16a34a' : RED_NUMBERS.has(n) ? '#dc2626' : '#1a1a2e'
              return (
                <g key={i}>
                  <path d={`M0,0 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={fill} stroke="#333" strokeWidth="0.5" />
                  <text
                    x={Math.cos(mid) * 78}
                    y={Math.sin(mid) * 78}
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${(i + 0.5) * seg}, ${Math.cos(mid) * 78}, ${Math.sin(mid) * 78})`}
                  >
                    {n}
                  </text>
                </g>
              )
            })}
          </g>
          <circle cx="0" cy="0" r="20" fill="#2a2a3e" />
        </svg>
      </div>

      {result !== null && (
        <div className="text-center mb-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold ${result === 0 ? 'bg-green-600' : RED_NUMBERS.has(result) ? 'bg-red-600' : 'bg-gray-900'}`}>
            {result}
          </span>
          {winAmount !== null && (
            <div className={`mt-1 text-sm font-bold ${winAmount > 0 ? 'text-yes' : 'text-no'}`}>
              {winAmount > 0 ? `Won ${winAmount.toFixed(2)} credits! 🎉` : 'No win'}
            </div>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-3 mb-3">
        <div className="grid grid-cols-3 gap-1 mb-2">
          <button onClick={() => placeBet({ kind: 'number', value: 0 })} className="col-span-3 bg-green-600 text-white text-xs font-bold py-2 rounded cursor-pointer hover:opacity-80">0</button>
          {Array.from({ length: 12 }, (_, row) => {
            const nums = [row * 3 + 1, row * 3 + 2, row * 3 + 3]
            return nums.map(n => (
              <button
                key={n}
                onClick={() => placeBet({ kind: 'number', value: n })}
                className={`${numColor(n)} text-white text-xs font-bold py-2 rounded cursor-pointer hover:opacity-80`}
              >
                {n}
              </button>
            ))
          })}
        </div>

        <div className="grid grid-cols-3 gap-1 mb-2">
          <button onClick={() => placeBet({ kind: '1st12' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">1st 12</button>
          <button onClick={() => placeBet({ kind: '2nd12' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">2nd 12</button>
          <button onClick={() => placeBet({ kind: '3rd12' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">3rd 12</button>
        </div>

        <div className="grid grid-cols-6 gap-1">
          <button onClick={() => placeBet({ kind: '1-18' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">1-18</button>
          <button onClick={() => placeBet({ kind: 'even' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">Even</button>
          <button onClick={() => placeBet({ kind: 'red' })} className="bg-red-600 text-white text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:opacity-80">Red</button>
          <button onClick={() => placeBet({ kind: 'black' })} className="bg-gray-900 text-white text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:opacity-80">Black</button>
          <button onClick={() => placeBet({ kind: 'odd' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">Odd</button>
          <button onClick={() => placeBet({ kind: '19-36' })} className="bg-bg border border-border text-dark text-[10px] font-semibold py-1.5 rounded cursor-pointer hover:bg-primary/10">19-36</button>
        </div>
      </div>

      {bets.length > 0 && (
        <div className="bg-bg rounded-xl p-2 mb-3">
          <div className="flex flex-wrap gap-1">
            {bets.map((b, i) => (
              <span key={i} className="bg-surface border border-border text-xs px-2 py-1 rounded-full text-dark font-medium">
                {betLabel(b.type)} × {b.amount}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={spin}
          disabled={spinning || bets.length === 0}
          className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-semibold py-3 rounded-xl cursor-pointer transition-colors"
        >
          {spinning ? 'Spinning...' : `Spin (${totalBet} credits)`}
        </button>
        <button
          onClick={clearBets}
          disabled={spinning}
          className="px-4 bg-surface border border-border hover:bg-bg text-dark font-semibold py-3 rounded-xl cursor-pointer transition-colors disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className="mt-3 text-center text-sm text-text-muted">
        Balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span> credits
      </div>
    </div>
  )
}
