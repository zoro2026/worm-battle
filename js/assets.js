// 素材載入器 — CC0 素材（OpenGameArt: tileset-and-assets-for-a-scorched-earth-type-game）
// 全部素材公眾領域（CC0），可商用、免署名

const MANIFEST = {
  bg:        'assets/bg.jpg',
  tank:      'assets/tank.gif',
  gun:       'assets/gun.gif',
  shell:     'assets/shell.gif',
  tileset:   'assets/tileset.gif',
  cloud:     'assets/cloud1.gif',
  chopper1:  'assets/chopper1.gif',
  chopper2:  'assets/chopper2.gif',
  chopper3:  'assets/chopper3.gif',
  chopper4:  'assets/chopper4.gif',
  chopper5:  'assets/chopper5.gif',
};

export const Assets = {
  imgs: {},
  loaded: false,

  async load() {
    const entries = Object.entries(MANIFEST);
    await Promise.all(entries.map(([k, src]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { Assets.imgs[k] = im; res(); };
      im.onerror = () => { console.warn('[assets] 載入失敗:', src); res(); };
      im.src = src;
    })));
    Assets.loaded = true;
    return Assets.imgs;
  },

  get(k) { return Assets.imgs[k]; },

  // 坦克：水平翻轉版（紅隊朝左）
  flipped(k) {
    const src = Assets.imgs[k];
    if (!src) return null;
    const key = k + '_flip';
    if (Assets.imgs[key]) return Assets.imgs[key];
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    // 用 Image 包裝方便 drawImage
    const im = new Image();
    im.src = c.toDataURL();
    Assets.imgs[key] = im;
    return im;
  },
};
