import { useState } from 'react'
import DinoChrome from './DinoChrome/DinoChrome'
import RandomizedTile from './RandomizedTile/RandomizedTile'
import './App.css'

export default function App() {
  const [page, setPage] = useState('dino')

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
      </nav>
      <div id="app-content">
        {page === 'dino' ? <DinoChrome /> : <RandomizedTile />}
      </div>
    </div>
  )
}
