import type { IChar } from "textalive-app-api";

/**
 * Represents a single lyric character with timing and grid placement data.
 */
export class Lyric {
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  x = 0;
  y = 0;
  isDraw = false;

  constructor(data: IChar) {
    this.text = data.text;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.duration = data.duration;
  }
}

/**
 * Handles all canvas rendering: the scrolling crosshair background and
 * lyric character tiles. Receives an existing canvas element so React
 * controls the DOM.
 */
export class CanvasManager {
  private _px = 0;
  private _py = 0;
  private _rx = 0;
  private _ry = 0;
  private _space = 160;
  private _speed = 1500;
  private _position = 0;
  private _isOver = false;
  private _mouseX = NaN;
  private _mouseY = NaN;
  private _lyrics: Lyric[] | null = null;
  private _stw = 0;
  private _sth = 0;
  private _can: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this._can = canvas;
    this._ctx = canvas.getContext("2d")!;

    if ("ontouchstart" in window) {
      this._space *= 0.5;
      this._speed *= 0.5;
    }

    this.resize();
  }

  /** Store the lyrics array for rendering. */
  setLyrics(lyrics: Lyric[]): void {
    this._lyrics = lyrics;
  }

  /**
   * Called every frame with the current playback position [ms].
   * Updates the scroll offset and redraws the canvas.
   */
  update(position: number): void {
    if (!this._isOver) {
      this._rx = Math.sin(position / 1234 + 0.123) * 0.3 + 0.2;
      this._ry = Math.cos(position / 1011 + 0.111) * 0.5;
      this._mouseX = (this._stw * (this._rx + 1)) / 2;
      this._mouseY = (this._sth * (this._ry + 1)) / 2;
    }

    const delta = (position - this._position) / 1000;
    this._px += -this._rx * delta * this._speed;
    this._py += -this._ry * delta * this._speed;

    this._drawBg();
    this._drawLyrics();

    this._position = position;
  }

  /** Resize the canvas to fill the window. Call on window resize. */
  resize(): void {
    this._can.width = this._stw = document.documentElement.clientWidth;
    this._can.height = this._sth = document.documentElement.clientHeight;
  }

  /** Handle mousemove / touchmove — update mouse position and scroll direction. */
  handleMouseMove(e: MouseEvent | TouchEvent): void {
    let mx: number, my: number;
    if ("touches" in e) {
      mx = e.touches[0].clientX;
      my = e.touches[0].clientY;
    } else {
      mx = e.clientX;
      my = e.clientY;
    }
    this._mouseX = mx;
    this._mouseY = my;
    this._rx = (mx / this._stw) * 2 - 1;
    this._ry = (my / this._sth) * 2 - 1;
    this._isOver = true;
  }

  /** Handle mouseleave / touchend — switch back to auto-mode. */
  handleMouseLeave(): void {
    this._isOver = false;
  }

  // ─── Private drawing methods ─────────────────────────────────────────────

  private _drawBg(): void {
    const space = this._space;
    const ox = this._px % space;
    const oy = this._py % space;
    const nx = this._stw / space + 1;
    const ny = this._sth / space + 1;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._stw, this._sth);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const tx = x * space + ox;
        const ty = y * space + oy;
        ctx.moveTo(tx - 8, ty);
        ctx.lineTo(tx + 8, ty);
        ctx.moveTo(tx, ty - 8);
        ctx.lineTo(tx, ty + 8);
      }
    }
    ctx.stroke();
  }

  private _drawLyrics(): void {
    if (!this._lyrics) return;

    const position = this._position;
    const space = this._space;
    const ctx = this._ctx;

    ctx.textAlign = "center";
    ctx.fillStyle = "#000";

    for (let i = 0, l = this._lyrics.length; i < l; i++) {
      const lyric = this._lyrics[i];

      if (lyric.startTime < position) {
        if (position < lyric.endTime) {
          if (!isNaN(this._mouseX) && !lyric.isDraw) {
            const nx = Math.floor((-this._px + this._mouseX) / space);
            const ny = Math.floor((-this._py + this._mouseY) / space);

            let tx = 0,
              ty = 0,
              isOk = true;

            hitcheck: for (let n = 0; n <= 100; n++) {
              tx = n;
              ty = 0;
              let mx = -1,
                my = 1;
              const rn = n === 0 ? 1 : n * 4;

              for (let r = 0; r < rn; r++) {
                isOk = true;
                for (let j = 0; j < i; j++) {
                  const tl = this._lyrics[j];
                  if (tl.isDraw && tl.x === nx + tx && tl.y === ny + ty) {
                    isOk = false;
                    break;
                  }
                }
                if (isOk) break hitcheck;

                tx += mx;
                if (tx === n || tx === -n) mx = -mx;
                ty += my;
                if (ty === n || ty === -n) my = -my;
              }
            }

            lyric.x = nx + tx;
            lyric.y = ny + ty;
            lyric.isDraw = true;
          }
        }

        if (lyric.isDraw) {
          let px = lyric.x * space;
          let py = lyric.y * space;

          if (px + space < -this._px || -this._px + this._stw < px) continue;
          if (py + space < -this._py || -this._py + this._sth < py) continue;

          px = this._px + px + space / 2;
          py = this._py + py + space / 2;

          const prog = this._easeOutBack(
            Math.min((position - lyric.startTime) / 200, 1),
          );
          const fontSize = space * 0.5 * prog;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(lyric.text, px, py + fontSize * 0.37);
        }
      } else {
        lyric.isDraw = false;
      }
    }
  }

  private _easeOutBack(x: number): number {
    return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
  }
}
