// 蟲（玩家單位）
export class Worm {
  constructor(x, y, team, name) {
    this.x = x; this.y = y;   // 腳底位置
    this.vx = 0; this.vy = 0;
    this.team = team;
    this.name = name;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.angle = team === 'blue' ? -0.6 : Math.PI + 0.6; // 瞄準角度
    this.power = 0;            // 0..1 蓄力
    this.facing = team === 'blue' ? 1 : -1;
    this.onGround = false;
    this.w = 10; this.h = 12;
  }

  applyGravity(phys, terrain) {
    this.vy += phys.gravity;
    this.y += this.vy;
    this.x += this.vx;
    // 地形碰撞（腳底）
    const gy = terrain.groundY(this.x);
    if (this.y >= gy) {
      this.y = gy;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    // 世界邊界
    this.x = Math.max(6, Math.min(terrain.w - 6, this.x));
    this.vx *= 0.6;
    // 掉出地圖
    if (this.y > terrain.h + 50) this.kill();
  }

  move(dir, terrain) {
    if (!this.alive) return;
    if (!this.onGround) return;   // 空中唔郁（簡化）
    const step = 1.6 * dir;
    const nx = this.x + step;
    const gy = terrain.groundY(nx);
    // 坡度限制：太斜行唔到
    const gyNow = terrain.groundY(this.x);
    if (Math.abs(gy - gyNow) < 9) {
      this.x = nx;
      this.y = gy;
      this.facing = dir > 0 ? 1 : -1;
    }
  }

  jump(phys, terrain) {
    if (!this.alive || !this.onGround) return;
    this.vy = -3.3;
    this.vx = this.facing * 1.6;
    this.onGround = false;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.kill(); }
  }

  kill() {
    this.alive = false;
  }

  center() {
    return { x: this.x, y: this.y - this.h / 2 };
  }

  muzzle() {
    const c = this.center();
    return {
      x: c.x + Math.cos(this.angle) * 11,
      y: c.y + Math.sin(this.angle) * 11,
    };
  }
}
