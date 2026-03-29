import { useRef, useEffect, useCallback, useState } from 'react'
import './DinoChrome.css'

// ── Constants ───────────────────────────────────────────────────────────────
const TREX_X     = 80    // fixed horizontal position (px)
const TREX_W     = 40    // drawing + hitbox width (px)
const TREX_H     = 48    // drawing + hitbox height (px)
const GRAVITY    = 0.75
const JUMP_VY    = -15
const BASE_SPEED = 5
const BLINK_DUR  = 3000  // ms of blinking after a hit
const BLINK_STEP = 150   // ms per visible/hidden phase
const FONT_SIZE  = 26    // px — obstacle text size
const FONT       = `bold ${FONT_SIZE}px "Courier New", Courier, monospace`

const WORDS = [
  'JUMP', 'DODGE', 'LYRIC', 'BEATS', 'VERSE', 'CHORUS',
  'MELODY', 'TILES', 'MUSIC', 'NOTE', 'RHYTHM', 'ROCK',
  'FLOW', 'STAR', 'DROP', 'VIBE', 'SYNC', 'RUN!', 'GO!',
  'HOP!', 'SKIP', 'LEAP', 'REACT', 'DASH', 'SWIFT',
]

// ── Pure canvas helpers (defined outside component to avoid re-creation) ────

function drawGround(ctx, w, groundY) {
  ctx.fillStyle = '#535353'
  ctx.fillRect(0, groundY, w, 2)
}

function drawCloud(ctx, x, y) {
  ctx.fillStyle = '#d4d4d4'
  ctx.beginPath()
  ctx.arc(x + 10, y + 9, 9,  0, Math.PI * 2)
  ctx.arc(x + 23, y + 5, 13, 0, Math.PI * 2)
  ctx.arc(x + 40, y + 9, 9,  0, Math.PI * 2)
  ctx.fill()
}

function drawTrex(ctx, x, y, isGrounded, frameMs) {
  const leg = isGrounded && Math.floor(frameMs / 110) % 2 === 0

  ctx.fillStyle = '#535353'

  // Tail
  ctx.fillRect(x,      y + 20, 9, 7)

  // Body
  ctx.fillRect(x + 7,  y + 12, 27, 24)

  // Head
  ctx.fillRect(x + 16, y,      24, 16)
  // Jaw / neck connection
  ctx.fillRect(x + 32, y + 14,  8,  5)

  // Eye (white sclera then dark pupil)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 32, y + 3, 5, 5)
  ctx.fillStyle = '#535353'
  ctx.fillRect(x + 34, y + 5, 2, 2)

  // Tiny arm
  ctx.fillRect(x + 16, y + 28, 8, 5)

  // Legs — alternate when running, fixed pose when airborne
  if (isGrounded) {
    ctx.fillRect(x + 12, y + 36, 8, leg ? 12 : 6)
    ctx.fillRect(x + 22, y + 36, 8, leg ? 6  : 12)
  } else {
    ctx.fillRect(x + 12, y + 36, 8, 8)
    ctx.fillRect(x + 22, y + 36, 8, 4)
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DinoChrome() {
  const canvasRef = useRef(null)
  const gameRef   = useRef(null)   // mutable game state (no re-renders)
  const rafRef    = useRef(null)
  const lastMsRef = useRef(null)

  const [hitCount, setHitCount] = useState(0)
  const [score,    setScore]    = useState(0)

  // jump / start handler — stable reference via useCallback with no deps
  const jump = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    if (!g.started) g.started = true
    if (g.trex.grounded) {
      g.trex.vy       = JUMP_VY
      g.trex.grounded = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // ── Initial game state ────────────────────────────────────────────────
    gameRef.current = {
      started:    false,
      trex:       { y: 0, vy: 0, grounded: true },
      obstacles:  [],
      clouds:     [{ x: 260, y: 35 }, { x: 560, y: 20 }],
      score:      0,
      hitCount:   0,
      blink:      { active: false, timer: 0, visible: true },
      nextObstAt: 700,   // distance threshold to spawn next obstacle
      dist:       0,     // total distance traveled
      hitIds:     new Set(),
      frameMs:    0,
    }

    // ── Resize canvas to fill its CSS box ────────────────────────────────
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Input listeners ───────────────────────────────────────────────────
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('click', jump)

    // ── Main game loop ────────────────────────────────────────────────────
    const loop = (ms) => {
      if (!lastMsRef.current) lastMsRef.current = ms
      const dt = Math.min(ms - lastMsRef.current, 50) // cap to avoid spiral-of-death
      lastMsRef.current = ms

      const g       = gameRef.current
      const w       = canvas.width
      const h       = canvas.height
      const groundY = h - 50

      g.frameMs += dt

      ctx.clearRect(0, 0, w, h)

      // ── Idle / waiting to start ─────────────────────────────────────
      if (!g.started) {
        drawGround(ctx, w, groundY)
        drawTrex(ctx, TREX_X, groundY - TREX_H, true, 0)

        ctx.fillStyle    = '#535353'
        ctx.font         = '600 14px "Courier New", Courier, monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Press SPACE or tap to run', w / 2, groundY - 80)

        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ── Physics ────────────────────────────────────────────────────────
      const speed  = BASE_SPEED + Math.floor(g.score / 300) * 0.5
      const floorY = groundY - TREX_H

      if (g.trex.grounded) {
        g.trex.y = floorY              // snap to ground while running
      } else {
        g.trex.vy += GRAVITY
        g.trex.y  += g.trex.vy
        if (g.trex.y >= floorY) {
          g.trex.y        = floorY
          g.trex.vy       = 0
          g.trex.grounded = true
        }
      }

      // ── Blink timer ────────────────────────────────────────────────────
      if (g.blink.active) {
        g.blink.timer  -= dt
        g.blink.visible = Math.floor(g.blink.timer / BLINK_STEP) % 2 === 0
        if (g.blink.timer <= 0) {
          g.blink.active  = false
          g.blink.visible = true
        }
      }

      // ── Score / distance ───────────────────────────────────────────────
      g.dist  += speed
      g.score  = Math.floor(g.dist / 8)

      // ── Spawn obstacles ────────────────────────────────────────────────
      if (g.dist >= g.nextObstAt) {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)]
        ctx.font = FONT
        const tw = ctx.measureText(word).width
        g.obstacles.push({ id: g.dist, word, x: w + 20, w: tw })
        g.nextObstAt = g.dist + 380 + Math.random() * 460
      }

      // ── Spawn clouds ───────────────────────────────────────────────────
      const lastCloud = g.clouds[g.clouds.length - 1]
      if (!lastCloud || lastCloud.x < w - 260) {
        g.clouds.push({ x: w + 60, y: 15 + Math.random() * 55 })
      }

      // ── Move objects ───────────────────────────────────────────────────
      g.obstacles = g.obstacles.filter(ob => { ob.x -= speed;          return ob.x + ob.w > -20 })
      g.clouds    = g.clouds.filter(c  => { c.x  -= speed * 0.25;  return c.x + 80   > 0  })

      // ── Collision detection (AABB with slight inset) ───────────────────
      const tx1 = TREX_X + 7,           tx2 = TREX_X + TREX_W - 3
      const ty1 = g.trex.y + 4,         ty2 = g.trex.y + TREX_H - 4
      // Obstacle text sits on the ground: baseline at groundY-10, rises by FONT_SIZE
      const oy1 = groundY - FONT_SIZE - 8
      const oy2 = groundY - 8

      for (const ob of g.obstacles) {
        const ox1 = ob.x + 2, ox2 = ob.x + ob.w - 2

        if (!g.hitIds.has(ob.id) && tx2 > ox1 && tx1 < ox2 && ty2 > oy1 && ty1 < oy2) {
          g.hitIds.add(ob.id)
          g.hitCount++
          setHitCount(g.hitCount)
          // Start (or reset) blink
          g.blink.active  = true
          g.blink.timer   = BLINK_DUR
          g.blink.visible = true
        }

        // Remove stale hit IDs once obstacle has cleared the dino
        if (ob.x + ob.w < TREX_X - 10) g.hitIds.delete(ob.id)
      }

      setScore(g.score)

      // ── Draw ───────────────────────────────────────────────────────────

      // Background clouds
      for (const c of g.clouds) drawCloud(ctx, c.x, c.y)

      // Ground line
      drawGround(ctx, w, groundY)

      // Obstacles as text
      ctx.fillStyle    = '#535353'
      ctx.font         = FONT
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'alphabetic'
      for (const ob of g.obstacles) {
        ctx.fillText(ob.word, ob.x, groundY - 10)
      }

      // T-Rex (hidden during blink-off phase)
      if (g.blink.visible) {
        drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs)
      }

      // Score — top-right corner (matching Chrome dino style)
      ctx.fillStyle    = '#535353'
      ctx.font         = '700 14px "Courier New", Courier, monospace'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`HI ${String(g.score).padStart(5, '0')}`, w - 16, 14)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('click', jump)
      lastMsRef.current = null
    }
  }, [jump])

  return (
    <div id="dino-wrapper">
      <div id="dino-hud">
        <span id="dino-hits">HITS: {hitCount}</span>
        <span id="dino-score">SCORE: {String(score).padStart(5, '0')}</span>
      </div>
      <canvas ref={canvasRef} id="dino-canvas" />
    </div>
  )
}
