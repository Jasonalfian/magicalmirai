import { useRef, useEffect, useCallback, useState } from 'react'
import { Player } from 'textalive-app-api'
import { CanvasManager, Lyric } from '../utils/CanvasManager'
import './RandomizedTile.css'

export default function RandomizedTile() {
  const canvasRef     = useRef(null)  // ref to the <canvas> element
  const mediaRef      = useRef(null)  // ref to the media container div
  const playerRef     = useRef(null)  // TextAlive Player instance
  const managerRef    = useRef(null)  // CanvasManager instance
  const positionRef   = useRef(-1)    // latest playback position from the API [ms]
  const updateTimeRef = useRef(-1)    // wall-clock time of the last API update [ms]
  const rafRef        = useRef(null)  // requestAnimationFrame handle
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  /**
   * Animation loop — called every frame via requestAnimationFrame.
   * Interpolates the playback position between API callbacks to keep
   * the canvas animation smooth.
   */
  const animate = useCallback(() => {
    const manager = managerRef.current
    const player  = playerRef.current
    if (
      manager &&
      player?.isPlaying &&
      updateTimeRef.current >= 0 &&
      positionRef.current  >= 0
    ) {
      const interpolated = (Date.now() - updateTimeRef.current) + positionRef.current
      manager.update(interpolated)
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    // ── 1. Set up CanvasManager with the React-rendered canvas element ──
    const manager = new CanvasManager(canvasRef.current)
    managerRef.current = manager

    // ── 2. Register mouse / touch / resize event listeners ──
    const onMouseMove  = (e) => manager.handleMouseMove(e)
    const onMouseLeave = ()  => manager.handleMouseLeave()
    const onTouchMove  = (e) => manager.handleMouseMove(e)
    const onTouchEnd   = ()  => manager.handleMouseLeave()
    const onResize     = ()  => manager.resize()

    document.addEventListener('mousemove',  onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    if ('ontouchstart' in window) {
      document.addEventListener('touchmove', onTouchMove)
      document.addEventListener('touchend',  onTouchEnd)
    }
    window.addEventListener('resize', onResize)

    // ── 3. Initialise the TextAlive Player ──
    const player = new Player({
      // Token obtained from https://developer.textalive.jp/profile
      app: { token: 'eaFarhRWbobOZTyd' },
      mediaElement: mediaRef.current,
    })
    playerRef.current = player

    player.addListener({
      // App is ready — load the default song if none was provided externally
      onAppReady(app) {
        if (!app.songUrl) {
          // Parade Records / Kisara
          player.createFromSongUrl('https://piapro.jp/t/GCgy/20250202202635', {
            video: {
              // Music map correction history IDs
              beatId: 4694279,
              chordId: 2830734,
              repetitiveSegmentId: 2946482,
              // Lyrics timing correction history
              lyricId: 67814,
              lyricDiffId: 20658,
            },
          })
        }
      },

      // Video / lyric data ready — walk the linked list of characters
      onVideoReady(v) {
        const lyrics = []
        if (v.firstChar) {
          let c = v.firstChar
          while (c) {
            lyrics.push(new Lyric(c))
            c = c.next
          }
        }
        manager.setLyrics(lyrics)
        setIsLoaded(true)
      },

      // Called by the API on each playback position update
      onTimeUpdate(position) {
        positionRef.current   = position
        updateTimeRef.current = Date.now()
        manager.update(position)
      },
    })

    // ── 4. Start the animation loop ──
    rafRef.current = requestAnimationFrame(animate)

    // ── Cleanup on unmount ──
    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('mousemove',  onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
      window.removeEventListener('resize', onResize)
      if (typeof player.dispose === 'function') player.dispose()
    }
  }, [animate])

  // Click on the canvas area to play / pause
  const handleClick = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    setHasStarted(true)
    if (player.isPlaying) player.requestPause()
    else                  player.requestPlay()
  }, [])

  return (
    <>
      {!isLoaded && (
        <div id="loading">
          <div id="loading-spinner" />
          <p>Loading...</p>
        </div>
      )}

      {isLoaded && !hasStarted && (
        <div id="start-prompt">
          <p>Click anywhere to start</p>
        </div>
      )}

      {/* Main drawing area — click to play / pause */}
      <div id="view" onClick={handleClick}>
        <canvas ref={canvasRef} />
      </div>

      {/* TextAlive media / player widget (bottom-right corner) */}
      <div id="media" ref={mediaRef} />
    </>
  )
}
