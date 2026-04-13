import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { SONGS } from "../constant";

const PREVIEW_DURATION = 15; // seconds to play before looping back
const FADE_DURATION = 0.6; // seconds

export function useSongPreview(focusedIdx: number) {
  const [debouncedIdx] = useDebounce(focusedIdx, 1000);

  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each effect cycle (new song) gets a unique session ID.
  // play() captures its own ID and bails as soon as it no longer matches,
  // preventing any in-flight async work from a previous song from overlapping.
  const sessionRef = useRef(0);

  // Lazily create a single shared AudioContext
  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const stopCurrent = (immediate = false) => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const gain = gainRef.current;
    const ctx = audioCtxRef.current;
    const source = sourceRef.current;
    if (!gain || !ctx || !source) return;

    // Clear refs immediately so the next play() gets clean slate.
    // We keep local snapshots to still fade/stop this specific source.
    gainRef.current = null;
    sourceRef.current = null;

    if (immediate) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      return;
    }

    // Fade out then stop the specific source captured above
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);
    stopTimerRef.current = setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      stopTimerRef.current = null;
    }, FADE_DURATION * 1000);
  };

  useEffect(() => {
    const previewUrl = SONGS[debouncedIdx]?.preview;
    if (!previewUrl) return;

    const targetVolume = SONGS[debouncedIdx]?.previewVolume ?? 1;

    // Stamp this effect run with a unique session ID.
    // The cleanup increments it, so any stale async play() from this
    // session immediately bails when it checks sessionRef.current.
    const sessionId = ++sessionRef.current;

    const play = async () => {
      if (sessionRef.current !== sessionId) return;

      // Fade out whatever is currently playing before starting the new song
      stopCurrent();

      // Wait for half the fade duration before loading new audio
      await new Promise((r) => setTimeout(r, FADE_DURATION * 500));
      if (sessionRef.current !== sessionId) return;

      try {
        const ctx = getCtx();
        await ctx.resume();
        if (sessionRef.current !== sessionId) return;

        const response = await fetch(encodeURI(previewUrl));
        if (sessionRef.current !== sessionId) return;
        const arrayBuffer = await response.arrayBuffer();
        if (sessionRef.current !== sessionId) return;
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (sessionRef.current !== sessionId) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
          mutedRef.current ? 0 : targetVolume,
          ctx.currentTime + FADE_DURATION,
        );

        source.connect(gain);
        gain.connect(ctx.destination);
        // Always start from the beginning (handles both new song and loop)
        source.start(0);

        gainRef.current = gain;
        sourceRef.current = source;

        // Fade out just before PREVIEW_DURATION, then loop back
        stopTimerRef.current = setTimeout(
          () => {
            if (sessionRef.current !== sessionId) return;
            play();
          },
          (PREVIEW_DURATION - FADE_DURATION) * 1000,
        );
      } catch {
        /* audio context suspended or fetch failed — silently ignore */
      }
    };

    play();

    return () => {
      // Incrementing the session ref invalidates all in-flight async steps.
      // Using a local alias satisfies the lint rule (this ref is not a DOM node).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sessionRef.current++;
      stopCurrent();
    };
  }, [debouncedIdx]);

  // Stop and clean up when the component using this hook unmounts
  useEffect(() => {
    return () => {
      stopCurrent(true);
      audioCtxRef.current?.close();
    };
  }, []);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    const gain = gainRef.current;
    const ctx = audioCtxRef.current;
    if (!gain || !ctx) return;
    const targetVolume = SONGS[debouncedIdx]?.previewVolume ?? 1;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(
      next ? 0 : targetVolume,
      now + FADE_DURATION,
    );
  };

  return { muted, toggleMute };
}
