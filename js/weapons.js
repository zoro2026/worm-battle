// 武器定義 v2 — 炮彈 / 散彈 / 火箭
export const WEAPONS = {
  shell: {
    id: 'shell',
    name: '炮彈',
    icon: '💥',
    explodeRadius: 30,
    damage: 38,
    speed: 8.4,
    fuse: 0,
    ammo: Infinity,
    desc: '標準砲彈，撞地爆炸',
  },
  shotgun: {
    id: 'shotgun',
    name: '散彈',
    icon: '🔫',
    explodeRadius: 0,
    damage: 22,
    speed: 14,
    fuse: 0,
    hitscan: true,
    pellets: 5,
    spread: 0.18,
    ammo: Infinity,
    desc: '多重散彈，直射無破壞',
  },
  rocket: {
    id: 'rocket',
    name: '火箭',
    icon: '🚀',
    explodeRadius: 42,
    damage: 52,
    speed: 6.6,
    fuse: 0,
    thrust: true,       // 飛行中加速
    ammo: 3,
    desc: '高爆火箭，大範圍破壞',
  },
};

export const WEAPON_ORDER = ['shell', 'shotgun', 'rocket'];
