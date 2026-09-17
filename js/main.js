import { Terrain } from './terrain.js';
import { Physics, Projectile } from './physics.js';
import { Worm } from './worm.js';
import { Renderer } from './renderer.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';

// ===== 世界尺寸（內部像素解析度，CSS 拉伸到全屏）=====
const W = 480, H = 270;

const canvas = document.getElementById('game');
const terrain = new Terrain(W, H, Date.now() % 100000);
const phys = new Physics(W);
const renderer = new Renderer(canvas, terrain);
renderer.resize();

// ===== 隊伍 =====
const worms = [];
function spawnTeams() {
  worms.length = 0;
  const names = ['阿虫', '细粒', '大旧', '肥仔'];
  for (let i = 0; i < 2; i++) {
    const x = 40 + i * 24;
    const y = terrain.groundY(x);
    worms.push(new Worm(x, y, 'blue', names[i]));
  }
  for (let i = 0; i < 2; i++) {
    const x = W - 64 + i * 24;
    const y = terrain.groundY(x);
    worms.push(new Worm(x, y, 'red', names[i + 2]));
  }
}
spawnTeams();

// ===== 遊戲狀態 =====
const state = {
  turnTeam: 'blue',
  activeIdx: 0,
  timeLeft: 30,
  charging: false,
  chargeStart: 0,
  projectile: null,
  particles: [],
  phase: 'aim',   // aim | flying | settle
  winner: null,
  weaponIdx: 0,
};

function activeWorm() {
  const teamWorms = worms.filter(w => w.team === state.turnTeam && w.alive);
  if (!teamWorms.length) return null;
  return teamWorms[state.activeIdx % teamWorms.length] || teamWorms[0];
}

function currentWeapon() {
  return WEAPONS[WEAPON_ORDER[state.weaponIdx]];
}

// ===== 回合結束 =====
function endTurn() {
  const aliveBlue = worms.filter(w => w.team === 'blue' && w.alive).length;
  const aliveRed = worms.filter(w => w.team === 'red' && w.alive).length;
  if (aliveBlue === 0 || aliveRed === 0) {
    state.winner = aliveBlue > 0 ? 'blue' : 'red';
    state.phase = 'over';
    showMsg(state.winner === 'blue' ? '🔵 蓝队胜利！' : '🔴 红队胜利！');
    updateHud();
    return;
  }
  state.turnTeam = state.turnTeam === 'blue' ? 'red' : 'blue';
  // 換隊時 index 重設
  state.activeIdx = 0;
  state.timeLeft = 30;
  state.charge = 0;
  state.phase = 'aim';
  state.projectile = null;
  state.charging = false;
  phys.randomWind();
  const w = activeWorm();
  if (w) w.power = 0;
  updateHud();
}

function showMsg(text, ms = 1800) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ===== 爆炸 =====
function explode(x, y, radius, damage, ownerTeam) {
  const removed = terrain.explode(x, y, radius);
  // 粒子
  for (let i = 0; i < Math.min(60, removed.length / 3 + 12); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.5 + Math.random() * 2.6;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.8,
      life: 18 + Math.random() * 22,
      maxLife: 40,
      size: 1 + Math.random() * 2.5,
      color: ['#ffd24a', '#ff8a3a', '#ff5a3a', '#8a5a3a'][Math.floor(Math.random() * 4)],
    });
  }
  // 傷害（圓形範圍內衰減）
  for (const w of worms) {
    if (!w.alive) continue;
    const c = w.center();
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < radius + 8) {
      const dmg = damage * (1 - Math.min(1, d / (radius + 8)));
      w.damage(Math.round(dmg));
      // 擊退
      const ang = Math.atan2(c.y - y, c.x - x);
      w.vx += Math.cos(ang) * 2.2;
      w.vy += Math.sin(ang) * 1.6 - 1;
    }
  }
}

// ===== 發射 =====
function fire(power) {
  const w = activeWorm();
  if (!w || state.phase !== 'aim') return;
  const wp = currentWeapon();
  const m = w.muzzle();
  const speed = wp.speed * (wp.hitscan ? 1 : (0.35 + power * 0.65));

  if (wp.hitscan) {
    // 散彈：即時 raycast
    let x = m.x, y = m.y;
    const dx = Math.cos(w.angle), dy = Math.sin(w.angle);
    let hitWorm = null;
    for (let i = 0; i < 200; i++) {
      x += dx * 1.2; y += dy * 1.2;
      if (x < 0 || x > W || y < 0 || y > H) break;
      if (terrain.solidAt(x, y)) break;
      for (const o of worms) {
        if (!o.alive || o.team === w.team) continue;
        const c = o.center();
        if (Math.hypot(c.x - x, c.y - y) < 8) { hitWorm = o; break; }
      }
      if (hitWorm) break;
    }
    // 槍口閃光
    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x: m.x, y: m.y,
        vx: dx * (1 + Math.random() * 3), vy: dy * (1 + Math.random() * 3),
        life: 8 + Math.random() * 6, maxLife: 14, size: 1.5,
        color: '#ffe9b0',
      });
    }
    if (hitWorm) hitWorm.damage(wp.damage);
    state.phase = 'settle';
    setTimeout(endTurn, 700);
    updateHud();
    return;
  }

  state.projectile = new Projectile(m.x, m.y,
    Math.cos(w.angle) * speed,
    Math.sin(w.angle) * speed,
    {
      type: wp.id,
      owner: w.team,
      explodeRadius: wp.explodeRadius,
      explodeDamage: wp.damage,
      fuse: wp.fuse,
      r: wp.id === 'grenade' ? 4 : 3,
    }
  );
  state.phase = 'flying';
  updateHud();
}

// ===== 輸入 =====
function bindHold(el, onDown) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); });
}
function bindRepeat(el, fn) {
  let t1 = null, t2 = null;
  const start = e => {
    e.preventDefault();
    fn();
    t1 = setTimeout(() => { t2 = setInterval(fn, 60); }, 220);
  };
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}

bindRepeat(document.getElementById('btnLeft'), () => {
  const w = activeWorm();
  if (w && state.phase === 'aim') w.move(-1, terrain);
});
bindRepeat(document.getElementById('btnRight'), () => {
  const w = activeWorm();
  if (w && state.phase === 'aim') w.move(1, terrain);
});
bindHold(document.getElementById('btnJump'), () => {
  const w = activeWorm();
  if (w && state.phase === 'aim') w.jump(phys, terrain);
});
document.getElementById('btnWeapon').addEventListener('pointerdown', e => {
  e.preventDefault();
  state.weaponIdx = (state.weaponIdx + 1) % WEAPON_ORDER.length;
  updateHud();
});

// 蓄力發射
const fireBtn = document.getElementById('btnFire');
fireBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state.phase !== 'aim') return;
  state.charging = true;
  state.chargeStart = Date.now();
});
const release = e => {
  if (!state.charging) return;
  state.charging = false;
  const held = (Date.now() - state.chargeStart) / 1000;
  const power = Math.min(1, held / 1.1);
  fire(power);
};
fireBtn.addEventListener('pointerup', release);
fireBtn.addEventListener('pointercancel', release);
fireBtn.addEventListener('pointerleave', release);

// 鍵盤（電腦測試）
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  const w = activeWorm();
  if (!w || state.phase !== 'aim') return;
  if (e.key === 'ArrowLeft') w.move(-1, terrain);
  if (e.key === 'ArrowRight') w.move(1, terrain);
  if (e.key === 'ArrowUp') w.angle -= 0.045;
  if (e.key === 'ArrowDown') w.angle += 0.045;
  if (e.key === ' ') { e.preventDefault(); w.jump(phys, terrain); }
  if (e.key === 'Tab') { state.weaponIdx = (state.weaponIdx + 1) % WEAPON_ORDER.length; updateHud(); }
  if (e.key === 'Enter') fire(1);
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// 畫布點擊瞄準（拉角度）
canvas.addEventListener('pointerdown', e => {
  const w = activeWorm();
  if (!w || state.phase !== 'aim') return;
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) / r.width * W;
  const cy = (e.clientY - r.top) / r.height * H;
  const c = w.center();
  w.angle = Math.atan2(cy - c.y, cx - c.x);
  w.facing = Math.cos(w.angle) >= 0 ? 1 : -1;
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons !== 1) return;
  const w = activeWorm();
  if (!w || state.phase !== 'aim') return;
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) / r.width * W;
  const cy = (e.clientY - r.top) / r.height * H;
  const c = w.center();
  w.angle = Math.atan2(cy - c.y, cx - c.x);
  w.facing = Math.cos(w.angle) >= 0 ? 1 : -1;
});

// ===== HUD =====
function updateHud() {
  const blue = worms.filter(w => w.team === 'blue');
  const red = worms.filter(w => w.team === 'red');
  const bAlive = blue.filter(w => w.alive).length;
  const rAlive = red.filter(w => w.alive).length;
  const bHp = blue.reduce((a, w) => a + w.hp, 0) / (blue.length * 100) * 100;
  const rHp = red.reduce((a, w) => a + w.hp, 0) / (red.length * 100) * 100;
  document.getElementById('blueAlive').textContent = bAlive;
  document.getElementById('redAlive').textContent = rAlive;
  document.getElementById('blueHp').style.width = bHp + '%';
  document.getElementById('redHp').style.width = rHp + '%';
  const wp = currentWeapon();
  document.getElementById('btnWeapon').textContent = wp.icon + ' ' + wp.name.slice(2);
  document.getElementById('wind').textContent = phys.windText();
  // 蓄力顯示
  if (state.charging) {
    const held = (Date.now() - state.chargeStart) / 1000;
    const p = Math.min(100, held / 1.1 * 100);
    document.getElementById('btnFire').textContent = '蓄力 ' + Math.round(p) + '%';
  } else {
    const w = activeWorm();
    document.getElementById('btnFire').textContent =
      state.phase === 'aim' ? '按住蓄力' : '...';
  }
}

// ===== 主循環 =====
let lastTime = performance.now();
let timerAcc = 0;
function loop(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  requestAnimationFrame(loop);

  // 物理更新
  for (const w of worms) w.applyGravity(phys, terrain);

  // 拋體
  if (state.projectile) {
    const ev = state.projectile.update(phys, terrain);
    if (ev) {
      if (ev.explode) {
        const p = state.projectile;
        explode(ev.x, ev.y, p.explodeRadius, p.explodeDamage, p.owner);
      }
      state.projectile = null;
      state.phase = 'settle';
      setTimeout(endTurn, 900);
    }
  }

  // 粒子
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.vy += 0.16;
    p.x += p.vx; p.y += p.vy;
    if (terrain.solidAt(p.x, p.y)) { p.vy *= -0.3; p.vx *= 0.5; }
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // 計時器
  if (state.phase === 'aim' && !state.winner) {
    timerAcc += dt;
    if (timerAcc >= 1000) {
      timerAcc -= 1000;
      state.timeLeft--;
      if (state.timeLeft <= 0) endTurn();
    }
  }

  // 渲染
  renderer.drawSky();
  renderer.drawTerrain();
  const act = activeWorm();
  for (const w of worms) renderer.drawWorm(w, w === act && state.phase === 'aim');
  if (state.phase === 'aim' && act) renderer.drawAim(act, phys);
  if (state.projectile) renderer.drawProjectile(state.projectile);
  renderer.drawParticles(state.particles);

  // HUD 更新（蓄力條要即時）
  if (state.charging) updateHud();
  document.getElementById('timer').textContent = Math.max(0, state.timeLeft);
}

phys.randomWind();
updateHud();
requestAnimationFrame(loop);

// 對外暴露（debug）
window.__game = { state, worms, terrain, phys, fire, endTurn };
