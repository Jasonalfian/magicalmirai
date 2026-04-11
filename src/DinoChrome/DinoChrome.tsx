import { useRef, useEffect, useCallback, useState } from "react";
import type { Player, IBeat, ISongMap, IChord } from "textalive-app-api";
import type { WordLyric } from "../types";
import "./DinoChrome.css";

// ── Constants ────────────────────────────────────────────────────────────────
const TREX_X = 80;
const TREX_W = 40;
const TREX_H = 48;
const GRAVITY = 0.75;
const JUMP_VY = -15;
const BASE_SPEED = 5;
const BLINK_DUR = 3000;
const BLINK_STEP = 150;
const FONT_SIZE = 26;
const FONT = `bold ${FONT_SIZE}px "Courier New", Courier, monospace`;

// ── Chord → hue (circle of fifths) ──────────────────────────────────────────
const CHORD_HUES: Record<string, number> = {
  C: 200,
  G: 160,
  D: 130,
  A: 90,
  E: 50,
  B: 25,
  "F#": 355,
  Gb: 355,
  "C#": 330,
  Db: 330,
  "G#": 300,
  Ab: 300,
  "D#": 270,
  Eb: 270,
  "A#": 245,
  Bb: 245,
  F: 215,
};
function chordToHue(name: string) {
  return CHORD_HUES[name.match(/^[A-G][#b]?/)?.[0] ?? "C"] ?? 200;
}
function chordIsMinor(name: string) {
  return /^[A-G][#b]?m(?!aj)/i.test(name);
}

// ── Internal game types ───────────────────────────────────────────────────────
interface TrexState {
  y: number;
  vy: number;
  grounded: boolean;
}
interface BlinkState {
  active: boolean;
  timer: number;
  visible: boolean;
}
interface Cloud {
  x: number;
  y: number;
  scale: number;
  glitchX: number;
  color: string;
}
interface Obstacle {
  id: number;
  word: string;
  x: number;
  w: number;
}

interface GameState {
  started: boolean;
  startWall: number;
  trex: TrexState;
  obstacles: Obstacle[];
  clouds: Cloud[];
  score: number;
  hitCount: number;
  blink: BlinkState;
  hitIds: Set<number>;
  passedIds: Set<number>;
  frameMs: number;
}

// ── Component props ───────────────────────────────────────────────────────────
interface Props {
  player: Player | null;
  wordLyrics: WordLyric[];
  songDuration: number;
  isLoaded: boolean;
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
  thickness = 2,
  color = "#535353",
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, groundY, w, thickness);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  glitchX = 0,
  color = "#d4d4d4",
) {
  const cx = x + glitchX;
  ctx.save();
  ctx.translate(cx + 25, y + 9);
  ctx.scale(scale, scale);
  ctx.translate(-(cx + 25), -(y + 9));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx + 10, y + 9, 9, 0, Math.PI * 2);
  ctx.arc(cx + 23, y + 5, 13, 0, Math.PI * 2);
  ctx.arc(cx + 40, y + 9, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  grounded: boolean,
  frameMs: number,
  color = "#535353",
) {
  const leg = grounded && Math.floor(frameMs / 110) % 2 === 0;
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 20, 9, 7);
  ctx.fillRect(x + 7, y + 12, 27, 24);
  ctx.fillRect(x + 16, y, 24, 16);
  ctx.fillRect(x + 32, y + 14, 8, 5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 32, y + 3, 5, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x + 34, y + 5, 2, 2);
  ctx.fillRect(x + 16, y + 28, 8, 5);
  if (grounded) {
    ctx.fillRect(x + 12, y + 36, 8, leg ? 12 : 6);
    ctx.fillRect(x + 22, y + 36, 8, leg ? 6 : 12);
  } else {
    ctx.fillRect(x + 12, y + 36, 8, 8);
    ctx.fillRect(x + 22, y + 36, 8, 4);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DinoChrome({
  player,
  wordLyrics,
  songDuration,
  isLoaded,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastMsRef = useRef<number | null>(null);
  // Prop mirrors — updated by separate effects so the game loop always reads latest
  const playerRef = useRef<Player | null>(player);
  const isLoadedRef = useRef<boolean>(isLoaded);
  const songDurationRef = useRef<number>(songDuration);
  // Song-position tracking (updated by addListener)
  const songPosRef = useRef<number>(0);
  const updateWallRef = useRef<number>(0);
  // Beat / chord / chorus maps — populated by onSongMapLoad
  const beatsRef = useRef<IBeat[]>([]);
  const chordsRef = useRef<IChord[]>([]);
  const chorusRangesRef = useRef<{ start: number; end: number }[]>([]);
  const lastBeatIdxRef = useRef(-1);
  // Lyrics queue (shallow copy of wordLyrics, items shifted out as they spawn)
  const lyricsQueueRef = useRef<WordLyric[]>([]);
  const wordLyricsRef = useRef<WordLyric[]>(wordLyrics);
  // Game-state flags (refs so game loop reads current value without re-closure)
  const isPausedRef = useRef<boolean>(false);
  const isEndedRef = useRef<boolean>(false);
  const randomizerRef = useRef<boolean>(true);

  const [score, setScore] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [randomizer, setRandomizer] = useState(false);

  // Keep prop mirrors in sync
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);
  useEffect(() => {
    songDurationRef.current = songDuration;
  }, [songDuration]);

  // ── Time-update listener — only re-runs when player prop changes ──────────
  // Keeping separate from wordLyrics prevents the cleanup from accidentally
  // stopping playback every time lyrics arrive.
  useEffect(() => {
    if (!player) return;
    let mounted = true;
    player.addListener({
      onSongMapLoad(songMap: ISongMap) {
        if (!mounted) return;
        beatsRef.current = songMap.beats ?? [];
        chordsRef.current = songMap.chords ?? [];
        const ranges: { start: number; end: number }[] = [];
        for (const sg of songMap.segments ?? [])
          if (sg.chorus)
            for (const s of sg.segments)
              ranges.push({ start: s.startTime, end: s.endTime });
        chorusRangesRef.current = ranges;
      },
      onTimeUpdate(position: number) {
        if (!mounted) return;
        songPosRef.current = position;
        updateWallRef.current = Date.now();
        const dur = songDurationRef.current;
        if (dur > 0 && position >= dur - 500) {
          isEndedRef.current = true;
          setIsEnded(true);
        }
      },
    });
    return () => {
      mounted = false;
      // requestStop resets to 0 so returning to this tab starts fresh.
      // Guard with try/catch — the TextAlive player may throw if it hasn't
      // finished initialising (e.g. when unmounted immediately after song select).
      try {
        if (typeof player.requestStop === "function") player.requestStop();
        else if (player.isPlaying) player.requestPause();
      } catch {
        /* ignore */
      }
    };
  }, [player]);

  // ── Rebuild lyrics queue whenever the song word list changes ──────────────
  useEffect(() => {
    wordLyricsRef.current = wordLyrics;
    lyricsQueueRef.current = [...wordLyrics].sort(
      (a, b) => a.startTime - b.startTime,
    );
  }, [wordLyrics]);

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    // Stop and rewind the player
    if (typeof playerRef.current?.requestStop === "function")
      playerRef.current.requestStop();
    // Reset all game state
    g.started = false;
    g.startWall = 0;
    g.trex = { y: 0, vy: 0, grounded: true };
    g.obstacles = [];
    g.clouds = [
      { x: 260, y: 35, scale: 1, glitchX: 0, color: "#d4d4d4" },
      { x: 560, y: 20, scale: 1, glitchX: 0, color: "#d4d4d4" },
    ];
    g.score = 0;
    g.hitCount = 0;
    g.blink = { active: false, timer: 0, visible: true };
    g.hitIds = new Set();
    g.passedIds = new Set();
    g.frameMs = 0;
    // Reset refs
    songPosRef.current = 0;
    updateWallRef.current = 0;
    lastMsRef.current = null;
    isPausedRef.current = false;
    isEndedRef.current = false;
    lastBeatIdxRef.current = -1;
    // Rebuild lyrics queue
    lyricsQueueRef.current = [...wordLyricsRef.current].sort(
      (a, b) => a.startTime - b.startTime,
    );
    // Reset React state
    setScore(0);
    setHitCount(0);
    setHasStarted(false);
    setIsPaused(false);
    setIsEnded(false);
  }, []);

  // ── Jump / start ──────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g || isPausedRef.current || isEndedRef.current) return;
    if (!g.started) {
      if (!isLoadedRef.current) return;
      g.started = true;
      g.startWall = Date.now();
      // Reset interpolation refs so stale data from a prior session doesn't leak
      songPosRef.current = 0;
      updateWallRef.current = 0;
      // Unlock the AudioContext within this user gesture so requestPlay()
      // can output audio even if TextAlive resolves play() asynchronously.
      try {
        void new AudioContext().resume();
      } catch {
        /* ignore */
      }
      playerRef.current?.requestPlay();
      setHasStarted(true);
    }
    if (g.trex.grounded) {
      g.trex.vy = JUMP_VY;
      g.trex.grounded = false;
    }
  }, []);

  // ── Main game loop + input setup ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    gameRef.current = {
      started: false,
      startWall: 0,
      trex: { y: 0, vy: 0, grounded: true },
      obstacles: [],
      clouds: [
        { x: 260, y: 35, scale: 1, glitchX: 0, color: "#d4d4d4" },
        { x: 560, y: 20, scale: 1, glitchX: 0, color: "#d4d4d4" },
      ],
      score: 0,
      hitCount: 0,
      blink: { active: false, timer: 0, visible: true },
      hitIds: new Set<number>(),
      passedIds: new Set<number>(),
      frameMs: 0,
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
      if (e.code === "Escape") {
        e.preventDefault();
        const g = gameRef.current;
        if (!g?.started || isEndedRef.current) return;
        const next = !isPausedRef.current;
        isPausedRef.current = next;
        setIsPaused(next);
        if (next) playerRef.current?.requestPause();
        else playerRef.current?.requestPlay();
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("click", jump);

    const loop = (ms: number) => {
      if (!lastMsRef.current) lastMsRef.current = ms;
      const dt = Math.min(ms - lastMsRef.current, 50);
      lastMsRef.current = ms;

      const g = gameRef.current!;
      const w = canvas.width;
      const h = canvas.height;
      const groundY = h - 50;

      g.frameMs += dt;
      ctx.clearRect(0, 0, w, h);

      // ── IDLE ──────────────────────────────────────────────────────────────
      if (!g.started) {
        drawGround(ctx, w, groundY);
        ctx.fillStyle = "#535353";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (isLoadedRef.current) {
          drawTrex(ctx, TREX_X, groundY - TREX_H, true, g.frameMs);
          ctx.font = '600 14px "Courier New", Courier, monospace';
          ctx.fillText("Press SPACE or tap to run", w / 2, groundY - 80);
        } else {
          ctx.font = '13px "Courier New", Courier, monospace';
          ctx.fillStyle = "#888";
          ctx.fillText("Loading song…", w / 2, groundY - 80);
        }
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── ENDED ─────────────────────────────────────────────────────────────
      if (isEndedRef.current) {
        for (const cl of g.clouds) drawCloud(ctx, cl.x, cl.y);
        drawGround(ctx, w, groundY);
        ctx.fillStyle = "#535353";
        ctx.font = FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10);
        if (g.blink.visible)
          drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(w / 2 - 150, h / 2 - 48, 300, 96);
        ctx.fillStyle = "#535353";
        ctx.font = '700 18px "Courier New", Courier, monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SONG COMPLETE", w / 2, h / 2 - 18);
        ctx.font = '13px "Courier New", Courier, monospace';
        ctx.fillText(
          `Score: ${g.score}  •  Hits: ${g.hitCount}`,
          w / 2,
          h / 2 + 18,
        );
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── PAUSED ────────────────────────────────────────────────────────────
      if (isPausedRef.current) {
        for (const cl of g.clouds) drawCloud(ctx, cl.x, cl.y);
        drawGround(ctx, w, groundY);
        ctx.fillStyle = "#535353";
        ctx.font = FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10);
        drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#fff";
        ctx.font = '700 16px "Courier New", Courier, monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PAUSED  —  ESC to resume", w / 2, h / 2);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── RUNNING ───────────────────────────────────────────────────────────
      const dur = songDurationRef.current;
      const speed = BASE_SPEED;
      const floorY = groundY - TREX_H;
      // Normalise per-frame values to wall-clock time so the game runs at
      // the same speed regardless of refresh rate (60 Hz vs 120 Hz etc.)
      const scale = dt / (1000 / 60);

      // Physics — gravity every frame; platform & floor snap afterward
      const prevDinoBottom = g.trex.y + TREX_H;
      g.trex.grounded = false;
      g.trex.vy += GRAVITY * scale;
      g.trex.y += g.trex.vy * scale;

      // Word boxes are solid platforms — dino can land on top and run across
      const obTop = groundY - FONT_SIZE - 6;
      let platformObId: number | null = null;
      for (const ob of g.obstacles) {
        const hOvlp = TREX_X + TREX_W - 3 > ob.x && TREX_X + 7 < ob.x + ob.w;
        if (
          hOvlp &&
          prevDinoBottom <= obTop + 2 &&
          g.trex.y + TREX_H >= obTop
        ) {
          g.trex.y = obTop - TREX_H;
          g.trex.vy = 0;
          g.trex.grounded = true;
          platformObId = ob.id;
          break;
        }
      }

      // Floor
      if (g.trex.y >= floorY) {
        g.trex.y = floorY;
        g.trex.vy = 0;
        g.trex.grounded = true;
      }

      // Blink/invincibility timer
      if (g.blink.active) {
        g.blink.timer -= dt;
        g.blink.visible = Math.floor(g.blink.timer / BLINK_STEP) % 2 === 0;
        if (g.blink.timer <= 0) {
          g.blink.active = false;
          g.blink.visible = true;
        }
      }

      // Effective song position:
      // • When onTimeUpdate has fired: interpolate from last reported position (smooth).
      // • Fallback: wall-clock elapsed since game start — works even if AudioContext
      //   stays suspended and onTimeUpdate never fires.
      const wallPos = Date.now() - g.startWall;
      const songPos =
        updateWallRef.current > 0
          ? Math.min(
              songPosRef.current + (Date.now() - updateWallRef.current),
              dur || Infinity,
            )
          : wallPos;

      // ── Beat + chord sync ─────────────────────────────────────────────────
      const beats = beatsRef.current;
      const chords = chordsRef.current;

      // Binary-search current beat
      let beatProgress = 0;
      let beatPos = 0;
      let beatIdx = -1;
      if (beats.length > 0) {
        let lo = 0,
          hi = beats.length - 1,
          bi = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (beats[mid].startTime <= songPos) {
            bi = mid;
            lo = mid + 1;
          } else hi = mid - 1;
        }
        const beat = beats[bi];
        beatProgress = Math.min((songPos - beat.startTime) / beat.duration, 1);
        beatPos = beat.position;
        beatIdx = bi;
      }
      // Sharper exponential punch — snappy attack, fast decay
      const beatPunch = Math.max(0, 1 - beatProgress ** 0.35);
      const beatJustChanged = beatIdx !== lastBeatIdxRef.current;
      if (beatJustChanged) lastBeatIdxRef.current = beatIdx;

      // Binary-search current chord
      let chordHue = 200;
      let minorChord = false;
      if (chords.length > 0) {
        let lo = 0,
          hi = chords.length - 1,
          ci = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (chords[mid].startTime <= songPos) {
            ci = mid;
            lo = mid + 1;
          } else hi = mid - 1;
        }
        chordHue = chordToHue(chords[ci].name);
        minorChord = chordIsMinor(chords[ci].name);
      }

      // Chorus → 3× saturation on all colours, louder effects
      const isChorus = chorusRangesRef.current.some(
        (r) => songPos >= r.start && songPos < r.end,
      );
      const sat = isChorus ? 3 : 1;

      // Per beat-position: downbeat biggest, backbeat medium, off-beats small
      const beatFx = randomizerRef.current;
      let punchAmt = beatFx ? 0.08 : 0;
      let doGlitch = false;
      if (beatFx)
        switch (beatPos % 4) {
          case 0:
            punchAmt = 0.22;
            doGlitch = isChorus || beatPunch > 0.85;
            break;
          case 1:
            punchAmt = 0.07;
            break;
          case 2:
            punchAmt = 0.14;
            break;
          case 3:
            punchAmt = 0.09;
            doGlitch = isChorus && beatPunch > 0.85;
            break;
        }

      // Chord-tinted cloud colour — darkens on punch
      const cloudColor = beatFx
        ? `hsl(${chordHue},${Math.min(18 * sat, 60)}%,${(minorChord ? 74 : 82) - beatPunch * 10}%)`
        : "#d4d4d4";
      for (const cl of g.clouds) {
        cl.scale = 1 + beatPunch * punchAmt;
        cl.color = cloudColor;
        if (beatFx && beatJustChanged && doGlitch)
          cl.glitchX = (Math.random() - 0.5) * 16;
        else if (!beatFx || beatProgress > 0.15) cl.glitchX = 0;
      }

      // Ground: thickness + chord tint, big flash on downbeat
      const groundThickness = beatFx
        ? 2 + beatPunch * (beatPos === 0 ? 6 : 3)
        : 2;
      const groundColor = beatFx
        ? `hsl(${chordHue},${beatPos === 0 && beatPunch > 0.7 ? Math.min(30 * sat, 80) : Math.min(10 * sat, 30)}%,${(minorChord ? 28 : 33) + (beatPos === 0 ? beatPunch * 16 : 0)}%)`
        : "#535353";

      // Sky and obstacle colours derived from chord
      const skyColor = beatFx
        ? `hsl(${chordHue},${Math.min(7 * sat, 22)}%,${minorChord ? 91 : 97}%)`
        : "#ffffff";
      const obstacleColor = beatFx
        ? `hsl(${chordHue},${Math.min(6 * sat, 20)}%,33%)`
        : "#535353";

      // Spawn words whose sing-time will arrive just as they reach the dino.
      // travelMs = time for an obstacle to cross from the right edge to the dino.
      const travelMs = ((w - TREX_X) / (speed * 60)) * 1000;
      while (
        lyricsQueueRef.current.length > 0 &&
        lyricsQueueRef.current[0].startTime <= songPos + travelMs
      ) {
        const lyric = lyricsQueueRef.current.shift()!;
        ctx.font = FONT;
        const tw = ctx.measureText(lyric.text).width;
        // Position word so it arrives at the dino exactly at lyric.startTime.
        // Words already close in time are pre-placed on-screen rather than
        // always spawned at the far right edge.
        const timeUntilArrival = lyric.startTime - songPos;
        const idealX =
          TREX_X + (timeUntilArrival / travelMs) * (w + 20 - TREX_X);
        // Ensure spawned obstacle doesn't overlap the last one on screen
        const lastOb = g.obstacles[g.obstacles.length - 1];
        const spawnX = lastOb
          ? Math.max(idealX, lastOb.x + lastOb.w + 40)
          : idealX;
        g.obstacles.push({
          id: lyric.startTime,
          word: lyric.text,
          x: spawnX,
          w: tw,
        });
      }

      // Clouds
      const lastCloud = g.clouds[g.clouds.length - 1];
      if (!lastCloud || lastCloud.x < w - 260) {
        g.clouds.push({
          x: w + 60,
          y: 15 + Math.random() * 55,
          scale: 1,
          glitchX: 0,
          color: "#d4d4d4",
        });
      }

      // Move obstacles and clouds; remove off-screen ones
      g.obstacles = g.obstacles.filter((ob) => {
        ob.x -= speed * scale;
        return ob.x + ob.w > -20;
      });
      g.clouds = g.clouds.filter((cl) => {
        cl.x -= speed * 0.25 * scale;
        return cl.x + 80 > 0;
      });

      // ── Collision: left-face hit only; top is a safe platform ─────────────
      const tx1 = TREX_X + 7,
        tx2 = TREX_X + TREX_W - 3;
      const ty1 = g.trex.y + 4,
        ty2 = g.trex.y + TREX_H - 4;
      const oy1 = groundY - FONT_SIZE - 6;
      const oy2 = groundY - 6;

      for (const ob of g.obstacles) {
        // Dino is standing on top — safe platform, no hit, no score
        if (ob.id === platformObId) {
          if (ob.x + ob.w < TREX_X - 10) {
            g.passedIds.add(ob.id); // mark passed so it never gets scored
            g.hitIds.delete(ob.id);
          }
          continue;
        }

        const ox1 = ob.x + 2,
          ox2 = ob.x + ob.w - 2;
        const hOverlap = tx2 > ox1 && tx1 < ox2;
        const vOverlap = ty2 > oy1 && ty1 < oy2;

        if (hOverlap && vOverlap && !g.hitIds.has(ob.id)) {
          g.hitIds.add(ob.id);
          if (!g.blink.active) {
            g.hitCount++;
            setHitCount(g.hitCount);
            g.blink.active = true;
            g.blink.timer = BLINK_DUR;
            g.blink.visible = true;
          }
        }

        // Word fully passed dino — score only if dino is not invincible at all
        if (ob.x + ob.w < TREX_X - 10 && !g.passedIds.has(ob.id)) {
          g.passedIds.add(ob.id);
          if (!g.blink.active) {
            g.score++;
            setScore(g.score);
          }
          g.hitIds.delete(ob.id);
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.fillStyle = skyColor;
      ctx.fillRect(0, 0, w, groundY);

      for (const cl of g.clouds)
        drawCloud(ctx, cl.x, cl.y, cl.scale, cl.glitchX, cl.color);
      drawGround(ctx, w, groundY, groundThickness, groundColor);

      ctx.fillStyle = obstacleColor;
      ctx.font = FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      for (const ob of g.obstacles) ctx.fillText(ob.word, ob.x, groundY - 10);

      if (g.blink.visible) {
        const trexColor = g.blink.active ? "#c0392b" : obstacleColor;
        drawTrex(ctx, TREX_X, g.trex.y, g.trex.grounded, g.frameMs, trexColor);
      }

      // Song progress bar
      if (dur > 0) {
        const pct = Math.min(songPos / dur, 1);
        const beatFxNow = randomizerRef.current;
        ctx.fillStyle = beatFxNow
          ? `hsl(${chordHue},${Math.min(5 * sat, 15)}%,88%)`
          : "rgba(83,83,83,0.18)";
        ctx.fillRect(0, h - 6, w, 6);
        ctx.fillStyle = beatFxNow
          ? `hsl(${chordHue},${Math.min(22 * sat, 65)}%,45%)`
          : "#535353";
        ctx.fillRect(0, h - 6, w * pct, 6);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("click", jump);
      lastMsRef.current = null;
    };
  }, [jump, restart]);

  return (
    <div id="dino-wrapper">
      <div id="dino-hud">
        <span id="dino-hits">SCORE: {score}</span>
        <span id="dino-hits" style={{ opacity: 0.6 }}>
          HITS: {hitCount}
        </span>
        {!hasStarted && isLoaded && (
          <span id="dino-status">SPACE / tap to start</span>
        )}
        {isPaused && <span id="dino-status">⏸ PAUSED (ESC to resume)</span>}
        {isEnded && <span id="dino-status">✓ SONG COMPLETE</span>}
        {!isLoaded && <span id="dino-status">Loading song…</span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {isEnded && (
            <button className="hud-btn" onClick={restart}>
              Restart
            </button>
          )}
          <button
            className={`hud-btn${randomizer ? "" : " hud-btn--off"}`}
            onClick={() => {
              const next = !randomizer;
              setRandomizer(next);
              randomizerRef.current = next;
            }}
          >
            {randomizer ? "FX: ON" : "FX: OFF"}
          </button>
        </span>
      </div>
      <div id="dino-game-area">
        <canvas ref={canvasRef} id="dino-canvas" />
      </div>
    </div>
  );
}
