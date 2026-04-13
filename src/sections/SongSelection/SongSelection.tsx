import { useState, useRef, useEffect } from "react";
import { SONGS } from "../../constant";

interface Props {
  onSelectSong: (idx: number) => void;
}

export default function SongSelection({ onSelectSong }: Props) {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const focusedIdxRef = useRef(0);
  const onSelectSongRef = useRef(onSelectSong);

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
      <h2 className="song-picker__title">SELECT A SONG</h2>
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
