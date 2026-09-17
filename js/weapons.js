// 武器定義
export const WEAPONS = {
  rocket: {
    id: 'rocket',
    name: '🚀 火箭筒',
    icon: '🚀',
    explodeRadius: 30,
    damage: 38,
    speed: 8.2,
    fuse: 0,
    desc: '直線飛行，撞地爆炸',
  },
  grenade: {
    id: 'grenade',
    name: '💣 手榴彈',
    icon: '💣',
    explodeRadius: 34,
    damage: 42,
    speed: 7.0,
    fuse: 78,
    desc: '彈跳，引信到期爆炸',
  },
  shotgun: {
    id: 'shotgun',
    name: '🔫 散彈槍',
    icon: '🔫',
    explodeRadius: 0,
    damage: 25,
    speed: 13,
    fuse: 0,
    hitscan: true,
    desc: '直射，無地形破壞',
  },
};

export const WEAPON_ORDER = ['rocket', 'grenade', 'shotgun'];
