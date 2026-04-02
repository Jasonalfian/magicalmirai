import { useState, useRef, useEffect } from 'react'
import { Player } from 'textalive-app-api'
import type { IPlayerApp, IVideo, IChar, IWord } from 'textalive-app-api'
import { Lyric } from './utils/CanvasManager'
import type { WordLyric } from './types'
import DinoChrome from './DinoChrome/DinoChrome'
import RandomizedTile from './RandomizedTile/RandomizedTile'
import './App.css'
import Maze from './Maze/Mase'

export default function App() {
  const [page, setPage] = useState<'dino' | 'lyric' | 'maze'>('maze')

  // ── Shared TextAlive Player state ─────────────────────────────────────────
  const mediaRef                        = useRef<HTMLDivElement>(null)
  const [player,       setPlayer]       = useState<Player | null>(null)
  const [isLoaded,     setIsLoaded]     = useState(false)
  const [charLyrics,   setCharLyrics]   = useState<Lyric[]>([])
  const [wordLyrics,   setWordLyrics]   = useState<WordLyric[]>([])
  const [songDuration, setSongDuration] = useState(0)

  useEffect(() => {
    // `disposed` is scoped to each Player instance. StrictMode runs setup+cleanup+setup,
    // so two Players are created. The first Player's callbacks are silenced by its own
    // `disposed = true` set during cleanup; the second Player's closure has disposed=false
    // and is the one that actually drives state.
    let disposed   = false
    let videoReady = false
    let timerReady = false

    // isLoaded flips true only once BOTH video data AND the Songle audio timer are
    // ready. This guarantees that requestPlay() called from a user gesture reaches
    // Songle synchronously (no awaited Promises in between), staying inside the
    // browser's autoplay gesture-token window so audio actually plays.
    const checkReady = () => {
      if (videoReady && timerReady && !disposed) setIsLoaded(true)
    }

    const p = new Player({
      app: { token: 'eaFarhRWbobOZTyd' },
      mediaElement: mediaRef.current!,
    })

    p.addListener({
      onAppReady(app: IPlayerApp) {
        if (disposed) return
        if (!app.songUrl) {
          p.createFromSongUrl('https://piapro.jp/t/GCgy/20250202202635', {
            video: {
              beatId: 4694279,
              chordId: 2830734,
              repetitiveSegmentId: 2946482,
              lyricId: 67814,
              lyricDiffId: 20658,
            },
          })
        }
      },


      onVideoReady(v: IVideo) {
        if (disposed) return

        // ── Char lyrics for RandomizedTile ──
        const chars: Lyric[] = []
        let c = v.firstChar as IChar | null
        while (c) { chars.push(new Lyric(c)); c = c.next as IChar | null }
        setCharLyrics(chars)

        // ── Word lyrics for DinoChrome ──
        const words: WordLyric[] = []
        let w = v.firstWord as IWord | null
        while (w) {
          if (w.text?.trim()) words.push({ text: w.text, startTime: w.startTime })
          w = w.next as IWord | null
        }

        setWordLyrics(words)

        setSongDuration(v.duration ?? 0)
        videoReady = true
        checkReady()
      },

      // onTimerReady fires when the Songle audio engine is fully initialised.
      // Only after this point will requestPlay() from a gesture play audio
      // synchronously without any async gap that would expire the gesture token.
      onTimerReady() {
        if (disposed) return
        timerReady = true
        checkReady()
      },
    })

    setPlayer(p)

    return () => {
      disposed = true
      setPlayer(null)
      setIsLoaded(false)
      setCharLyrics([])
      setWordLyrics([])
      setSongDuration(0)
      if (typeof p.dispose === 'function') p.dispose()
    }
  }, [])

  return (
    <div id="app-root">
      <nav id="app-nav">
        <button
          className={`nav-btn${page === 'dino' ? ' active' : ''}`}
          onClick={() => setPage('dino')}
        >
          Dino Chrome
        </button>
        <button
          className={`nav-btn${page === 'lyric' ? ' active' : ''}`}
          onClick={() => setPage('lyric')}
        >
          Lyric Tiles
        </button>
        <button
          className={`nav-btn${page === 'maze' ? ' active' : ''}`}
          onClick={() => setPage('maze')}
        >
          Maze
        </button>
      </nav>

      <div id="app-content">
        {page === 'maze' && <Maze />}
        {page === 'dino' && <DinoChrome
            player={player}
            wordLyrics={wordLyrics}
            songDuration={songDuration}
            isLoaded={isLoaded}
          />}
        {page === 'lyric' && <RandomizedTile
          player={player}
          charLyrics={charLyrics}
          isLoaded={isLoaded}
        />}
      </div>

      {/* TextAlive media widget — lives in App so it persists across tab switches */}
      <div id="app-media" ref={mediaRef} />
    </div>
  )
}
