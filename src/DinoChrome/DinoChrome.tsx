import { useRef, useEffect, useCallback, useState } from 'react'
import type { Player } from 'textalive-app-api'
import type { WordLyric } from '../types'
import './DinoChrome.css'

// ── Constants ────────────────────────────────────────────────────────────────
const TREX_X     = 80
const TREX_W     = 40
const TREX_H     = 48
const GRAVITY    = 0.75
const JUMP_VY    = -15
const BASE_SPEED = 5
const BLINK_DUR  = 3000
const BLINK_STEP = 150
const FONT_SIZE  = 26
const FONT       = `bold ${FONT_SIZE}px "Courier New", Courier, monospace`

// ── Internal game types ───────────────────────────────────────────────────────
interface TrexState  { y: number; vy: number; grounded: boolean }
interface BlinkState { active: boolean; timer: number; visible: boolean }
interface Cloud      { x: number; y: number }
interface Obstacle   { id: number; word: string; x: number; w: number }

interface GameState {
  started:   boolean
  startWall: number
  trex:      TrexState
  obstacles: Obstacle[]
  clouds:    Cloud[]
  hitCount:  number
  blink:     BlinkState
  hitIds:    Set<number>
  frameMs:   number
}

// ── Component props ───────────────────────────────────────────────────────────
interface Props {
  player:       Player | null
  wordLyrics:   WordLyric[]
  songDuration: number
  isLoaded:     boolean
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function drawGround(ctx: CanvasRenderingContext2D, w: number, groundY: number) {
  ctx.fillStyle = '#535353'
  ctx.fillRect(0, groundY, w, 2)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#d4d4d4'
  ctx.beginPath()
  ctx.arc(x + 10, y + 9,  9,  0, Math.PI * 2)
  ctx.arc(x + 23, y + 5,  13, 0, Math.PI * 2)
  ctx.arc(x + 40, y + 9,  9,  0, Math.PI * 2)
  ctx.fill()
}

function drawTrex(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  grounded: boolean,
  frameMs: number,
) {
  const leg = grounded && Math.floor(frameMs / 110) % 2 === 0
  ctx.fillStyle = '#535353'
  ctx.fillRect(x,      y + 20, 9,  7)
  ctx.fillRect(x + 7,  y + 12, 27, 24)
  ctx.fillRect(x + 16, y,      24, 16)
  ctx.fillRect(x + 32, y + 14, 8,  5)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 32, y + 3,  5,  5)
  ctx.fillStyle = '#535353'
  ctx.fillRect(x + 34, y + 5,  2,  2)
  ctx.fillRect(x + 16, y + 28, 8,  5)
  if (grounded) {
    ctx.fillRect(x + 12, y + 36, 8, leg ? 12 : 6)
    ctx.fillRect(x + 22, y + 36, 8, leg ? 6  : 12)
  } else {
    ctx.fillRect(x + 12, y + 36, 8, 8)
    ctx.fillRect(x + 22, y + 36, 8, 4)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DinoChrome({ player, wordLyrics, songDuration, isLoaded }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const gameRef         = useRef<GameState | null>(null)
  const rafRef          = useRef<number>(0)
  const lastMsRef       = useRef<number | null>(null)
  // Prop mirrors — updated by separate effects so the game loop always reads latest
  const playerRef       = useRef<Player | null>(player)
  const isLoadedRef     = useRef<boolean>(isLoaded)
  const songDurationRef = useRef<number>(songDuration)
  // Song-position tracking (updated by addListener)
  const songPosRef      = useRef<number>(0)
  const updateWallRef   = useRef<number>(0)
  // Lyrics queue (shallow copy of wordLyrics, items shifted out as they spawn)
  const lyricsQueueRef  = useRef<WordLyric[]>([])
  // Game-state flags (refs so game loop reads current value without re-closure)
  const isPausedRef     = useRef<boolean>(false)
  const isEndedRef      = useRef<boolean>(false)

  const [hitCount,   setHitCount]   = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [isPaused,   setIsPaused]   = useState(false)
  const [isEnded,    setIsEnded]    = useState(false)

  // Keep prop mirrors in sync
  useEffect(() => { playerRef.current       = player       }, [player])
  useEffect(() => { isLoadedRef.current     = isLoaded     }, [isLoaded])
  useEffect(() => { songDurationRef.current = songDuration }, [songDuration])

  // ── Time-update listener — only re-runs when player prop changes ──────────
  // Keeping separate from wordLyrics prevents the cleanup from accidentally
  // stopping playback every time lyrics arrive.
  useEffect(() => {
    if (!player) return
    let mounted = true
    player.addListener({
      onTimeUpdate(position: number) {
        if (!mounted) return
        songPosRef.current    = position
        updateWallRef.current = Date.now()
        const dur = songDurationRef.current
        if (dur > 0 && position >= dur - 500) {
          isEndedRef.current = true
          setIsEnded(true)
        }
      },
    })
    return () => {
      mounted = false
      // requestStop resets to 0 so returning to this tab starts fresh
      if (typeof player.requestStop === 'function') player.requestStop()
      else if (player.isPlaying) player.requestPause()
    }
  }, [player])

  // ── Rebuild lyrics queue whenever the song word list changes ──────────────
  useEffect(() => {
    lyricsQueueRef.current = [...wordLyrics].sort((a, b) => a.startTime - b.startTime)
  }, [wordLyrics])

  // ── Jump / start ──────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    const g = gameRef.current
    if (!g || isPausedRef.current || isEndedRef.current) return
    if (!g.started) {
      if (!isLoadedRef.current) return
      g.started   = true
      g.startWall = Date.now()
      // Reset interpolation refs so stale data from a prior session doesn't leak
      songPosRef.current    = 0
      updateWallRef.current = 0
      // Unlock the AudioContext within this user gesture so requestPlay()
      // can output audio even if TextAlive resolves play() asynchronously.
      try { void new AudioContext().resume() } catch (_) { /* ignore */ }
      playerRef.current?.requestPlay()
      setHasStarted(true)
    }
    if (g.trex.grounded) {
      g.trex.vy       = JUMP_VY
      g.trex.grounded = false
    }
  }, [])

  // ── Main game loop + input setup ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    gameRef.current = {
      started:   false,
      startWall: 0,
      trex:      { y: 0, vy: 0, grounded: true },
      obstacles: [],
      clouds:    [{ x: 260, y: 35 }, { x: 560, y: 20 }],
      hitCount:  0,
      blink:     { active: false, timer: 0, visible: true },
      hitIds:    new Set<number>(),
      frameMs:   0,
    }

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
      if (e.code === 'Escape') {
        e.preventDefault()
        const g = gameRef.current
        if (!g?.started || isEndedRef.current) return
        const next = !isPausedRef.current
        isPausedRef.current = next
        setIsPaused(next)
        if (next) playerRef.current?.requestPause()
        else      playerRef.current?.requestPlay()
      }
    }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('click', jump)

    const loop = (ms: number) => {
      if (!lastMsRef.current) lastMsRef.current = ms
      const dt = Math.min(ms - lastMsRef.current, 50)
      lastMsRef.current = ms

      const g       = gameRef.current!
      const w       = canvas.width
      const h       = canvas.height
      const groundY = h - 50

      g.frameMs += dt
      ctx.clearRect(0, 0, w, h)

      // ── IDLE ──────────────────────────────────────────────────────────────
      if (!g.started) {
        drawGround(ctx, w, groundY)
        ctx.fillStyle    = '#535353'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        if (isLoadedRef.current) {
          drawTrex(ctx, TREX_X, groundY - TREX_H, true, g.frameMs)
          ctx.font = '600 14px "Courier New", Courier, monospace'
          ctx.fillText('Press SPACE or tap to run', w / 2, groundY - 80)
        } else {
          ctx.font      = '13px "Courier New", Courier, monospace'
          ctx.fillStyle = '#888'
          ctx.fillText('Loading song…', w / 2, groundY - 80)
        }
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ── ENDED ─────────────────────────────────────────────────────────────
      if (isEndedRef.current) {
        for (const cl of g.clouds) drawCloud(ctx, cl.x, cl.y)
        drawGround(ctx, w, groundY)
        ctx.fillStyle    = '#535353'
        ctx.font         = FONT
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'
        for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10)
        if (g.blink.visible) drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillRect(w / 2 - 150, h / 2 - 48, 300, 96)
        ctx.fillStyle    = '#535353'
        ctx.font         = '700 18px "Courier New", Courier, monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('SONG COMPLETE', w / 2, h / 2 - 18)
        ctx.font = '13px "Courier New", Courier, monospace'
        ctx.fillText(`You hit ${g.hitCount} word${g.hitCount !== 1 ? 's' : ''}`, w / 2, h / 2 + 18)
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ── PAUSED ────────────────────────────────────────────────────────────
      if (isPausedRef.current) {
        for (const cl of g.clouds) drawCloud(ctx, cl.x, cl.y)
        drawGround(ctx, w, groundY)
        ctx.fillStyle    = '#535353'
        ctx.font         = FONT
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'
        for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10)
        drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs)
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle    = '#fff'
        ctx.font         = '700 16px "Courier New", Courier, monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('PAUSED  —  ESC to resume', w / 2, h / 2)
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ── RUNNING ───────────────────────────────────────────────────────────
      const dur    = songDurationRef.current
      const speed  = BASE_SPEED + Math.floor(songPosRef.current / 30000) * 0.5
      const floorY = groundY - TREX_H

      // Physics
      if (g.trex.grounded) {
        g.trex.y = floorY
      } else {
        g.trex.vy += GRAVITY
        g.trex.y  += g.trex.vy
        if (g.trex.y >= floorY) {
          g.trex.y        = floorY
          g.trex.vy       = 0
          g.trex.grounded = true
        }
      }

      // Blink/invincibility timer
      if (g.blink.active) {
        g.blink.timer  -= dt
        g.blink.visible = Math.floor(g.blink.timer / BLINK_STEP) % 2 === 0
        if (g.blink.timer <= 0) {
          g.blink.active  = false
          g.blink.visible = true
        }
      }

      // Effective song position:
      // • When onTimeUpdate has fired: interpolate from last reported position (smooth).
      // • Fallback: wall-clock elapsed since game start — works even if AudioContext
      //   stays suspended and onTimeUpdate never fires.
      const wallPos = Date.now() - g.startWall
      const songPos = updateWallRef.current > 0
        ? Math.min(songPosRef.current + (Date.now() - updateWallRef.current), dur || Infinity)
        : wallPos

      // Spawn words whose sing-time will arrive just as they reach the dino.
      // travelMs = time for an obstacle to cross from the right edge to the dino.
      const travelMs = ((w - TREX_X) / (speed * 60)) * 1000
      while (
        lyricsQueueRef.current.length > 0 &&
        lyricsQueueRef.current[0].startTime <= songPos + travelMs
      ) {
        const lyric = lyricsQueueRef.current.shift()!
        ctx.font = FONT
        const tw = ctx.measureText(lyric.text).width
        g.obstacles.push({ id: lyric.startTime, word: lyric.text, x: w + 20, w: tw })
      }

      // Clouds
      const lastCloud = g.clouds[g.clouds.length - 1]
      if (!lastCloud || lastCloud.x < w - 260) {
        g.clouds.push({ x: w + 60, y: 15 + Math.random() * 55 })
      }

      // Move obstacles and clouds; remove off-screen ones
      g.obstacles = g.obstacles.filter(ob => { ob.x -= speed;        return ob.x + ob.w > -20 })
      g.clouds    = g.clouds.filter(   cl => { cl.x -= speed * 0.25; return cl.x + 80   > 0   })

      // ── Collision: side-only (dino can jump OVER text) ────────────────────
      const tx1 = TREX_X + 7,   tx2 = TREX_X + TREX_W - 3
      const ty1 = g.trex.y + 4, ty2 = g.trex.y + TREX_H - 4
      const oy1 = groundY - FONT_SIZE - 6
      const oy2 = groundY - 6

      for (const ob of g.obstacles) {
        const ox1 = ob.x + 2, ox2 = ob.x + ob.w - 2
        const hOverlap = tx2 > ox1 && tx1 < ox2
        const vOverlap = ty2 > oy1 && ty1 < oy2

        if (hOverlap && vOverlap && !g.hitIds.has(ob.id)) {
          g.hitIds.add(ob.id)
          if (!g.blink.active) {
            g.hitCount++
            setHitCount(g.hitCount)
            g.blink.active  = true
            g.blink.timer   = BLINK_DUR
            g.blink.visible = true
          }
        }
        if (ob.x + ob.w < TREX_X - 10) g.hitIds.delete(ob.id)
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      for (const cl of g.clouds) drawCloud(ctx, cl.x, cl.y)
      drawGround(ctx, w, groundY)

      ctx.fillStyle    = '#535353'
      ctx.font         = FONT
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'alphabetic'
      for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10)

      if (g.blink.visible) drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs)

      // Song progress bar
      if (dur > 0) {
        const pct = Math.min(songPos / dur, 1)
        ctx.fillStyle = 'rgba(83,83,83,0.18)'
        ctx.fillRect(0, h - 6, w, 6)
        ctx.fillStyle = '#535353'
        ctx.fillRect(0, h - 6, w * pct, 6)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

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
        {!hasStarted && isLoaded  && <span id="dino-status">SPACE / tap to start</span>}
        {isPaused                 && <span id="dino-status">⏸ PAUSED (ESC to resume)</span>}
        {isEnded                  && <span id="dino-status">✓ SONG COMPLETE</span>}
        {!isLoaded                && <span id="dino-status">Loading song…</span>}
      </div>
      <canvas ref={canvasRef} id="dino-canvas" />
    </div>
  )
}
