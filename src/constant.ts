export interface SongEntry {
  title: string;
  artist: string;
  url: string;
  options: { video: { lyricId: number; lyricDiffId: number } };
}

export const SONGS: SongEntry[] = [
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
