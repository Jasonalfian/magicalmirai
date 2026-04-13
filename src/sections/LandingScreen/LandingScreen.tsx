import { initSharedAudioContext } from "../../utils/sharedAudioContext";

interface Props {
  onStart: () => void;
}

export default function LandingScreen({ onStart }: Props) {
  const handleInteraction = () => {
    // Create/resume AudioContext inside the user gesture so the browser
    // grants autoplay permission for subsequent preview playback.
    initSharedAudioContext();
    onStart();
  };

  return (
    <div
      className="landing"
      onClick={handleInteraction}
      onKeyDown={(e) => {
        if (e.code === "Space" || e.code === "Enter") handleInteraction();
      }}
      tabIndex={0}
      role="button"
      aria-label="Press anywhere to start"
    >
      <p className="landing__title">Magical Mirai 2026</p>
      <p className="landing__prompt">Press anywhere to Start</p>
    </div>
  );
}
