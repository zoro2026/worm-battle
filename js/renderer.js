// 像素風渲染層
export class Renderer {
  constructor(canvas, terrain) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = terrain;
    this.img = this.ctx.createImageData(terrain.w, terrain.h);
    this.dpr = window.devicePixelRatio || 1;
  }

  resize() {
    const c = this.canvas;
    c.width = this.terrain.w;
    c.height = this.terrain.h;
    c.style.width = '100%';
    c.style.height = '100%';
  }

  // 天空 + 星星（固定 seed）
  drawSky() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.terrain.h);
    g.addColorStop(0, '#1a1030');
    g.addColorStop(0.45, '#3a2050');
    g.addColorStop(1, '#7a4a58');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.terrain.w, this.terrain.h);
    // 星星
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 999.7) * 0.5 + 0.5) * this.terrain.w;
      const y = (Math.sin(i * 333.1) * 0.5 + 0.5) * this.terrain.h * 0.45;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    // 月亮
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(this.terrain.w * 0.84, this.terrain.h * 0.14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(58,32,80,.9)';
    ctx.beginPath();
    ctx.arc(this.terrain.w * 0.84 - 6, this.terrain.h * 0.14 - 4, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // 地形（用 ImageData 逐像素，像素風 + 表層草皮）
  drawTerrain() {
    const t = this.terrain;
    const d = this.img.data;
    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        const i = (y * t.w + x) * 4;
        if (t.mask[y * t.w + x]) {
          const depth = y - t.height[x];
          let r, g, b;
          if (depth < 2) { r = 96; g = 176; b = 78; }        // 草皮
          else if (depth < 5) { r = 74; g = 128; b = 62; }   // 過渡
          else {
            // 泥土：用雜訊做出質感
            const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
            const v = Math.abs(n) * 26;
            r = 96 + v; g = 66 + v * 0.7; b = 48 + v * 0.5;
          }
          // 暗角效果
          const shade = 1 - Math.min(0.35, depth / t.h * 0.8);
          d[i] = r * shade; d[i + 1] = g * shade; d[i + 2] = b * shade; d[i + 3] = 255;
        } else {
          d[i + 3] = 0;
        }
      }
    }
    // 用一個 offscreen 貼上
    const off = Renderer._off || (Renderer._off = document.createElement('canvas'));
    off.width = t.w; off.height = t.h;
    off.getContext('2d').putImageData(this.img, 0, 0);
    this.ctx.drawImage(off, 0, 0);
  }

  // 蟲（像素風小蟲：身體 + 頭 + 眼）
  drawWorm(w, isActive) {
    if (!w.alive) return;
    const ctx = this.ctx;
    const x = Math.round(w.x), y = Math.round(w.y);
    const body = w.team === 'blue' ? '#4a9eff' : '#ff5a4a';
    const dark = w.team === 'blue' ? '#2a5fa8' : '#a83028';

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身體（3 段，像素感）
    ctx.fillStyle = body;
    ctx.fillRect(x - 5, y - 9, 10, 9);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 5, y - 3, 10, 3);
    // 頭
    ctx.fillStyle = body;
    ctx.fillRect(x - 4, y - 13, 8, 5);
    // 眼
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y - 12, 2, 2);
    ctx.fillRect(x + 1, y - 12, 2, 2);
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 3 + (w.facing > 0 ? 1 : 0), y - 12, 1, 2);
    ctx.fillRect(x + 1 + (w.facing > 0 ? 1 : 0), y - 12, 1, 2);

    // 當前蟲：黃色三角指示
    if (isActive) {
      ctx.fillStyle = '#ffd24a';
      const bob = Math.sin(Date.now() / 200) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 20 + bob);
      ctx.lineTo(x - 5, y - 27 + bob);
      ctx.lineTo(x + 5, y - 27 + bob);
      ctx.closePath();
      ctx.fill();
    }

    // 血條
    const hpw = 18;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x - hpw / 2 - 1, y - 34, hpw + 2, 4);
    ctx.fillStyle = w.hp > 50 ? '#5ce65c' : (w.hp > 25 ? '#ffd24a' : '#ff5a4a');
    ctx.fillRect(x - hpw / 2, y - 33, hpw * (w.hp / w.maxHp), 2);
  }

  // 瞄準線（虛線拋物線預覽）
  drawAim(w, phys) {
    if (!w.alive) return;
    const ctx = this.ctx;
    const m = w.muzzle();
    const speed = 8.2;
    let x = m.x, y = m.y, vx = Math.cos(w.angle) * speed, vy = Math.sin(w.angle) * speed;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 42; i++) {
      vy += phys.gravity;
      vx += phys.wind * phys.windAccel * 10;
      x += vx; y += vy;
      if (y > this.terrain.h) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 砲口指向線
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.center().x, w.center().y);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
  }

  drawProjectile(p) {
    const ctx = this.ctx;
    // 尾跡
    if (p.trail.length > 1) {
      ctx.strokeStyle = p.type === 'grenade' ? 'rgba(255,180,80,.6)' : 'rgba(255,120,60,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.trail[0][0], p.trail[0][1]);
      for (const [tx, ty] of p.trail) ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.type === 'grenade') {
      ctx.fillStyle = '#3a5a3a';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 1, y - 6, 2, 3);
    } else {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x - 4, y - 2, 8, 4);
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(x + 2, y - 1, 3, 2);
    }
  }

  drawParticles(parts) {
    const ctx = this.ctx;
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (p.life / p.maxLife)));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
