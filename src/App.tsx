import DinoChrome from "./sections/DinoChrome/DinoChrome";
import RandomizedTile from "./sections/RandomizedTile/RandomizedTile";
import Maze from "./sections/Maze/Maze";
import SongSelection from "./sections/SongSelection/SongSelection";
import { useHomePage } from "./hooks/useHomePage";
import "./App.css";

export default function App() {
  const {
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
  } = useHomePage();

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
        <SongSelection onSelectSong={handleSelectSong} />
      )}

      {selectedSongIdx !== null && (
        <div id="app-content">
          {page === "maze" && <Maze onBackToHome={handleBackToHome} />}
          {page === "dino" && (
            <DinoChrome
              player={player}
              wordLyrics={wordLyrics}
              songDuration={songDuration}
              isLoaded={isLoaded}
              onBackToHome={handleBackToHome}
            />
          )}
          {page === "lyric" && (
            <RandomizedTile
              player={player}
              charLyrics={charLyrics}
              isLoaded={isLoaded}
              onBackToHome={handleBackToHome}
            />
          )}
        </div>
      )}

      {showVolume && <div className="volume-toast">VOL {volume}%</div>}

      {/* TextAlive media widget — lives in App so it persists across tab switches */}
      <div id="app-media" ref={mediaRef} />
    </div>
  );
}
