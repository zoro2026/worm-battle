import { Terrain } from './terrain.js';
import { Physics, Projectile } from './physics.js';
import { Worm } from './worm.js';
import { Renderer } from './renderer.js';
import { Assets } from './assets.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { AI } from './ai.js';

// ===== 世界尺寸 =====
const W = 480, H = 270;

// ===== 玩家控制邊：blue = 你，red = 電腦 =====
const HUMAN_TEAM = 'blue';
const AI_TEAM = 'red';
const ai = new AI('normal');

const canvas = document.getElementById('game');
const terrain = new Terrain(W, H, Math.floor(Math.random() * 99999));
const phys = new Physics(W);
const renderer = new Renderer(canvas, terrain);
renderer.resize();

// ===== 隊伍（2v2 坦克）=====
const worms = [];
let _wornIdSeq = 1;
function spawnTeams() {
  worms.length = 0;
  _wornIdSeq = 1;
  // 藍隊（左）
  for (let i = 0; i < 2; i++) {
    const x = 42 + i * 34;
    const w = new Worm(x, terrain.groundY(x), 'blue', '蓝' + (i + 1));
    w.id = _wornIdSeq++;
    worms.push(w);
  }
  // 紅隊（右）
  for (let i = 0; i < 2; i++) {
    const x = W - 76 + i * 34;
    const w = new Worm(x, terrain.groundY(x), 'red', '红' + (i + 1));
    w.id = _wornIdSeq++;
    worms.push(w);
  }
}

// ===== 遊戲狀態 =====
const state = {
  turnTeam: 'blue',
  activeIdx: 0,
  timeLeft: 30,
  charging: false,
  chargeStart: 0,
  chargePower: 0.7,
  projectile: null,
  particles: [],
  phase: 'aim',
  winner: null,
  weaponIdx: 0,
  ammo: { shell: Infinity, shotgun: Infinity, rocket: 3 },
  started: false,
  angleStep: 0.045,
  powerStep: 0.05,
};

// 計時器累加器（必須喺 endTurn 之前聲明，否則 TDZ 錯誤）
let timerAcc = 0;
let lastTime = performance.now();

function activeWorm() {
  const tw = worms.filter(w => w.team === state.turnTeam && w.alive);
  if (!tw.length) return null;
  // 用 activeId 追蹤（避免 filter 順序變化導致跳錯車）
  if (state.activeId != null) {
    const found = tw.find(w => w.id === state.activeId);
    if (found) return found;
  }
  // 預設揀第一部，並記住
  state.activeId = tw[0].id;
  return tw[0];
}

// 玩家而家可唔可以操作？（只可以喺自己回合 + 未結束）
function canPlayerAct() {
  return state.started && state.phase === 'aim' && !state.winner
      && state.turnTeam === HUMAN_TEAM;
}

function isAiTurn() {
  return state.started && state.phase === 'aim' && !state.winner
      && state.turnTeam === AI_TEAM;
}

function currentWeapon() {
  return WEAPONS[WEAPON_ORDER[state.weaponIdx]];
}

// ===== 回合 =====
function endTurn() {
  const bAlive = worms.filter(w => w.team === 'blue' && w.alive).length;
  const rAlive = worms.filter(w => w.team === 'red' && w.alive).length;
  if (bAlive === 0 || rAlive === 0) {
    state.winner = bAlive > 0 ? 'blue' : 'red';
    state.phase = 'over';
    showMsg(state.winner === 'blue' ? '🔵 蓝队胜利！' : '🔴 红队胜利！', 6000);
    updateHud();
    return;
  }
  state.turnTeam = state.turnTeam === 'blue' ? 'red' : 'blue';
  state.activeIdx = 0;
  state.activeId = null;      // 重設：新回合自動揀第一部
  state.timeLeft = 30;
  state.phase = 'aim';
  state.projectile = null;
  state.charging = false;
  state.chargePower = 0.7;
  timerAcc = 0;          // ← 關鍵修正：重置計時累加器，避免立即再觸發 endTurn
  phys.randomWind();
  ai.reset();
  // AI 回合：開始思考
  if (state.turnTeam === AI_TEAM) {
    state.aiThinkAt = performance.now() + 650;
    showMsg('🔴 电脑思考中…', 900);
  } else {
    showMsg('🔵 你的回合', 900);
  }
  updateHud();
}

function showMsg(text, ms = 1600) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ===== 爆炸 =====
function explode(x, y, radius, damage) {
  terrain.explode(x, y, radius);
  renderer.addShake(radius * 0.22);
  renderer.addFlash(0.28);
  // 火花粒子
  const n = Math.min(70, Math.round(radius * 1.6) + 14);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * (radius * 0.10);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.0,
      life: 16 + Math.random() * 26,
      maxLife: 42,
      size: 1 + Math.random() * 2.6,
      color: ['#fff2b0', '#ffd24a', '#ff8a3a', '#ff5a3a', '#8a5a3a'][Math.floor(Math.random() * 5)],
    });
  }
  // 煙
  for (let i = 0; i < 10; i++) {
    state.particles.push({
      x: x + (Math.random() - .5) * radius * .5,
      y: y + (Math.random() - .5) * radius * .5,
      vx: (Math.random() - .5) * 0.7,
      vy: -0.3 - Math.random() * 0.6,
      life: 30 + Math.random() * 20, maxLife: 50,
      size: 2 + Math.random() * 3,
      color: 'rgba(90,80,75,.55)',
    });
  }
  // 傷害
  for (const w of worms) {
    if (!w.alive) continue;
    const c = w.center();
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < radius + 10) {
      const dmg = damage * (1 - Math.min(1, d / (radius + 10)));
      w.damage(Math.round(dmg));
      const ang = Math.atan2(c.y - y, c.x - x);
      w.vx += Math.cos(ang) * 2.4;
      w.vy += Math.sin(ang) * 1.8 - 1.1;
    }
  }
}

// ===== 發射 =====
function fire(power) {
  const w = activeWorm();
  if (!w || state.phase !== 'aim' || state.winner) return;
  const wp = currentWeapon();

  // 彈藥檢查
  if (state.ammo[wp.id] !== undefined && state.ammo[wp.id] <= 0) {
    showMsg('弹药耗尽！换武器', 1100);
    return;
  }
  if (state.ammo[wp.id] !== undefined && state.ammo[wp.id] !== Infinity) {
    state.ammo[wp.id]--;
  }

  const m = w.muzzle();
  const baseSpeed = wp.speed * (0.35 + power * 0.65);

  // ===== 散彈（hitscan 多重）=====
  if (wp.hitscan) {
    const pellets = wp.pellets || 5;
    let anyHit = 0;
    for (let k = 0; k < pellets; k++) {
      const spread = (k - (pellets - 1) / 2) * wp.spread;
      const ang = w.angle + spread;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let x = m.x, y = m.y;
      // 火花
      state.particles.push({
        x: m.x, y: m.y,
        vx: dx * (2 + Math.random() * 3), vy: dy * (2 + Math.random() * 3),
        life: 7 + Math.random() * 6, maxLife: 13, size: 1.8, color: '#ffe9b0',
      });
      // raycast
      for (let i = 0; i < 240; i++) {
        x += dx * 1.4; y += dy * 1.4;
        if (x < 0 || x > W || y < 0 || y > H) break;
        if (terrain.solidAt(x, y)) break;
        let hit = null;
        for (const o of worms) {
          if (!o.alive || o.team === w.team) continue;
          const c = o.center();
          if (Math.hypot(c.x - x, c.y - y) < 13) { hit = o; break; }
        }
        if (hit) { hit.damage(wp.damage); anyHit++; break; }
      }
    }
    // 槍口閃光
    renderer.addFlash(0.10);
    showMsg(anyHit ? `命中 ${anyHit} 发！` : '全部落空', 900);
    state.phase = 'settle';
    setTimeout(endTurn, 800);
    updateHud();
    return;
  }

  // ===== 炮彈 / 火箭 =====
  state.projectile = new Projectile(
    m.x, m.y,
    Math.cos(w.angle) * baseSpeed,
    Math.sin(w.angle) * baseSpeed,
    {
      type: wp.id,
      owner: w.team,
      explodeRadius: wp.explodeRadius,
      explodeDamage: wp.damage,
      thrust: wp.thrust || false,
      r: 3,
    }
  );
  state.phase = 'flying';
  renderer.addFlash(0.12);
  renderer.addShake(2);
  // 炮口煙
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: m.x, y: m.y,
      vx: Math.cos(w.angle) * (1 + Math.random() * 2) + (Math.random() - .5) * 0.8,
      vy: Math.sin(w.angle) * (1 + Math.random() * 2) + (Math.random() - .5) * 0.8,
      life: 10 + Math.random() * 10, maxLife: 20,
      size: 1.5 + Math.random() * 1.8, color: 'rgba(180,170,160,.6)',
    });
  }
  updateHud();
}

// ===== 虛擬鍵：長按連續 =====
function bindRepeat(el, fn, interval = 70) {
  let t1 = null, t2 = null;
  const stop = () => {
    clearTimeout(t1); clearInterval(t2); t1 = t2 = null;
    el.classList.remove('held');
  };
  const start = (e) => {
    e.preventDefault();
    el.classList.add('held');
    fn();
    t1 = setTimeout(() => { t2 = setInterval(fn, interval); }, 260);
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// ▲▼ 調砲管角度（長按微調）
bindRepeat(btnUp, () => {
  const w = activeWorm();
  if (w && canPlayerAct()) w.angle -= state.angleStep;
}, 55);
bindRepeat(btnDown, () => {
  const w = activeWorm();
  if (w && canPlayerAct()) w.angle += state.angleStep;
}, 55);

// ◀▶ 移動坦克
bindRepeat(btnLeft, () => {
  const w = activeWorm();
  if (w && canPlayerAct()) { w.move(-1, terrain, worms); updatePowerBar(); }
}, 60);
bindRepeat(btnRight, () => {
  const w = activeWorm();
  if (w && canPlayerAct()) { w.move(1, terrain, worms); updatePowerBar(); }
}, 60);

// 跳躍（跨越前方坦克）
const btnJump = document.getElementById('btnJump');
if (btnJump) {
  btnJump.addEventListener('pointerdown', e => {
    e.preventDefault();
    const w = activeWorm();
    if (w && canPlayerAct()) w.jump(phys, terrain);
  });
}

// 切換坦克（點自己隊友坦克 → 切換控制）
canvas.addEventListener('pointerdown', e => {
  if (!canPlayerAct()) return;
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) / r.width * W;
  const cy = (e.clientY - r.top) / r.height * H;
  const myTeam = worms.filter(w => w.team === HUMAN_TEAM && w.alive);
  if (myTeam.length < 2) return;
  // 揀最近嗰部（喺坦克範圍內）
  let best = null, bestD = 28;
  for (const t of myTeam) {
    const d = Math.hypot(cx - t.x, cy - (t.y - 8));
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    if (best.id !== state.activeId) {
      state.activeId = best.id;
      showMsg('切换到 ' + best.name, 800);
      updateHud();
    }
  }
});

// 切換坦克鍵（快速輪替）
const btnSwap = document.getElementById('btnSwap');
if (btnSwap) {
  btnSwap.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!canPlayerAct()) return;
    const myTeam = worms.filter(w => w.team === HUMAN_TEAM && w.alive);
    if (myTeam.length < 2) return;
    let idx = myTeam.findIndex(w => w.id === state.activeId);
    idx = (idx + 1) % myTeam.length;
    state.activeId = myTeam[idx].id;
    showMsg('切换到 ' + myTeam[idx].name, 800);
    updateHud();
  });
}

// 換武器
document.getElementById('btnWeapon').addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!canPlayerAct()) return;
  state.weaponIdx = (state.weaponIdx + 1) % WEAPON_ORDER.length;
  updateHud();
  showMsg(currentWeapon().desc, 900);
});

// ===== 開火：按住蓄力 =====
const fireBtn = document.getElementById('btnFire');
function updatePowerBar() {
  const held = state.charging ? (Date.now() - state.chargeStart) / 1000 : 0;
  const p = state.charging ? Math.min(1, held / 1.2) : state.chargePower;
  document.getElementById('powerfill').style.width = (p * 100) + '%';
}
fireBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!canPlayerAct()) return;
  state.charging = true;
  state.chargeStart = Date.now();
  fireBtn.textContent = '蓄力';
});
const releaseFire = e => {
  if (!state.charging) return;
  state.charging = false;
  const held = (Date.now() - state.chargeStart) / 1000;
  const power = Math.min(1, Math.max(0.12, held / 1.2));
  state.chargePower = power;
  fireBtn.textContent = '开火';
  fire(power);
};
fireBtn.addEventListener('pointerup', releaseFire);
fireBtn.addEventListener('pointercancel', releaseFire);
fireBtn.addEventListener('pointerleave', releaseFire);
fireBtn.addEventListener('contextmenu', e => e.preventDefault());

// ===== 鍵盤（電腦）=====
window.addEventListener('keydown', e => {
  if (!canPlayerAct()) return;
  const w = activeWorm();
  if (!w) return;
  if (e.key === 'ArrowLeft') { w.move(-1, terrain, worms); e.preventDefault(); }
  if (e.key === 'ArrowRight') { w.move(1, terrain, worms); e.preventDefault(); }
  if (e.key === 'ArrowUp') { w.angle -= state.angleStep; e.preventDefault(); }
  if (e.key === 'ArrowDown') { w.angle += state.angleStep; e.preventDefault(); }
  if (e.key === ' ') { e.preventDefault(); w.jump(phys, terrain); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const myTeam = worms.filter(x => x.team === HUMAN_TEAM && x.alive);
    if (myTeam.length > 1) {
      let idx = myTeam.findIndex(x => x.id === state.activeId);
      idx = (idx + 1) % myTeam.length;
      state.activeId = myTeam[idx].id;
      showMsg('切换到 ' + myTeam[idx].name, 800);
      updateHud();
    }
  }
  if (e.key === 'q' || e.key === 'Q') {
    state.weaponIdx = (state.weaponIdx + 1) % WEAPON_ORDER.length;
    updateHud();
  }
  if (e.key === 'Enter') { e.preventDefault(); fire(state.chargePower); }
});

// ===== HUD =====
function updateHud() {
  const blue = worms.filter(w => w.team === 'blue');
  const red = worms.filter(w => w.team === 'red');
  const bHp = blue.length ? blue.reduce((a, w) => a + w.hp, 0) / (blue.length * 100) * 100 : 0;
  const rHp = red.length ? red.reduce((a, w) => a + w.hp, 0) / (red.length * 100) * 100 : 0;
  document.getElementById('blueAlive').textContent = blue.filter(w => w.alive).length;
  document.getElementById('redAlive').textContent = red.filter(w => w.alive).length;
  document.getElementById('blueHp').style.width = bHp + '%';
  document.getElementById('redHp').style.width = rHp + '%';
  const wp = currentWeapon();
  const ammo = state.ammo[wp.id];
  const ammoTxt = (ammo === Infinity) ? '∞' : ammo;
  document.getElementById('btnWeapon').textContent = `${wp.icon} ${wp.name} ${ammoTxt}`;
  const act = activeWorm();
  document.getElementById('wind').textContent = phys.windText() + '   |   '
    + (state.turnTeam === 'blue'
        ? '🔵 你：' + (act ? act.name : '-')
        : '🔴 电脑回合');
  // 換車鍵：顯示下一部
  const myTeam = worms.filter(w => w.team === HUMAN_TEAM && w.alive);
  const swapBtn = document.getElementById('btnSwap');
  if (swapBtn) {
    if (myTeam.length > 1) {
      const ci = myTeam.findIndex(w => w.id === state.activeId);
      const next = myTeam[(ci + 1) % myTeam.length];
      swapBtn.textContent = '🔄 换车 → ' + next.name;
    } else {
      swapBtn.textContent = '🔄 换车';
    }
  }
  updatePowerBar();
}

// ===== 主循環 =====
function loop(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  requestAnimationFrame(loop);

  if (!state.started) return;

  // 重力
  for (const w of worms) w.applyGravity(phys, terrain);

  // ===== AI 回合處理 =====
  if (isAiTurn()) {
    const shooter = activeWorm();
    const enemies = worms.filter(w => w.team === HUMAN_TEAM);
    const now = performance.now();
    if (shooter) {
      // 第一次進入：揀武器 + 開始思考
      if (!ai.plan && !state.aiPlanMade) {
        // AI 揀武器：距離遠/血多 → 火箭；近 → 散彈；預設炮彈
        const tgt = enemies.find(e => e.alive);
        if (tgt) {
          const d = Math.abs(tgt.x - shooter.x);
          if (d < 130 && state.ammo.shotgun > 0) state.weaponIdx = WEAPON_ORDER.indexOf('shotgun');
          else if (d > 240 && state.ammo.rocket > 0 && Math.random() < 0.55) state.weaponIdx = WEAPON_ORDER.indexOf('rocket');
          else state.weaponIdx = WEAPON_ORDER.indexOf('shell');
          updateHud();
        }
        ai.plan = ai.planShot(shooter, enemies, phys, terrain, currentWeapon());
        state.aiPlanMade = true;
        if (ai.plan) shooter.angle = ai.plan.angle;  // 砲塔先轉向目標
      }
      // 思考完 → 開火（必須確認仍係 aim 階段，避免 double endTurn）
      // 節奏放慢：先顯示「電腦瞄準中」，再開火，等玩家睇清楚
      if (ai.plan && state.phase === 'aim') {
        if (!state.aiFireAt) {
          state.aiFireAt = now + 1100 + Math.random() * 500;   // 瞄準展示 1.1~1.6 秒
          showMsg('🔴 电脑瞄准中…', 1000);
        } else if (now >= state.aiFireAt) {
          const p = ai.plan.power;
          state.aiPlanMade = false;
          ai.plan = null;
          state.aiFireAt = 0;
          state.charging = false;
          showMsg('🔴 电脑开火！', 1200);
          fire(p);
        }
      }
    }
  } else {
    state.aiPlanMade = false;
    state.aiFireAt = 0;
    state._aiFired = false;
  }

  // 拋體
  if (state.projectile) {
    const ev = state.projectile.update(phys, terrain);
    if (ev) {
      if (ev.explode) {
        const p = state.projectile;
        explode(ev.x, ev.y, p.explodeRadius, p.explodeDamage);
      }
      state.projectile = null;
      state.phase = 'settle';
      setTimeout(endTurn, 950);
    }
  }

  // 粒子
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.vy += p.color.startsWith('rgba') ? -0.02 : 0.17;
    p.x += p.vx; p.y += p.vy;
    if (!p.color.startsWith('rgba') && terrain.solidAt(p.x, p.y)) {
      p.vy *= -0.28; p.vx *= 0.5; p.y -= 1;
    }
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // 計時（只計玩家回合）
  if (state.phase === 'aim' && !state.winner && state.turnTeam === HUMAN_TEAM) {
    timerAcc += dt;
    if (timerAcc >= 1000) {
      timerAcc -= 1000;
      state.timeLeft--;
      if (state.timeLeft <= 0) endTurn();
    }
  }

  // ===== 渲染 =====
  renderer.drawSky();
  renderer.drawTerrain();
  const act = activeWorm();
  for (const w of worms) renderer.drawTank(w, w === act && state.phase === 'aim');
  if (state.phase === 'aim' && act) {
    act._weaponSpeed = currentWeapon().speed;
    const p = state.charging
      ? Math.min(1, (Date.now() - state.chargeStart) / 1200)
      : state.chargePower;
    renderer.drawAim(act, phys, state.charging ? p : state.chargePower);
  }
  if (state.projectile) renderer.drawProjectile(state.projectile);
  renderer.drawParticles(state.particles);
  renderer.postFx();

  // HUD 即時更新
  if (state.charging) { updatePowerBar(); updateHud(); }
  document.getElementById('timer').textContent = Math.max(0, state.timeLeft);
}

// ===== 開始 =====
async function boot() {
  await Assets.load();
  spawnTeams();
  phys.randomWind();
  updateHud();

  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('start').style.display = 'none';
    state.started = true;
    lastTime = performance.now();
    showMsg('🔵 蓝队先手', 1400);
  });

  requestAnimationFrame(loop);
}
boot();

window.__game = { state, worms, terrain, phys, fire, endTurn, renderer, ai, HUMAN_TEAM, AI_TEAM, canPlayerAct, isAiTurn };
