import { useState, useRef } from "react";
import { Player } from "textalive-app-api";
import type { IVideo, IChar, IWord } from "textalive-app-api";
import { Lyric } from "./utils/CanvasManager";
import type { WordLyric } from "./types";
import DinoChrome from "./DinoChrome/DinoChrome";
import RandomizedTile from "./RandomizedTile/RandomizedTile";
import "./App.css";
import Maze from "./Maze/Maze";
import React from "react";

// ── Song catalogue ────────────────────────────────────────────────────────────
interface SongEntry {
  title: string;
  artist: string;
  url: string;
  options: { video: { lyricId: number; lyricDiffId: number } };
}

const SONGS: SongEntry[] = [
  {
    title: "answer me",
    artist: "Imie",
    url: "https://piapro.jp/t/6W2N/20251215164617",
    options: { video: { lyricId: 126519, lyricDiffId: 28626 } },
  },
  {
    title: "After the curtain",
    artist: "Rulmry",
    url: "https://piapro.jp/t/zoqO/20251214200738",
    options: { video: { lyricId: 126591, lyricDiffId: 28627 } },
  },
  {
    title: "Shutter Chance",
    artist: "Yamiagari",
    url: "https://piapro.jp/t/PNpQ/20251209170719",
    options: { video: { lyricId: 126542, lyricDiffId: 28628 } },
  },
  {
    title: "The last march on earth",
    artist: "Natsuyama Yotsugi × Dopam!ne",
    url: "https://piapro.jp/t/B3yJ/20251215061727",
    options: { video: { lyricId: 126594, lyricDiffId: 28629 } },
  },
  {
    title: "Toritsukulogy",
    artist: "Tsuruzou",
    url: "https://piapro.jp/t/QBdL/20251215094303",
    options: { video: { lyricId: 126593, lyricDiffId: 28630 } },
  },
  {
    title: "Takeover",
    artist: "Twinfield",
    url: "https://piapro.jp/t/E2i3/20251215092113",
    options: { video: { lyricId: 126533, lyricDiffId: 28631 } },
  },
];

export default function App() {
  const [page, setPage] = useState<"dino" | "lyric" | "maze">("dino");

  // ── Shared TextAlive Player state ─────────────────────────────────────────
  const mediaRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [charLyrics, setCharLyrics] = useState<Lyric[]>([]);
  const [wordLyrics, setWordLyrics] = useState<WordLyric[]>([]);
  const [songDuration, setSongDuration] = useState(0);
  const [selectedSongIdx, setSelectedSongIdx] = useState<number | null>(null);

  // Loading gate refs — resettable from handleSelectSong without recreating the Player
  const videoReadyRef = useRef(false);
  const timerReadyRef = useRef(false);

  React.useEffect(() => {
    // `disposed` is scoped to each Player instance. StrictMode runs setup+cleanup+setup,
    // so two Players are created. The first Player's callbacks are silenced by its own
    // `disposed = true` set during cleanup; the second Player's closure has disposed=false
    // and is the one that actually drives state.
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
        console.log("masuk2");
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

  const handleSelectSong = (idx: number) => {
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
  };

  return (
    <div id="app-root">
      <nav id="app-nav">
        <button
          className={`nav-btn${page === "dino" ? " active" : ""}`}
          onClick={() => setPage("dino")}
          disabled={selectedSongIdx === null || !isLoaded}
        >
          Dino Chrome
        </button>
        <button
          className={`nav-btn${page === "lyric" ? " active" : ""}`}
          onClick={() => setPage("lyric")}
          disabled={selectedSongIdx === null || !isLoaded}
        >
          Lyric Tiles
        </button>
        <button
          className={`nav-btn${page === "maze" ? " active" : ""}`}
          onClick={() => setPage("maze")}
          disabled={selectedSongIdx === null || !isLoaded}
        >
          Maze
        </button>
      </nav>

      {selectedSongIdx === null && (
        <div className="song-picker">
          <h2 className="song-picker__title">SELECT A SONG</h2>
          <ul className="song-picker__list">
            {SONGS.map((s, i) => (
              <li key={i}>
                <button
                  className="song-picker__item"
                  onClick={() => handleSelectSong(i)}
                >
                  <span className="song-picker__num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="song-picker__name">{s.title}</span>
                  <span className="song-picker__artist">— {s.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedSongIdx !== null && (
        <div id="app-content">
          {page === "maze" && <Maze />}
          {page === "dino" && (
            <DinoChrome
              player={player}
              wordLyrics={wordLyrics}
              songDuration={songDuration}
              isLoaded={isLoaded}
            />
          )}
          {page === "lyric" && (
            <RandomizedTile
              player={player}
              charLyrics={charLyrics}
              isLoaded={isLoaded}
            />
          )}
        </div>
      )}

      {/* TextAlive media widget — lives in App so it persists across tab switches */}
      <div id="app-media" ref={mediaRef} />
    </div>
  );
}
