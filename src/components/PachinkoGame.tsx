import { useState, useRef, useEffect, useCallback } from 'react'

interface PachinkoGameProps {
  credits: number
  onCreditsChange: (delta: number) => void
  onBack: () => void
}

const BET_OPTIONS = [1, 2, 5, 8, 10, 20, 50, 100]

const ROWS = 12
const COLS = ROWS + 1
const PIN_GAP = 38
const PIN_R = 4
const BALL_R = 7
const WIDTH = (COLS + 2) * PIN_GAP
const HEIGHT = (ROWS + 4) * PIN_GAP

const ODDS_SETS: { id: string; name: string; color: string; edge: string; mults: number[] }[] = [
  { id: 'mild',     name: '🟢 Mild',     color: '#22c55e', edge: '~1%',  mults: [50, 14, 4, 2, 1.4, 1.1, 0.9, 1.1, 1.4, 2, 4, 14, 50] },
  { id: 'standard', name: '🔵 Standard', color: '#3b82f6', edge: '~2%',  mults: [250, 25, 7, 2.5, 1.3, 0.8, 0.6, 0.8, 1.3, 2.5, 7, 25, 250] },
  { id: 'spicy',    name: '🟠 Spicy',    color: '#f97316', edge: '~2%',  mults: [800, 35, 6, 1.8, 0.9, 0.5, 0.4, 0.5, 0.9, 1.8, 6, 35, 800] },
  { id: 'brutal',   name: '🔴 Brutal',   color: '#ef4444', edge: '~3%',  mults: [1500, 25, 4, 1.2, 0.5, 0.3, 0.2, 0.3, 0.5, 1.2, 4, 25, 1500] },
  { id: 'degen',    name: '💀 Degen',    color: '#a855f7', edge: '~3%',  mults: [2000, 15, 2, 0.5, 0.2, 0.1, 0.05, 0.1, 0.2, 0.5, 2, 15, 2000] },
  { id: 'tight',    name: '🧊 Tight',    color: '#64748b', edge: '~1%',  mults: [25, 10, 4.5, 2.2, 1.4, 1.1, 0.9, 1.1, 1.4, 2.2, 4.5, 10, 25] },
]

function slotColor(m: number): string {
  if (m >= 100) return '#ef4444'
  if (m >= 10) return '#f97316'
  if (m >= 2) return '#eab308'
  if (m >= 0.5) return '#22c55e'
  if (m > 0) return '#6b7280'
  return '#374151'
}

function galtonSlot(): number {
  let pos = 0
  for (let i = 0; i < ROWS; i++) {
    pos += Math.random() < 0.5 ? -1 : 1
  }
  const slot = (pos + ROWS) / 2
  return Math.max(0, Math.min(COLS - 1, slot))
}

interface AnimBall {
  id: number
  path: { x: number; y: number }[]
  slot: number
  bet: number
  startTime: number
  done: boolean
}

function buildPath(slot: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  const startX = WIDTH / 2
  pts.push({ x: startX, y: PIN_GAP * 0.5 })

  const center = ROWS / 2
  const target = slot - center
  let pos = 0
  const steps: number[] = []

  for (let i = 0; i < ROWS; i++) {
    const remaining = ROWS - i
    const needed = target - pos
    let goRight: boolean
    if (needed > 0 && needed >= remaining) goRight = true
    else if (needed < 0 && -needed >= remaining) goRight = false
    else goRight = Math.random() < 0.5
    const step = goRight ? 1 : -1
    pos += step
    steps.push(step)
  }

  let cumPos = 0
  for (let row = 0; row < ROWS; row++) {
    cumPos += steps[row]
    const count = row + 3
    const rowOffsetX = (WIDTH - (count - 1) * PIN_GAP) / 2
    const centerPin = (count - 1) / 2
    const pinIdx = centerPin + cumPos * 0.5
    const x = rowOffsetX + pinIdx * PIN_GAP + (Math.random() - 0.5) * 6
    const y = (row + 2) * PIN_GAP + PIN_R + BALL_R + 2
    pts.push({ x, y })
  }

  const slotWidth = WIDTH / COLS
  const bottomY = (ROWS + 2.5) * PIN_GAP
  pts.push({ x: slot * slotWidth + slotWidth / 2, y: bottomY })
  return pts
}

export function PachinkoGame({ credits, onCreditsChange, onBack }: PachinkoGameProps) {
  const [bet, setBet] = useState(BET_OPTIONS[0])
  const [oddsSet, setOddsSet] = useState(ODDS_SETS[1])
  const [lastWin, setLastWin] = useState<{ amount: number; multiplier: number } | null>(null)
  const [, setTick] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballIdRef = useRef(0)
  const animRef = useRef<number>(0)
  const animBallsRef = useRef<AnimBall[]>([])
  const oddsRef = useRef(oddsSet)

  useEffect(() => { oddsRef.current = oddsSet }, [oddsSet])

  const drop = useCallback(() => {
    if (credits < bet) return
    onCreditsChange(-bet)
    const slot = galtonSlot()
    const path = buildPath(slot)
    const ball: AnimBall = {
      id: ++ballIdRef.current,
      path,
      slot,
      bet,
      startTime: performance.now(),
      done: false,
    }
    animBallsRef.current = [...animBallsRef.current, ball]
    setTick(t => t + 1)
  }, [credits, bet, onCreditsChange])

  useEffect(() => {
    const BALL_SPEED = 100

    const tick = () => {
      const now = performance.now()
      let anyActive = false

      for (const ball of animBallsRef.current) {
        if (ball.done) continue
        const elapsed = now - ball.startTime
        const totalDuration = ball.path.length * BALL_SPEED
        if (elapsed >= totalDuration) {
          ball.done = true
          const mult = oddsRef.current.mults[ball.slot]
          const winAmount = ball.bet * mult
          onCreditsChange(winAmount)
          setLastWin({ amount: winAmount, multiplier: mult })
        } else {
          anyActive = true
        }
      }

      if (animBallsRef.current.filter(b => b.done).length > 20) {
        animBallsRef.current = animBallsRef.current.slice(-10)
      }

      if (anyActive) animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [onCreditsChange])

  const getPins = useCallback(() => {
    const pins: { x: number; y: number }[] = []
    for (let row = 0; row < ROWS; row++) {
      const count = row + 3
      const offsetX = (WIDTH - (count - 1) * PIN_GAP) / 2
      for (let col = 0; col < count; col++) {
        pins.push({ x: offsetX + col * PIN_GAP, y: (row + 2) * PIN_GAP })
      }
    }
    return pins
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const BALL_SPEED = 100

    const render = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const now = performance.now()

      const pins = getPins()
      for (const pin of pins) {
        ctx.beginPath()
        ctx.arc(pin.x, pin.y, PIN_R, 0, Math.PI * 2)
        ctx.fillStyle = '#94a3b8'
        ctx.fill()
      }

      const mults = oddsSet.mults
      const slotWidth = WIDTH / COLS
      const bottomY = (ROWS + 2.5) * PIN_GAP
      for (let i = 0; i < COLS; i++) {
        const sc = slotColor(mults[i])
        ctx.fillStyle = sc
        ctx.globalAlpha = 0.2
        ctx.fillRect(i * slotWidth, bottomY, slotWidth, PIN_GAP * 1.5)
        ctx.globalAlpha = 1
        ctx.fillStyle = sc
        ctx.font = 'bold 9px system-ui'
        ctx.textAlign = 'center'
        const label = mults[i] >= 100 ? `${mults[i]}` : `${mults[i]}x`
        ctx.fillText(label, i * slotWidth + slotWidth / 2, bottomY + PIN_GAP * 0.8)
      }

      for (const ball of animBallsRef.current) {
        const elapsed = now - ball.startTime
        const totalDuration = ball.path.length * BALL_SPEED
        if (ball.done && elapsed > totalDuration + 600) continue

        const t = Math.min(elapsed / totalDuration, 1)
        const pathProgress = t * (ball.path.length - 1)
        const idx = Math.floor(pathProgress)
        const frac = pathProgress - idx
        const p0 = ball.path[Math.min(idx, ball.path.length - 1)]
        const p1 = ball.path[Math.min(idx + 1, ball.path.length - 1)]
        const x = p0.x + (p1.x - p0.x) * frac
        const y = p0.y + (p1.y - p0.y) * frac

        const alpha = ball.done ? Math.max(0, 1 - (elapsed - totalDuration) / 600) : 1
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(x, y, BALL_R, 0, Math.PI * 2)
        ctx.fillStyle = '#e54545'
        ctx.fill()
        ctx.strokeStyle = '#b91c1c'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      requestAnimationFrame(render)
    }

    const frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [getPins, oddsSet])

  return (
    <div className="p-4 max-w-xl mx-auto">
      <button onClick={onBack} className="text-xs text-text-muted hover:text-dark mb-4 cursor-pointer">← Back to Casino</button>
      <h2 className="text-xl font-bold text-dark mb-4">📍 Pachinko</h2>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-text-muted">Bet:</span>
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

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-xs text-text-muted">Risk:</span>
        {ODDS_SETS.map(o => (
          <button
            key={o.id}
            onClick={() => setOddsSet(o)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
              oddsSet.id === o.id ? 'text-white border-transparent' : 'bg-bg text-text-muted border-border hover:text-dark'
            }`}
            style={oddsSet.id === o.id ? { backgroundColor: o.color } : undefined}
          >
            {o.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">Balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span></span>
          <span className="text-[10px] text-text-muted">House edge {oddsSet.edge}</span>
        </div>
        {lastWin && (
          <span className={`text-sm font-bold ${lastWin.multiplier >= 10 ? 'text-yes' : lastWin.multiplier >= 1 ? 'text-dark' : 'text-no'}`}>
            {lastWin.multiplier >= 100 ? `🎉 ${lastWin.multiplier}x!` : `${lastWin.multiplier}x`} → {lastWin.amount > 0 ? '+' : ''}{lastWin.amount.toFixed(2)}
          </span>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full cursor-pointer"
          onClick={drop}
          style={{ maxWidth: WIDTH }}
        />
      </div>
      <p className="text-[10px] text-text-muted text-center mt-2">Click the board to drop a coin · Edge slots: 1 in 4096 chance</p>
    </div>
  )
}
