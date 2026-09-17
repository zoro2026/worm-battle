// 地形：可破壞的高度圖 + 像素遮罩
// 原創實現：高度圖 + 徑向爆炸挖洞

export class Terrain {
  constructor(w, h, seed = 12345) {
    this.w = w;
    this.h = h;
    this.seed = seed;
    // 每個 x 像素嘅地面高度（y 值越小越高）
    this.height = new Float32Array(w);
    // 像素級破壞遮罩：1=實心, 0=挖空
    this.mask = new Uint8Array(w * h);
    this.generate();
  }

  // 簡易偽隨機（確定性）
  _rand(i) {
    const x = Math.sin(i * 12.9898 + this.seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  // 中點位移法生成山丘
  generate() {
    const w = this.w;
    const baseY = this.h * 0.62;
    const amp = this.h * 0.22;
    const segs = [2, 4, 8, 16, 32, 64, 128];
    const pts = [];
    pts[0] = baseY - amp * this._rand(0);
    pts[w - 1] = baseY - amp * this._rand(1);
    for (let s = 0; s < segs.length; s++) {
      const step = (w - 1) / segs[s];
      const prev = [...pts];
      for (let i = 0; i < segs[s]; i++) {
        const x0 = Math.round(i * step);
        const x1 = Math.round((i + 1) * step);
        const mid = Math.round((x0 + x1) / 2);
        if (x0 >= w - 1 || mid >= w) continue;
        const y0 = prev[x0] ?? baseY;
        const y1 = prev[x1] ?? baseY;
        const rough = amp * Math.pow(0.5, s + 1.5);
        pts[mid] = (y0 + y1) / 2 + (this._rand(s * 1000 + i) - 0.5) * rough * 2;
      }
    }
    for (let x = 0; x < w; x++) {
      let y = pts[x];
      if (y === undefined) {
        // 線性插值
        let l = x, r = x;
        while (pts[l] === undefined && l > 0) l--;
        while (pts[r] === undefined && r < w - 1) r++;
        const t = (x - l) / Math.max(1, r - l);
        y = pts[l] * (1 - t) + pts[r] * t;
      }
      this.height[x] = Math.max(this.h * 0.25, Math.min(this.h * 0.85, y));
    }
    this.rebuildMask();
  }

  rebuildMask() {
    for (let x = 0; x < this.w; x++) {
      const top = Math.floor(this.height[x]);
      for (let y = 0; y < this.h; y++) {
        this.mask[y * this.w + x] = y >= top ? 1 : 0;
      }
    }
  }

  // 爆炸挖洞（徑向 + 邊緣隨機粗糙）
  explode(cx, cy, radius) {
    const r2 = radius * radius;
    const removed = [];
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        // 邊緣粗糙：用雜訊微調有效半徑
        const rough = (this._rand(x * 7919 + y * 104729) - 0.5) * radius * 0.28;
        if (d2 <= (radius + rough) * (radius + rough)) {
          const idx = y * this.w + x;
          if (this.mask[idx]) {
            this.mask[idx] = 0;
            removed.push([x, y]);
          }
        }
      }
    }
    // 重算崩塌：上方懸空像素落下
    this.settle();
    // 更新高度圖（每個 x 由頂往下找第一個實心）
    for (let x = 0; x < this.w; x++) {
      let y = 0;
      while (y < this.h && !this.mask[y * this.w + x]) y++;
      this.height[x] = y >= this.h ? this.h : y;
    }
    return removed;
  }

  // 簡單崩塌：垂直落下
  settle() {
    for (let x = 0; x < this.w; x++) {
      const col = [];
      for (let y = 0; y < this.h; y++) {
        if (this.mask[y * this.w + x]) col.push(1); else col.push(0);
      }
      // 由上往下收集所有實心，重新由底部堆起
      let solidCount = col.reduce((a, b) => a + b, 0);
      for (let y = 0; y < this.h; y++) {
        this.mask[y * this.w + x] = (y >= this.h - solidCount) ? 1 : 0;
      }
    }
  }

  solidAt(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.w || yi < 0 || yi >= this.h) return false;
    return this.mask[yi * this.w + xi] === 1;
  }

  groundY(x) {
    const xi = Math.max(0, Math.min(this.w - 1, Math.floor(x)));
    return this.height[xi];
  }
}
