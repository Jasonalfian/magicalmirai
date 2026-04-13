export interface SongEntry {
  title: string;
  artist: string;
  url: string;
  preview: string;
  /** Gain multiplier for the preview (0.0 – 1.0). Adjust per-song to balance loudness. */
  previewVolume: number;
  options: { video: { lyricId: number; lyricDiffId: number } };
}

export const SONGS: SongEntry[] = [
  {
    title: "answer me",
    artist: "Imie",
    url: "https://piapro.jp/t/6W2N/20251215164617",
    preview: "/music/answer-me.mp3",
    previewVolume: 1.0,
    options: { video: { lyricId: 126519, lyricDiffId: 28626 } },
  },
  {
    title: "After the curtain",
    artist: "Rulmry",
    url: "https://piapro.jp/t/zoqO/20251214200738",
    preview: "/music/after-the-curtain.mp3",
    previewVolume: 1.0,
    options: { video: { lyricId: 126591, lyricDiffId: 28627 } },
  },
  {
    title: "Shutter Chance",
    artist: "Yamiagari",
    url: "https://piapro.jp/t/PNpQ/20251209170719",
    preview: "/music/shutter-chance.mp3",
    previewVolume: 0.8,
    options: { video: { lyricId: 126542, lyricDiffId: 28628 } },
  },
  {
    title: "The last march on earth",
    artist: "Natsuyama Yotsugi × Dopam!ne",
    url: "https://piapro.jp/t/B3yJ/20251215061727",
    preview: "/music/the-last-march-on-earth.mp3",
    previewVolume: 0.6,
    options: { video: { lyricId: 126594, lyricDiffId: 28629 } },
  },
  {
    title: "Toritsukulogy",
    artist: "Tsuruzou",
    url: "https://piapro.jp/t/QBdL/20251215094303",
    preview: "/music/toritsukulogy.mp3",
    previewVolume: 1.0,
    options: { video: { lyricId: 126593, lyricDiffId: 28630 } },
  },
  {
    title: "Takeover",
    artist: "Twinfield",
    url: "https://piapro.jp/t/E2i3/20251215092113",
    preview: "/music/takeover.mp3",
    previewVolume: 0.8,
    options: { video: { lyricId: 126533, lyricDiffId: 28631 } },
  },
];
