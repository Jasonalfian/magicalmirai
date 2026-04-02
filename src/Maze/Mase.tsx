import { useEffect, useRef } from "react";

const map = [
  [1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,1],
  [1,0,1,0,1,0,0,1],
  [1,0,1,0,1,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1],
];

// Store permanent wall colors
const wallColors: Record<string, string> = {};

export default function Maze() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pos = useRef({ x: 1.5, y: 1.5 });
  const dir = useRef(0);
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const handleKey = (e: KeyboardEvent) => {
      keys.current[e.key] = e.type === "keydown";
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);

    function movePlayer() {
      const speed = 0.05;
      const rotSpeed = 0.03;
      if (keys.current["w"]) {
        const nx = pos.current.x + Math.cos(dir.current) * speed;
        const ny = pos.current.y + Math.sin(dir.current) * speed;
        if (map[Math.floor(ny)][Math.floor(nx)] === 0) {
          pos.current.x = nx;
          pos.current.y = ny;
        }
      }
      if (keys.current["s"]) {
        const nx = pos.current.x - Math.cos(dir.current) * speed;
        const ny = pos.current.y - Math.sin(dir.current) * speed;
        if (map[Math.floor(ny)][Math.floor(nx)] === 0) {
          pos.current.x = nx;
          pos.current.y = ny;
        }
      }
      if (keys.current["a"]) dir.current -= rotSpeed;
      if (keys.current["d"]) dir.current += rotSpeed;
    }

    function splashColor() {
      if (keys.current[" "]) { // Space key
        const rayX = pos.current.x + Math.cos(dir.current);
        const rayY = pos.current.y + Math.sin(dir.current);
        const cellX = Math.floor(rayX);
        const cellY = Math.floor(rayY);
        if (map[cellY][cellX] === 1) {
          // Assign a random bright color permanently
          wallColors[`${cellX},${cellY}`] =
            wallColors[`${cellX},${cellY}`] || `hsl(${Math.random() * 360}, 80%, 60%)`;
        }
      }
    }

    function draw() {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let col = 0; col < canvas.width; col++) {
        const angle = dir.current - 0.5 + (col / canvas.width);
        let dist = 0;
        let hit = false;
        let rayX = pos.current.x;
        let rayY = pos.current.y;
        let hitCell = null;

        while (!hit && dist < 20) {
          rayX += Math.cos(angle) * 0.05;
          rayY += Math.sin(angle) * 0.05;
          dist += 0.05;
          const mx = Math.floor(rayX);
          const my = Math.floor(rayY);
          if (my < 0 || my >= map.length || mx < 0 || mx >= map[0].length) { hit = true; break; }
          if (map[my][mx] === 1) {
            hit = true;
            hitCell = { x: mx, y: my };
          }
        }

        const wallHeight = canvas.height / dist;
        let shade = Math.max(0, 255 - dist * 15);
        let color = `rgb(${shade}, ${shade}, ${shade})`;

        if (hitCell) {
          const key = `${hitCell.x},${hitCell.y}`;
          if (wallColors[key]) {
            color = wallColors[key]; // permanent splash color
          }
        }

        ctx.fillStyle = color;
        ctx.fillRect(col, (canvas.height/2 - wallHeight/2), 1, wallHeight);
      }
    }

    let rafId: number;
    function loop() {
      movePlayer();
      splashColor();
      draw();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  return <canvas ref={canvasRef} width={600} height={400} />;
}
