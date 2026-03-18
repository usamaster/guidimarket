import { useState, useRef, useEffect, useCallback } from 'react'

interface PachinkoGameProps {
  credits: number
  onCreditsChange: (delta: number) => void
  onBack: () => void
}

const BET_OPTIONS = [1, 2, 5, 8, 10, 20, 50, 100]

const ROWS = 12
const COLS = ROWS + 3
const PIN_GAP = 36
const PIN_R = 4
const BALL_R = 8
const WIDTH = (COLS + 1) * PIN_GAP
const HEIGHT = (ROWS + 4) * PIN_GAP

const MULTIPLIERS = [
  110, 41, 10, 5, 3, 1.5, 1, 0.3, 1, 1.5, 3, 5, 10, 41, 110,
]

const SLOT_COLORS = MULTIPLIERS.map(m => {
  if (m >= 41) return '#ef4444'
  if (m >= 10) return '#f97316'
  if (m >= 3) return '#eab308'
  if (m >= 1.5) return '#22c55e'
  return '#6b7280'
})

interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  bet: number
  landed: boolean
  slot: number
}

export function PachinkoGame({ credits, onCreditsChange, onBack }: PachinkoGameProps) {
  const [bet, setBet] = useState(BET_OPTIONS[0])
  const [balls, setBalls] = useState<Ball[]>([])
  const [lastWin, setLastWin] = useState<{ amount: number; multiplier: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballIdRef = useRef(0)
  const animRef = useRef<number>(0)
  const ballsRef = useRef<Ball[]>([])

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

  const drop = useCallback(() => {
    if (credits < bet) return
    onCreditsChange(-bet)
    const newBall: Ball = {
      id: ++ballIdRef.current,
      x: WIDTH / 2 + (Math.random() - 0.5) * 10,
      y: PIN_GAP * 0.5,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0,
      bet,
      landed: false,
      slot: -1,
    }
    ballsRef.current = [...ballsRef.current, newBall]
    setBalls([...ballsRef.current])
  }, [credits, bet, onCreditsChange])

  useEffect(() => {
    const pins = getPins()
    const gravity = 0.15
    const friction = 0.99
    const bounce = 0.5

    const slotWidth = WIDTH / COLS
    const bottomY = (ROWS + 2.5) * PIN_GAP

    const tick = () => {
      let changed = false
      const current = ballsRef.current
      const updated = current.map(ball => {
        if (ball.landed) return ball
        changed = true
        let { x, y, vx, vy } = ball

        vy += gravity
        vx *= friction
        x += vx
        y += vy

        for (const pin of pins) {
          const dx = x - pin.x
          const dy = y - pin.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = PIN_R + BALL_R
          if (dist < minDist && dist > 0) {
            const nx = dx / dist
            const ny = dy / dist
            x = pin.x + nx * minDist
            y = pin.y + ny * minDist
            const dot = vx * nx + vy * ny
            vx -= 2 * dot * nx * bounce
            vy -= 2 * dot * ny * bounce
            vx += (Math.random() - 0.5) * 1.2
          }
        }

        if (x < BALL_R) { x = BALL_R; vx = Math.abs(vx) * bounce }
        if (x > WIDTH - BALL_R) { x = WIDTH - BALL_R; vx = -Math.abs(vx) * bounce }

        if (y >= bottomY) {
          const slot = Math.min(COLS - 1, Math.max(0, Math.floor(x / slotWidth)))
          const mult = MULTIPLIERS[slot]
          const winAmount = ball.bet * mult
          onCreditsChange(winAmount)
          setLastWin({ amount: winAmount, multiplier: mult })
          return { ...ball, x, y: bottomY, vx: 0, vy: 0, landed: true, slot }
        }

        return { ...ball, x, y, vx, vy }
      })

      const alive = updated.filter(b => !b.landed || Date.now() % 3000 < 2500)
      ballsRef.current = updated
      if (changed) setBalls([...updated])

      if (alive.length > 0 || updated.some(b => !b.landed)) {
        animRef.current = requestAnimationFrame(tick)
      }

      const landed = updated.filter(b => b.landed)
      if (landed.length > 10) {
        ballsRef.current = ballsRef.current.filter(b => !b.landed || updated.indexOf(b) >= landed.length - 5)
      }
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [getPins, onCreditsChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    const pins = getPins()
    for (const pin of pins) {
      ctx.beginPath()
      ctx.arc(pin.x, pin.y, PIN_R, 0, Math.PI * 2)
      ctx.fillStyle = '#94a3b8'
      ctx.fill()
    }

    const slotWidth = WIDTH / COLS
    const bottomY = (ROWS + 2.5) * PIN_GAP
    for (let i = 0; i < COLS; i++) {
      ctx.fillStyle = SLOT_COLORS[i]
      ctx.globalAlpha = 0.25
      ctx.fillRect(i * slotWidth, bottomY, slotWidth, PIN_GAP * 1.5)
      ctx.globalAlpha = 1
      ctx.fillStyle = SLOT_COLORS[i]
      ctx.font = 'bold 10px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(`${MULTIPLIERS[i]}x`, i * slotWidth + slotWidth / 2, bottomY + PIN_GAP)
    }

    for (const ball of balls) {
      if (ball.landed) continue
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fillStyle = '#e54545'
      ctx.fill()
      ctx.strokeStyle = '#b91c1c'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }, [balls, getPins])

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

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-muted">Balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span></span>
        {lastWin && (
          <span className={`text-sm font-bold ${lastWin.multiplier >= 3 ? 'text-yes' : lastWin.multiplier >= 1 ? 'text-dark' : 'text-no'}`}>
            {lastWin.multiplier}x → +{lastWin.amount.toFixed(2)}
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
      <p className="text-[10px] text-text-muted text-center mt-2">Click the board to drop a coin</p>
    </div>
  )
}
