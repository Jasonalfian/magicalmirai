import { useState, useEffect, useRef, useMemo } from "react";

interface PauseMenuProps {
  onResume?: () => void;
  onRestart: () => void;
  onBackToHome?: () => void;
}

export default function PauseMenu({
  onResume,
  onRestart,
  onBackToHome,
}: PauseMenuProps) {
  const items = useMemo(() => {
    const list: { label: string; onClick: () => void; danger: boolean }[] = [];
    if (onResume)
      list.push({ label: "▶ Continue", onClick: onResume, danger: false });
    list.push({ label: "↺ Restart", onClick: onRestart, danger: false });
    if (onBackToHome)
      list.push({
        label: "← Song Select",
        onClick: onBackToHome,
        danger: true,
      });
    return list;
  }, [onResume, onRestart, onBackToHome]);

  const [focusedIdx, setFocusedIdx] = useState(0);
  const focusedIdxRef = useRef(0);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const its = itemsRef.current;
      const cur = focusedIdxRef.current;
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const next = (cur + 1) % its.length;
        focusedIdxRef.current = next;
        setFocusedIdx(next);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const next = (cur - 1 + its.length) % its.length;
        focusedIdxRef.current = next;
        setFocusedIdx(next);
      } else if (e.code === "Enter") {
        e.preventDefault();
        its[cur]?.onClick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pause-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="pause-menu">
        <p className="pause-menu__title">PAUSED</p>
        {items.map((item, i) => (
          <button
            key={item.label}
            className={`pause-menu__btn${item.danger ? " pause-menu__btn--danger" : ""}${i === focusedIdx ? " pause-menu__btn--focused" : ""}`}
            onClick={item.onClick}
            onMouseEnter={() => {
              focusedIdxRef.current = i;
              setFocusedIdx(i);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
