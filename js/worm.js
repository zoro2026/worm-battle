// 坦克單位（原本嘅蟲，改做坦克）
export class Worm {
  constructor(x, y, team, name) {
    this.x = x; this.y = y;   // 車底位置
    this.vx = 0; this.vy = 0;
    this.team = team;
    this.name = name;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.angle = team === 'blue' ? -0.7 : Math.PI + 0.7;
    this.power = 0.7;
    this.facing = team === 'blue' ? 1 : -1;
    this.onGround = false;
    this.w = 30; this.h = 16;
    this.turretY = 13;   // 砲塔高度（由車底計）
  }

  applyGravity(phys, terrain) {
    this.vy += phys.gravity;
    this.y += this.vy;
    this.x += this.vx;
    const gy = terrain.groundY(this.x);
    if (this.y >= gy) {
      this.y = gy;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.x = Math.max(16, Math.min(terrain.w - 16, this.x));
    this.vx *= 0.72;
    if (this.y > terrain.h + 60) this.kill();
  }

  // dir: -1 / +1。others = 其他坦克（用嚟防止穿模）
  move(dir, terrain, others = []) {
    if (!this.alive || !this.onGround) return false;
    const step = 1.8 * dir;
    const nx = this.x + step;
    const gy = terrain.groundY(nx);
    const gyNow = terrain.groundY(this.x);
    // 坡度限制：太斜行唔到
    if (Math.abs(gy - gyNow) >= 11) return false;
    // 防穿模：唔可以行入其他坦克嘅車身（闊度 30，留 4px 邊距）
    for (const o of others) {
      if (o === this || !o.alive) continue;
      if (Math.abs(nx - o.x) < 26) return false;   // 撞到，唔行
    }
    this.x = nx;
    this.y = gy;
    this.facing = dir > 0 ? 1 : -1;
    return true;
  }

  // 跳躍（可以跳過前方坦克）
  jump(phys, terrain) {
    if (!this.alive || !this.onGround) return;
    this.vy = -3.8;
    this.vx = this.facing * 2.2;
    this.onGround = false;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.kill(); }
  }

  kill() { this.alive = false; }

  center() { return { x: this.x, y: this.y - this.h / 2 }; }

  // 砲口位置（由砲塔中心沿角度伸出）
  muzzle() {
    const ty = this.y - this.turretY;
    return {
      x: this.x + Math.cos(this.angle) * 19,
      y: ty + Math.sin(this.angle) * 19,
    };
  }
}
