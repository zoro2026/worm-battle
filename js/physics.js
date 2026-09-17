// 物理：重力、拋物線、風、碰撞
export class Physics {
  constructor(world) {
    this.world = world;
    this.gravity = 0.22;   // px/frame^2
    this.wind = 0;         // -1..1
    this.windAccel = 0.012;
  }

  randomWind() {
    // 每回合隨機風（-1..1），偏細風為主
    this.wind = (Math.random() * 2 - 1) * 0.9;
  }

  windText() {
    const v = this.wind;
    if (Math.abs(v) < 0.06) return '风: — 0';
    const arrow = v > 0 ? '→' : '←';
    return `风: ${arrow} ${Math.abs(v).toFixed(1)}`;
  }
}

// 拋體
export class Projectile {
  constructor(x, y, vx, vy, opts = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = opts.r ?? 3;
    this.type = opts.type ?? 'rocket';
    this.owner = opts.owner ?? 'blue';
    this.explodeRadius = opts.explodeRadius ?? 26;
    this.explodeDamage = opts.explodeDamage ?? 34;
    this.fuse = opts.fuse ?? 0;      // >0 = 手榴彈引信
    this.thrust = opts.thrust ?? false;  // 火箭：飛行中加速
    this.age = 0;
    this.dead = false;
    this.trail = [];
  }

  update(phys, terrain) {
    if (this.dead) return null;
    this.age++;
    if (this.fuse > 0 && this.age >= this.fuse) {
      this.dead = true;
      return { explode: true, x: this.x, y: this.y };
    }
    this.vy += phys.gravity;
    // 火箭推進：沿當前飛行方向持續加速（對抗重力）
    if (this.thrust) {
      const sp = Math.hypot(this.vx, this.vy) || 1;
      this.vx += (this.vx / sp) * 0.16;
      this.vy += (this.vy / sp) * 0.16;
    }
    this.vx += phys.wind * phys.windAccel * 10;
    this.x += this.vx;
    this.y += this.vy;
    this.trail.push([this.x, this.y]);
    if (this.trail.length > 18) this.trail.shift();

    // 出界
    if (this.x < -60 || this.x > terrain.w + 60 || this.y > terrain.h + 120) {
      this.dead = true;
      return { gone: true };
    }
    // 撞地形
    if (this.y >= 0 && terrain.solidAt(this.x, this.y)) {
      this.dead = true;
      return { explode: true, x: this.x, y: this.y };
    }
    return null;
  }
}
