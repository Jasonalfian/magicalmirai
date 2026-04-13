import { useRef, useEffect, useCallback, useState } from "react";
import type { Player } from "textalive-app-api";
import { CanvasManager } from "../../utils/CanvasManager";
import type { Lyric } from "../../utils/CanvasManager";
import "./RandomizedTile.css";
import PauseMenu from "../../components/PauseMenu/PauseMenu";

interface Props {
  player: Player | null;
  charLyrics: Lyric[];
  isLoaded: boolean;
  onBackToHome?: () => void;
}

export default function RandomizedTile({
  player,
  charLyrics,
  isLoaded,
  onBackToHome,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const playerRef = useRef<Player | null>(player);
  const positionRef = useRef(-1);
  const updateTimeRef = useRef(-1);
  const rafRef = useRef<number>(0);
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Keep playerRef in sync with prop change
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback(() => {
    const manager = managerRef.current;
    const p = playerRef.current;
    if (
      manager &&
      p?.isPlaying &&
      updateTimeRef.current >= 0 &&
      positionRef.current >= 0
    ) {
      const interpolated =
        Date.now() - updateTimeRef.current + positionRef.current;
      manager.update(interpolated);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Forward lyrics to CanvasManager whenever prop changes ─────────────────
  useEffect(() => {
    if (charLyrics.length && managerRef.current) {
      managerRef.current.setLyrics(charLyrics);
    }
  }, [charLyrics]);

  // ── Subscribe to player time updates; stop on unmount ────────────────────
  useEffect(() => {
    if (!player) return;
    let mounted = true;
    player.addListener({
      onTimeUpdate(position: number) {
        if (!mounted) return;
        positionRef.current = position;
        updateTimeRef.current = Date.now();
      },
    });
    return () => {
      mounted = false;
      if (typeof player.requestStop === "function") player.requestStop();
      else if (player.isPlaying) player.requestPause();
    };
  }, [player]);

  // ── Canvas setup + animation loop ─────────────────────────────────────────
  useEffect(() => {
    const manager = new CanvasManager(canvasRef.current!);
    managerRef.current = manager;

    if (charLyrics.length) manager.setLyrics(charLyrics);

    const onMouseMove = (e: MouseEvent) => manager.handleMouseMove(e);
    const onMouseLeave = () => manager.handleMouseLeave();
    const onTouchMove = (e: TouchEvent) => manager.handleMouseMove(e);
    const onTouchEnd = () => manager.handleMouseLeave();
    const onResize = () => manager.resize();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    if ("ontouchstart" in window) {
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", onTouchEnd);
    }
    window.addEventListener("resize", onResize);

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const next = !isPausedRef.current;
      isPausedRef.current = next;
      setIsPaused(next);
      const p = playerRef.current;
      if (p && hasStartedRef.current) {
        if (next) {
          if (p.isPlaying) p.requestPause();
        } else {
          if (!p.isPlaying) p.requestPlay();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (
      hasStartedRef.current &&
      playerRef.current &&
      !playerRef.current.isPlaying
    ) {
      playerRef.current.requestPlay();
    }
  }, []);

  const handleRestart = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    hasStartedRef.current = false;
    setHasStarted(false);
    positionRef.current = -1;
    updateTimeRef.current = -1;
    const p = playerRef.current;
    if (p) {
      try {
        if (typeof p.requestStop === "function") p.requestStop();
        else if (p.isPlaying) p.requestPause();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleClick = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    // Unlock AudioContext within user gesture (browser autoplay policy)
    try {
      void new AudioContext().resume();
    } catch {
      /* ignore */
    }
    setHasStarted(true);
    hasStartedRef.current = true;
    if (p.isPlaying) p.requestPause();
    else p.requestPlay();
  }, []);

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

      <div id="view" onClick={handleClick}>
        <canvas ref={canvasRef} />
        {isPaused && (
          <PauseMenu
            onResume={handleResume}
            onRestart={handleRestart}
            onBackToHome={onBackToHome}
          />
        )}
      </div>
    </>
  );
}
