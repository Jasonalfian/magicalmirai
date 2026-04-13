import { useState, useRef, useEffect, useCallback } from "react";
import { Player } from "textalive-app-api";
import type { IVideo, IChar, IWord } from "textalive-app-api";
import { Lyric } from "../utils/CanvasManager";
import type { WordLyric } from "../types";
import { SONGS } from "../constant";

export function useHomePage() {
  const [page, setPage] = useState<"dino" | "lyric" | "maze">("dino");

  // ── Shared TextAlive Player state ─────────────────────────────────────────
  const mediaRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [charLyrics, setCharLyrics] = useState<Lyric[]>([]);
  const [wordLyrics, setWordLyrics] = useState<WordLyric[]>([]);
  const [songDuration, setSongDuration] = useState(0);
  const [selectedSongIdx, setSelectedSongIdx] = useState<number | null>(null);

  // ── Volume state ──────────────────────────────────────────────────────────
  const volumeRef = useRef(50);
  const [volume, setVolume] = useState(50);
  const [showVolume, setShowVolume] = useState(false);
  const volumeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Loading gate refs — resettable from handleSelectSong without recreating the Player
  const videoReadyRef = useRef(false);
  const timerReadyRef = useRef(false);

  // ── Player setup ──────────────────────────────────────────────────────────
  // `disposed` is scoped to each Player instance. StrictMode runs setup+cleanup+setup,
  // so two Players are created. The first Player's callbacks are silenced by its own
  // `disposed = true` set during cleanup; the second Player's closure has disposed=false
  // and is the one that actually drives state.
  useEffect(() => {
    let disposed = false;

    // isLoaded flips true only once BOTH video data AND the Songle audio timer are
    // ready. This guarantees that requestPlay() called from a user gesture reaches
    // Songle synchronously (no awaited Promises in between), staying inside the
    // browser's autoplay gesture-token window so audio actually plays.
    const checkReady = () => {
      if (videoReadyRef.current && timerReadyRef.current && !disposed)
        setIsLoaded(true);
    };

    const p = new Player({
      app: { token: "PfaNl9adCvEQtcbP" },
      mediaElement: mediaRef.current!,
    });

    p.addListener({
      onAppReady() {
        /* song is loaded on demand via handleSelectSong */
      },

      onVideoReady(v: IVideo) {
        if (disposed) return;

        // ── Char lyrics for RandomizedTile ──
        const chars: Lyric[] = [];
        let c = v.firstChar as IChar | null;
        while (c) {
          chars.push(new Lyric(c));
          c = c.next as IChar | null;
        }
        setCharLyrics(chars);

        // ── Word lyrics for DinoChrome ──
        const words: WordLyric[] = [];
        let w = v.firstWord as IWord | null;
        while (w) {
          if (w.text?.trim())
            words.push({ text: w.text, startTime: w.startTime });
          w = w.next as IWord | null;
        }
        setWordLyrics(words);

        setSongDuration(v.duration ?? 0);
        videoReadyRef.current = true;
      },

      // onTimerReady fires when the Songle audio engine is fully initialised.
      // Only after this point will requestPlay() from a gesture play audio
      // synchronously without any async gap that would expire the gesture token.
      onTimerReady() {
        if (disposed) return;
        timerReadyRef.current = true;
        checkReady();
      },
    });

    setPlayer(p);

    return () => {
      disposed = true;
      videoReadyRef.current = false;
      timerReadyRef.current = false;
      setPlayer(null);
      setIsLoaded(false);
      setCharLyrics([]);
      setWordLyrics([]);
      setSongDuration(0);
      if (typeof p.dispose === "function") p.dispose();
    };
  }, []);

  // ── Song selection ────────────────────────────────────────────────────────
  const handleSelectSong = useCallback(
    (idx: number) => {
      if (!player) return;
      const song = SONGS[idx];
      videoReadyRef.current = false;
      timerReadyRef.current = false;
      setIsLoaded(false);
      setWordLyrics([]);
      setCharLyrics([]);
      setSongDuration(0);
      setSelectedSongIdx(idx);
      player.createFromSongUrl(song.url, song.options);
    },
    [player],
  );

  const handleBackToHome = useCallback(() => {
    try {
      if (typeof player?.requestStop === "function") player.requestStop();
      else if (player?.isPlaying) player?.requestPause();
    } catch {
      /* ignore */
    }
    videoReadyRef.current = false;
    timerReadyRef.current = false;
    setSelectedSongIdx(null);
    setIsLoaded(false);
    setWordLyrics([]);
    setCharLyrics([]);
    setSongDuration(0);
  }, [player]);

  // ── Volume key control ────────────────────────────────────────────────────
  useEffect(() => {
    const onVolumeKey = (e: KeyboardEvent) => {
      let newVol = volumeRef.current;
      if (e.key === "+" || e.key === "AudioVolumeUp") {
        newVol = Math.min(newVol + 10, 100);
      } else if (e.key === "-" || e.key === "AudioVolumeDown") {
        newVol = Math.max(newVol - 10, 0);
      } else {
        return;
      }
      e.preventDefault();
      volumeRef.current = newVol;
      if (player) player.volume = newVol;
      setVolume(newVol);
      setShowVolume(true);
      if (volumeToastTimerRef.current)
        clearTimeout(volumeToastTimerRef.current);
      volumeToastTimerRef.current = setTimeout(
        () => setShowVolume(false),
        1500,
      );
    };
    window.addEventListener("keydown", onVolumeKey);
    return () => window.removeEventListener("keydown", onVolumeKey);
  }, [player]);

  return {
    page,
    setPage,
    mediaRef,
    player,
    isLoaded,
    charLyrics,
    wordLyrics,
    songDuration,
    selectedSongIdx,
    volume,
    showVolume,
    handleSelectSong,
    handleBackToHome,
  };
}
