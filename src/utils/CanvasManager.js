/**
 * Represents a single lyric character with its timing and grid placement data.
 */
export class Lyric {
  constructor(data) {
    this.text      = data.text;      // The lyric character
    this.startTime = data.startTime; // Time when the character starts [ms]
    this.endTime   = data.endTime;   // Time when the character ends [ms]
    this.duration  = data.duration;  // Duration from start to end [ms]

    this.x      = 0;     // Assigned grid coordinate x
    this.y      = 0;     // Assigned grid coordinate y
    this.isDraw = false; // Whether this character is currently visible
  }
}

/**
 * Handles all canvas rendering: the scrolling crosshair background and
 * lyric character tiles. Unlike the original, this class does NOT create
 * or mount the canvas — it receives the existing canvas element as a
 * constructor argument so React controls the DOM.
 */
export class CanvasManager {
  constructor(canvas) {
    // Current scroll offset (world-space origin relative to screen top-left)
    this._px = 0;
    this._py = 0;

    // Normalized mouse position (center = 0, range: -1 to 1 on each axis)
    this._rx = 0;
    this._ry = 0;

    // Size of one grid cell [px]
    this._space = 160;

    // Scroll speed (px per second at full mouse deflection)
    this._speed = 1500;

    // Current playback position of the song [ms]
    this._position = 0;

    // Whether the mouse is currently over the window
    this._isOver = false;

    // Mouse position in screen pixels (NaN until first mouse event)
    this._mouseX = NaN;
    this._mouseY = NaN;

    this._lyrics = null;

    // Use the canvas element provided by React instead of creating one
    this._can = canvas;
    this._ctx = canvas.getContext('2d');

    // On touch devices, halve the grid size and scroll speed for usability
    if ('ontouchstart' in window) {
      this._space *= 0.5;
      this._speed *= 0.5;
    }

    this.resize();
  }

  /** Store the lyrics array for rendering. */
  setLyrics(lyrics) {
    this._lyrics = lyrics;
  }

  /**
   * Called every frame with the current playback position [ms].
   * Updates the scroll offset and redraws the canvas.
   */
  update(position) {
    // Auto-mode: when the mouse is outside the window, simulate movement with sin/cos
    if (!this._isOver) {
      this._rx = Math.sin(position / 1234 + 0.123) * 0.3 + 0.2;
      this._ry = Math.cos(position / 1011 + 0.111) * 0.5;
      this._mouseX = this._stw * (this._rx + 1) / 2;
      this._mouseY = this._sth * (this._ry + 1) / 2;
    }

    // Update scroll offset based on mouse position and elapsed time
    const delta = (position - this._position) / 1000; // seconds since last frame
    this._px += -this._rx * delta * this._speed;
    this._py += -this._ry * delta * this._speed;

    this._drawBg();
    this._drawLyrics();

    this._position = position;
  }

  /** Resize the canvas to fill the window. Call on window resize. */
  resize() {
    this._can.width  = this._stw = document.documentElement.clientWidth;
    this._can.height = this._sth = document.documentElement.clientHeight;
  }

  /**
   * Handle mousemove / touchmove — update the tracked mouse position
   * and the normalized scroll direction.
   */
  handleMouseMove(e) {
    let mx, my;
    if (e.touches) {
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
  handleMouseLeave() {
    this._isOver = false;
  }

  // ─── Private drawing methods ─────────────────────────────────────────────

  /** Draw the scrolling crosshair grid background. */
  _drawBg() {
    const space = this._space;
    const ox = this._px % space;
    const oy = this._py % space;
    const nx = this._stw / space + 1;
    const ny = this._sth / space + 1;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._stw, this._sth);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const tx = x * space + ox;
        const ty = y * space + oy;
        // Draw a small + crosshair mark at each grid intersection
        ctx.moveTo(tx - 8, ty);
        ctx.lineTo(tx + 8, ty);
        ctx.moveTo(tx, ty - 8);
        ctx.lineTo(tx, ty + 8);
      }
    }
    ctx.stroke();
  }

  /** Draw each active lyric character tile onto the canvas. */
  _drawLyrics() {
    if (!this._lyrics) return;

    const position = this._position;
    const space    = this._space;
    const ctx      = this._ctx;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';

    for (let i = 0, l = this._lyrics.length; i < l; i++) {
      const lyric = this._lyrics[i];

      if (lyric.startTime < position) {
        // Playback is inside this character's active window
        if (position < lyric.endTime) {
          if (!isNaN(this._mouseX) && !lyric.isDraw) {
            // Convert the current mouse position from screen-space to grid coordinates
            const nx = Math.floor((-this._px + this._mouseX) / space);
            const ny = Math.floor((-this._py + this._mouseY) / space);

            let tx = 0, ty = 0, isOk = true;

            // Collision detection: spiral outward ring by ring until a free cell is found
            hitcheck: for (let n = 0; n <= 100; n++) {
              tx = n; ty = 0;
              let mx = -1, my = 1;
              const rn = n === 0 ? 1 : n * 4; // number of cells on this ring's perimeter

              // Walk around the current ring
              for (let r = 0; r < rn; r++) {
                isOk = true;
                for (let j = 0; j < i; j++) {
                  const tl = this._lyrics[j];
                  // This cell is already occupied by another lyric character
                  if (tl.isDraw && tl.x === nx + tx && tl.y === ny + ty) {
                    isOk = false;
                    break;
                  }
                }
                if (isOk) break hitcheck; // free cell found — stop searching

                // Advance to the next cell along the ring perimeter
                tx += mx; if (tx === n || tx === -n) mx = -mx;
                ty += my; if (ty === n || ty === -n) my = -my;
              }
            }

            // Assign the free grid cell and mark for rendering
            lyric.x      = nx + tx;
            lyric.y      = ny + ty;
            lyric.isDraw = true;
          }
        }

        // If this character has been assigned a cell, draw it
        if (lyric.isDraw) {
          let px = lyric.x * space;
          let py = lyric.y * space;

          // Skip characters that are entirely off-screen (culling)
          if (px + space < -this._px || -this._px + this._stw < px) continue;
          if (py + space < -this._py || -this._py + this._sth < py) continue;

          px = this._px + px + space / 2;
          py = this._py + py + space / 2;

          // Animate scale 0→1 over the first 200 ms using easeOutBack (spring/overshoot)
          const prog     = this._easeOutBack(Math.min((position - lyric.startTime) / 200, 1));
          const fontSize = space * 0.5 * prog;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(lyric.text, px, py + fontSize * 0.37);
        }
      } else {
        // Character's time window hasn't started — reset its grid cell assignment
        lyric.isDraw = false;
      }
    }
  }

  /** Easing function: ease-out with a spring/overshoot effect. */
  _easeOutBack(x) {
    return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
  }
}
