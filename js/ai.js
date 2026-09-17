// 電腦 AI — 紅隊自動瞄準 + 開火
// 策略：試射搜索（模擬彈道）→ 揀最佳角度/力度 → 加入誤差（難度）

export class AI {
  constructor(level = 'normal') {
    this.level = level;
    // 難度參數：誤差角度（弧度）、誤差力度、思考延遲
    this.cfg = {
      easy:   { angErr: 0.085, powErr: 0.13, delay: 900, smart: 0.5 },
      normal: { angErr: 0.042, powErr: 0.07, delay: 750, smart: 0.75 },
      hard:   { angErr: 0.018, powErr: 0.03, delay: 600, smart: 1.0 },
    }[level] || { angErr: 0.042, powErr: 0.07, delay: 750, smart: 0.75 };
    this.thinking = false;
    this.fireAt = 0;
    this.plan = null;
  }

  reset() {
    this.thinking = false;
    this.fireAt = 0;
    this.plan = null;
  }

  // 模擬彈道：由 (x,y) 以 angle+power 射出，回傳落點
  simulate(shooter, angle, power, phys, terrain, weapon) {
    const speed = weapon.speed * (0.35 + power * 0.65);
    let x = shooter.x + Math.cos(angle) * 19;
    let y = (shooter.y - shooter.turretY) + Math.sin(angle) * 19;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const g = phys.gravity;
    const windAcc = phys.wind * phys.windAccel * 10;
    const thrust = weapon.thrust || false;

    for (let i = 0; i < 900; i++) {
      vy += g;
      if (thrust) {
        const sp = Math.hypot(vx, vy) || 1;
        vx += (vx / sp) * 0.16;
        vy += (vy / sp) * 0.16;
      }
      vx += windAcc;
      x += vx; y += vy;
      if (x < -80 || x > terrain.w + 80 || y > terrain.h + 80) {
        return { x, y, hit: false };
      }
      if (y >= 0 && terrain.solidAt(x, y)) {
        return { x, y, hit: true };
      }
      // 撞到敵人？
      for (const e of this._enemies || []) {
        if (!e.alive) continue;
        const c = e.center();
        if (Math.hypot(c.x - x, c.y - y) < 12) {
          return { x, y, hit: true, enemy: e };
        }
      }
    }
    return { x, y, hit: false };
  }

  // 為 shooter 揀最佳射擊方案
  planShot(shooter, enemies, phys, terrain, weapon) {
    this._enemies = enemies;
    const targets = enemies.filter(e => e.alive);
    if (!targets.length) return null;

    // 揀目標：優先打血少 + 距離適中
    let best = null;
    for (const t of targets) {
      const d = Math.abs(t.x - shooter.x);
      const score = t.hp * 1.2 + Math.abs(d - 200) * 0.35;
      if (!best || score < best.score) best = { t, score };
    }
    const target = best.t;

    // 搜索最佳角度/力度（粗掃 + 細掃）
    const searchResult = this._search(shooter, target, phys, terrain, weapon);

    // 加誤差（模擬人性）
    const smart = this.cfg.smart;
    const aErr = (Math.random() - 0.5) * 2 * this.cfg.angErr * (2 - smart);
    const pErr = (Math.random() - 0.5) * 2 * this.cfg.powErr * (2 - smart);

    return {
      angle: searchResult.angle + aErr,
      power: Math.max(0.12, Math.min(1, searchResult.power + pErr)),
      dist: Math.abs(searchResult.landX - target.x),
      target,
    };
  }

  _search(shooter, target, phys, terrain, weapon) {
    // 決定射向（目標喺左定右）
    const toRight = target.x > shooter.x;
    // 角度範圍：向右射 = -PI..-0.1；向左射 = PI..0.1（數學座標 y 向下）
    const angStart = toRight ? -Math.PI * 0.85 : -Math.PI * 0.15;
    const angEnd   = toRight ? -Math.PI * 0.15 : -Math.PI * 0.85;

    let best = { angle: -0.8, power: 0.7, err: Infinity, landX: 0 };

    // 粗掃
    const coarse = [];
    for (let a = 0; a <= 20; a++) {
      for (let p = 0; p <= 10; p++) {
        const angle = angStart + (angEnd - angStart) * (a / 20);
        const power = 0.15 + (p / 10) * 0.85;
        const r = this.simulate(shooter, angle, power, phys, terrain, weapon);
        const err = Math.hypot(r.x - target.x, r.y - target.y);
        coarse.push({ angle, power, err, landX: r.x });
        if (err < best.err) best = { angle, power, err, landX: r.x };
      }
    }

    // 細掃（圍繞最佳點）
    const da = (angEnd - angStart) / 20 * 0.6;
    const dp = 0.85 / 10 * 0.6;
    for (let a = -4; a <= 4; a++) {
      for (let p = -4; p <= 4; p++) {
        const angle = best.angle + da * a / 4;
        const power = Math.max(0.1, Math.min(1, best.power + dp * p / 4));
        const r = this.simulate(shooter, angle, power, phys, terrain, weapon);
        const err = Math.hypot(r.x - target.x, r.y - target.y);
        if (err < best.err) best = { angle, power, err, landX: r.x };
      }
    }
    // 記住最終誤差
    this._lastErr = best.err;
    return best;
  }

  // 每幀更新：思考完就開火
  update(now, shooter, enemies, phys, terrain, weapon, onFire) {
    if (this.thinking && now >= this.fireAt) {
      const plan = this.plan;
      this.thinking = false;
      if (plan) {
        shooter.angle = plan.angle;
        onFire(plan.power);
      }
      return true; // 已開火
    }
    return false;
  }

  // 開始思考（回合開始時叫）
  startThinking(now, shooter, enemies, phys, terrain, weapon) {
    if (this.thinking) return;
    this.thinking = true;
    this.plan = this.planShot(shooter, enemies, phys, terrain, weapon);
    this.fireAt = now + this.cfg.delay + Math.random() * 350;
  }
}
