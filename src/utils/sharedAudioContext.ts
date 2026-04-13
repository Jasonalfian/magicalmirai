// Singleton AudioContext shared across the app.
// Must be initialised (via initSharedAudioContext) inside a user-gesture handler
// so the browser allows audio playback without an autoplay block.
let ctx: AudioContext | null = null;

export const initSharedAudioContext = () => {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* ignore */
    });
  }
  return ctx;
};

export const getSharedAudioContext = () => {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
};

export const closeSharedAudioContext = () => {
  ctx?.close();
  ctx = null;
};
