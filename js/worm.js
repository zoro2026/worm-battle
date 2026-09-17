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

  move(dir, terrain) {
    if (!this.alive || !this.onGround) return;
    const step = 1.8 * dir;
    const nx = this.x + step;
    const gy = terrain.groundY(nx);
    const gyNow = terrain.groundY(this.x);
    if (Math.abs(gy - gyNow) < 11) {
      this.x = nx; this.y = gy;
      this.facing = dir > 0 ? 1 : -1;
    }
  }

  jump(phys, terrain) {
    if (!this.alive || !this.onGround) return;
    this.vy = -3.6;
    this.vx = this.facing * 1.8;
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
