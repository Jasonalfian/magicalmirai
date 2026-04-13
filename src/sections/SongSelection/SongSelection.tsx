import { useState, useRef, useEffect } from "react";
import { SONGS } from "../../constant";
import { useSongPreview } from "../../hooks/useSongPreview";

interface Props {
  onSelectSong: (idx: number) => void;
}

export default function SongSelection({ onSelectSong }: Props) {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const focusedIdxRef = useRef(0);
  const onSelectSongRef = useRef(onSelectSong);

  const { muted, toggleMute } = useSongPreview(focusedIdx);

  // Keep the ref fresh on every render without stale closure issues
  useEffect(() => {
    onSelectSongRef.current = onSelectSong;
  });

  // Keyboard navigation: ↑/↓ to move focus, Enter to select
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const next = (focusedIdxRef.current + 1) % SONGS.length;
        focusedIdxRef.current = next;
        setFocusedIdx(next);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const next = (focusedIdxRef.current - 1 + SONGS.length) % SONGS.length;
        focusedIdxRef.current = next;
        setFocusedIdx(next);
      } else if (e.code === "Enter") {
        e.preventDefault();
        onSelectSongRef.current(focusedIdxRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="song-picker">
      <div className="song-picker__header">
        <h2 className="song-picker__title">SELECT A SONG</h2>
        <button
          className="song-picker__mute-btn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          title={muted ? "Unmute preview" : "Mute preview"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
      <ul className="song-picker__list">
        {SONGS.map((s, i) => (
          <li key={i}>
            <button
              className={`song-picker__item${
                i === focusedIdx ? " song-picker__item--focused" : ""
              }`}
              onClick={() => onSelectSong(i)}
              onMouseEnter={() => {
                focusedIdxRef.current = i;
                setFocusedIdx(i);
              }}
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
  );
}
