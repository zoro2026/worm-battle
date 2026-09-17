// 渲染層 v2 — 真素材版（CC0 像素風）
import { Assets } from './assets.js';

export class Renderer {
  constructor(canvas, terrain) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = terrain;
    this.img = this.ctx.createImageData(terrain.w, terrain.h);
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = terrain.w;
    this.offscreen.height = terrain.h;
    this.octx = this.offscreen.getContext('2d');
    // 地形圖塊 pattern
    this.tileReady = false;
    // 屏幕震動
    this.shake = 0;
    this.shakeX = 0; this.shakeY = 0;
    // 爆炸閃光
    this.flash = 0;
  }

  resize() {
    const c = this.canvas;
    c.width = this.terrain.w;
    c.height = this.terrain.h;
    c.style.width = '100%';
    c.style.height = '100%';
    this.ctx.imageSmoothingEnabled = false;
  }

  addShake(v) { this.shake = Math.min(14, this.shake + v); }
  addFlash(v) { this.flash = Math.min(0.85, this.flash + v); }

  // ===== 背景：bg.jpg 雪山 + 雲 =====
  drawSky() {
    const ctx = this.ctx, t = this.terrain;
    const bg = Assets.get('bg');
    if (bg) {
      // 背景圖橫向鋪滿，垂直對齊頂部（保留雪山天際線）
      const scale = t.w / bg.width;
      const dh = bg.height * scale;
      const dy = t.h - dh + 26;   // 底部略為露出（天空佔上部）
      ctx.drawImage(bg, 0, dy, t.w, dh);
      // 天空補底（bg 上方若有空隙）
      if (dy > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, dy + 10);
        g.addColorStop(0, '#5a9fd4'); g.addColorStop(1, '#a8d8ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, t.w, dy + 10);
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, t.h);
      g.addColorStop(0, '#3a7bd5'); g.addColorStop(1, '#a8d8ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, t.w, t.h);
    }
    // 飄雲（視差）
    const cloud = Assets.get('cloud');
    if (cloud) {
      const t0 = Date.now() / 90;
      for (let i = 0; i < 3; i++) {
        const speed = 0.25 + i * 0.18;
        let cx = ((t0 * speed + i * 190) % (t.w + 220)) - 110;
        const cy = 12 + i * 24;
        ctx.globalAlpha = 0.7 - i * 0.12;
        ctx.drawImage(cloud, Math.round(cx), cy);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ===== 地形：tileset 圖塊 + 表層 + 陰影 =====
  drawTerrain() {
    const t = this.terrain, ctx = this.ctx, d = this.img.data;
    const tile = Assets.get('tileset');

    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        const i = (y * t.w + x) * 4;
        if (t.mask[y * t.w + x]) {
          const depth = y - t.height[x];
          let r, g, b;
          if (depth < 1) { r = 132; g = 96; b = 48; }        // 表層：泥土亮邊
          else if (depth < 4) { r = 108; g = 76; b = 40; }   // 泥土
          else {
            // 深層：暗泥 + 雜訊
            const n = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
            const v = n * 24;
            r = 76 + v; g = 54 + v * 0.7; b = 34 + v * 0.5;
          }
          const shade = 1 - Math.min(0.4, depth / t.h * 0.9);
          d[i] = r * shade; d[i + 1] = g * shade; d[i + 2] = b * shade; d[i + 3] = 255;
        } else {
          d[i + 3] = 0;
        }
      }
    }
    this.octx.putImageData(this.img, 0, 0);

    // 用圖塊紋理疊加（multiply 效果）
    if (tile && !this.tileReady) {
      this.tilePattern = this.octx.createPattern(tile, 'repeat');
      this.tileReady = true;
    }
    if (this.tilePattern) {
      this.octx.globalCompositeOperation = 'overlay';
      this.octx.globalAlpha = 0.35;
      this.octx.fillStyle = this.tilePattern;
      this.octx.fillRect(0, 0, t.w, t.h);
      this.octx.globalAlpha = 1;
      this.octx.globalCompositeOperation = 'source-over';
      // 只保留地形部分（用 destination-in 裁切）
      this.octx.globalCompositeOperation = 'destination-in';
      this.octx.putImageData(this.img, 0, 0);
      this.octx.globalCompositeOperation = 'source-over';
    }

    ctx.drawImage(this.offscreen, this.shakeX, this.shakeY);

    // 地形頂部高光邊
    ctx.fillStyle = 'rgba(255,220,140,.5)';
    for (let x = 0; x < t.w; x++) {
      const gy = Math.floor(t.height[x]);
      if (gy < t.h) ctx.fillRect(x + this.shakeX, gy + this.shakeY, 1, 1);
    }
  }

  // ===== 坦克（真素材 + 砲管旋轉）=====
  drawTank(w, isActive) {
    if (!w.alive) return;
    const ctx = this.ctx;
    const x = Math.round(w.x) + this.shakeX;
    const y = Math.round(w.y) + this.shakeY;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 坦克車身（紅隊鏡像）
    const key = w.facing < 0 ? 'flip' : 'norm';
    const tank = w.facing < 0 ? Assets.flipped('tank') : Assets.get('tank');
    const TW = 45, TH = 28;
    if (tank && tank.width) {
      ctx.drawImage(tank, x - TW / 2, y - TH + 3, TW, TH);
    } else {
      ctx.fillStyle = w.team === 'blue' ? '#4a7a3a' : '#8a4a3a';
      ctx.fillRect(x - 14, y - 12, 28, 12);
    }

    // 砲管（圍繞砲塔中心旋轉）
    const gun = Assets.get('gun');
    const cy = y - 13;   // 砲塔中心
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(w.angle);
    if (gun && gun.width) {
      // gun.gif 係 24x7，由左端伸出
      ctx.drawImage(gun, -3, -3.5, 24, 7);
    } else {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, -2, 22, 4);
    }
    ctx.restore();

    // 當前坦克：閃爍箭頭
    if (isActive) {
      const bob = Math.sin(Date.now() / 220) * 2;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(x, y - 26 + bob);
      ctx.lineTo(x - 6, y - 34 + bob);
      ctx.lineTo(x + 6, y - 34 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 1; ctx.stroke();
    }

    // 血條
    const hpw = 30;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(x - hpw / 2 - 1, y - 41, hpw + 2, 5);
    ctx.fillStyle = w.hp > 50 ? '#5ce65c' : (w.hp > 25 ? '#ffd24a' : '#ff5a4a');
    ctx.fillRect(x - hpw / 2, y - 40, hpw * (w.hp / w.maxHp), 3);
  }

  // ===== 瞄準線 =====
  drawAim(w, phys, power) {
    if (!w.alive) return;
    const ctx = this.ctx;
    const m = w.muzzle();
    const wp = w._weaponSpeed || 8.2;
    const speed = wp * (0.35 + power * 0.65);
    let x = m.x, y = m.y;
    let vx = Math.cos(w.angle) * speed, vy = Math.sin(w.angle) * speed;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 90; i++) {
      vy += phys.gravity;
      vx += phys.wind * phys.windAccel * 10;
      x += vx; y += vy;
      if (y > this.terrain.h || x < 0 || x > this.terrain.w) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ===== 炮彈 =====
  drawProjectile(p) {
    const ctx = this.ctx;
    // 尾跡（火箭有煙火尾）
    if (p.trail.length > 1) {
      const grad = ctx.createLinearGradient(
        p.trail[0][0], p.trail[0][1], p.x, p.y);
      grad.addColorStop(0, 'rgba(255,180,80,0)');
      grad.addColorStop(1, p.type === 'rocket' ? 'rgba(255,140,60,.85)' : 'rgba(255,200,120,.5)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.type === 'rocket' ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(p.trail[0][0], p.trail[0][1]);
      for (const [tx, ty] of p.trail) ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    const x = Math.round(p.x) + this.shakeX, y = Math.round(p.y) + this.shakeY;
    const shell = Assets.get('shell');
    if (shell && shell.width) {
      // 按速度方向旋轉
      const ang = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.drawImage(shell, -9, -3.5, 18, 7);
      ctx.restore();
    } else {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x - 4, y - 2, 8, 4);
    }
    // 火箭發光
    if (p.type === 'rocket') {
      ctx.fillStyle = 'rgba(255,200,80,.5)';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== 粒子 =====
  drawParticles(parts) {
    const ctx = this.ctx;
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * a));
      ctx.fillRect(Math.round(p.x) + this.shakeX, Math.round(p.y) + this.shakeY, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 爆炸閃光 + 震動收尾 =====
  postFx() {
    const ctx = this.ctx;
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,240,200,${this.flash})`;
      ctx.fillRect(0, 0, this.terrain.w, this.terrain.h);
      this.flash *= 0.82;
    } else this.flash = 0;
    if (this.shake > 0.2) {
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
      this.shake *= 0.86;
    } else { this.shake = 0; this.shakeX = 0; this.shakeY = 0; }
  }
}
