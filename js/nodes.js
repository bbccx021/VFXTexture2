'use strict';
/* ============================================================
   nodes.js — 節點定義
   每個節點:{ title, zh, cat, inputs, out, params, eval }
   buffer 物件:{ t:'g'|'c', d:Float32Array }
   eval(p, ins, ctx) → buffer;ctx = { W, H }
   ============================================================ */

// ---------- 漸層色帶預設 ----------
const GRADS = (() => {
  const hx = h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  const mk = arr => arr.map(([p, h]) => [p, ...hx(h)]);
  return {
    // ── 風格化色帶:多段手選色 + 色相位移(暗部偏冷、中段高飽和、亮部偏暖到白)──
    celFire: {
      zh: '🎨 風格化 火', stops: mk([[0, '1a0526'], [0.08, '3d0a35'], [0.16, '6e1040'], [0.25, '9e1a3a'],
        [0.34, 'c72a2a'], [0.43, 'e04a1c'], [0.52, 'f26b16'], [0.61, 'fb8c14'], [0.70, 'ffa81f'],
        [0.79, 'ffc133'], [0.88, 'ffd85c'], [0.95, 'ffdd82'], [1, 'ffeeb0']]),
    },
    celIce: {
      zh: '🎨 風格化 冰', stops: mk([[0, '080d28'], [0.09, '11184a'], [0.18, '182a72'], [0.27, '1e4396'],
        [0.36, '245fb8'], [0.45, '2b7ed2'], [0.55, '349ce4'], [0.64, '45b8ef'], [0.73, '5fcef6'],
        [0.82, '86e0fa'], [0.91, 'b5eefc'], [0.97, 'bdeeff'], [1, 'ddf6ff']]),
    },
    celMagic: {
      zh: '🎨 風格化 魔法', stops: mk([[0, '10032a'], [0.09, '220754'], [0.18, '380f80'], [0.27, '4f1aa8'],
        [0.36, '6b28c8'], [0.45, '8a3ade'], [0.55, 'a552ec'], [0.64, 'bd6ef5'], [0.73, 'd08cf9'],
        [0.82, 'e0aafc'], [0.91, 'edc9fd'], [0.97, 'e8bcff'], [1, 'f2d8ff']]),
    },
    celToxic: {
      zh: '🎨 風格化 劇毒', stops: mk([[0, '031610'], [0.09, '072b1a'], [0.18, '0d4322'], [0.27, '155c28'],
        [0.36, '20762c'], [0.45, '2f9032'], [0.55, '44a838'], [0.64, '60bd3e'], [0.73, '80d047'],
        [0.82, 'a3e055'], [0.91, 'c6ec74'], [0.97, 'd2f088'], [1, 'e6f8b8']]),
    },
    celGold: {
      zh: '🎨 風格化 聖金', stops: mk([[0, '1a0a02'], [0.09, '351805'], [0.18, '55290a'], [0.27, '773d0f'],
        [0.36, '9a5413'], [0.45, 'bd6d17'], [0.55, 'd9881c'], [0.64, 'eda328'], [0.73, 'fbbc3c'],
        [0.82, 'ffd15c'], [0.91, 'ffe28c'], [0.97, 'ffe6a0'], [1, 'fff0c8']]),
    },
    celSmoke: {
      zh: '🎨 風格化 煙灰', stops: mk([[0, '080b12'], [0.09, '141a26'], [0.18, '222c3d'], [0.27, '323e54'],
        [0.36, '44526b'], [0.45, '576781'], [0.55, '6d7d96'], [0.64, '8593aa'], [0.73, '9ea9bd'],
        [0.82, 'b8c1d0'], [0.91, 'd2d9e3'], [0.97, 'd6dfea'], [1, 'e8eef6']]),
    },
    celBlood: {
      zh: '🎨 風格化 暗紅', stops: mk([[0, '110208'], [0.09, '2b0512'], [0.18, '4d0a1c'], [0.27, '6e1024'],
        [0.36, '8f182c'], [0.45, 'b02236'], [0.55, 'ce3040'], [0.64, 'e44650'], [0.73, 'f26468'],
        [0.82, 'fa8a8c'], [0.91, 'ffb4b4'], [0.97, 'ffbcbe'], [1, 'ffd6d8']]),
    },
    celWater: {
      zh: '🎨 風格化 清水', stops: mk([[0, '011019'], [0.09, '042330'], [0.18, '073a4c'], [0.27, '0b5266'],
        [0.36, '106b80'], [0.45, '16869a'], [0.55, '1fa1b4'], [0.64, '2ebccb'], [0.73, '48d3de'],
        [0.82, '6ee4ec'], [0.91, '9df0f5'], [0.97, 'a8eef6'], [1, 'cdf6fb']]),
    },
    fire:     { zh: '火焰 紅橙黃', stops: mk([[0, '000000'], [0.18, '2b0300'], [0.42, 'a32100'], [0.62, 'ff6a00'], [0.8, 'ffc22e'], [1, 'ffffff']]) },
    electric: { zh: '閃電 藍白', stops: mk([[0, '000006'], [0.3, '0a1a5c'], [0.55, '2455ff'], [0.75, '6db8ff'], [0.9, 'c9ecff'], [1, 'ffffff']]) },
    arcane:   { zh: '奧術 紫紅', stops: mk([[0, '050010'], [0.35, '2a0a5e'], [0.6, '7b2fd4'], [0.8, 'c46bff'], [0.93, 'eec9ff'], [1, 'ffffff']]) },
    toxic:    { zh: '劇毒 綠', stops: mk([[0, '000400'], [0.35, '0c3a10'], [0.6, '35a12b'], [0.82, 'a6e83c'], [1, 'f2ffd9']]) },
    ember:    { zh: '餘燼 暗紅', stops: mk([[0, '000000'], [0.45, '571106'], [0.72, 'e8410c'], [0.9, 'ff9a3d'], [1, 'ffd9a0']]) },
    ice:      { zh: '寒冰 青藍', stops: mk([[0, '010714'], [0.4, '0c3e66'], [0.68, '2f9cc9'], [0.86, '8ee4f2'], [1, 'f0feff']]) },
    smoke:    { zh: '煙霧 灰階', stops: mk([[0, '000000'], [0.5, '3f444c'], [0.8, '9ba1aa'], [1, 'eceef1']]) },
    gold:     { zh: '聖金 黃', stops: mk([[0, '000000'], [0.35, '45280a'], [0.6, 'c78a1e'], [0.82, 'ffd465'], [1, 'fff8dc']]) },
  };
})();

// ---------- buffer 型別轉換 ----------
function bufConvert(buf, want, ctx) {
  if (!buf) return null;
  if (want === 'any' || buf.t === want) return buf;
  const N = ctx.W * ctx.H;
  if (buf.t === 'g' && want === 'c') {
    const d = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { const v = buf.d[i]; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = v; }
    return { t: 'c', d };
  }
  if (buf.t === 'c' && want === 'g') {
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = buf.d[i * 4] * 0.299 + buf.d[i * 4 + 1] * 0.587 + buf.d[i * 4 + 2] * 0.114;
    return { t: 'g', d };
  }
  return buf;
}
function grayOf(ins, idx, ctx) {
  const b = bufConvert(ins[idx], 'g', ctx);
  return b ? b.d : new Float32Array(ctx.W * ctx.H);
}

const NodeDefs = {

  /* ==================== 基礎圖形 ==================== */
  shape: {
    title: 'Shape', zh: '基礎圖形', cat: 'gen', inputs: [], out: 'g',
    params: [
      { k: 'type', label: '圖形', t: 'sel', def: 'blob', opts: [['disc', '實心圓 Disc'], ['blob', '柔邊圓 Soft Disc'], ['gauss', '高斯光點 Gaussian'], ['poly', '多邊形 Polygon'], ['ring', '圓環 Ring'], ['square', '方形 Square'], ['spike', '尖刺 Spike']] },
      { k: 'size', label: '大小', t: 'f', def: 0.8, min: 0.05, max: 1.6, step: 0.01 },
      // 柔化只作用於硬邊圖形;blob/gauss 的邊緣由 falloff 控制
      { k: 'soft', label: '邊緣柔化', t: 'f', def: 0.06, min: 0.002, max: 1, step: 0.002, show: p => p.type !== 'blob' && p.type !== 'gauss' },
      { k: 'falloff', label: '衰減曲線', t: 'f', def: 1.6, min: 0.2, max: 6, step: 0.05, show: p => p.type === 'blob' || p.type === 'spike' },
      { k: 'sides', label: '邊數', t: 'i', def: 5, min: 3, max: 12, show: p => p.type === 'poly' },
      { k: 'width', label: '寬度', t: 'f', def: 0.18, min: 0.01, max: 1, step: 0.005, show: p => p.type === 'ring' || p.type === 'spike' },
      // 旋轉對圓/柔邊圓/高斯/環等對稱圖形無意義,只在非對稱圖形顯示
      { k: 'rot', label: '旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1, show: p => p.type === 'poly' || p.type === 'square' || p.type === 'spike' },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const a = p.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ux = (x + 0.5) / W * 2 - 1, uy = (y + 0.5) / H * 2 - 1;
        const lx = ux * c + uy * s, ly = -ux * s + uy * c;
        d[y * W + x] = Filters.shapeField(lx, ly, p);
      }
      return { t: 'g', d };
    }
  },

  ramp: {
    title: 'Ramp', zh: '線性漸層', cat: 'gen', inputs: [], out: 'g',
    params: [
      { k: 'angle', label: '方向°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'start', label: '黑點位置', t: 'f', def: 0, min: 0, max: 1, step: 0.005 },
      { k: 'end', label: '白點位置', t: 'f', def: 1, min: 0.01, max: 1, step: 0.005 },
      { k: 'curve', label: '曲線', t: 'f', def: 1, min: 0.2, max: 6, step: 0.05 },
      { k: 'mirror', label: '鏡像(兩端暗)', t: 'b', def: false },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const a = p.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const span = Math.max(1e-4, p.end - p.start);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = ((x + 0.5) / W - 0.5) * c + ((y + 0.5) / H - 0.5) * s + 0.5;
        let t = Filters.clamp01((u - p.start) / span);
        if (p.mirror) t = 1 - Math.abs(t * 2 - 1);
        d[y * W + x] = Math.pow(t, p.curve);
      }
      return { t: 'g', d };
    }
  },

  blobField: {
    title: 'Blob Field', zh: '團塊高度場', cat: 'gen', inputs: [], out: 'g',
    params: [
      { k: 'count', label: '團塊數', t: 'i', def: 7, min: 1, max: 14 },
      { k: 'size', label: '團塊大小', t: 'f', def: 0.9, min: 0.1, max: 1.6, step: 0.01 },
      { k: 'spread', label: '聚集範圍', t: 'f', def: 0.4, min: 0, max: 1.2, step: 0.01 },
      { k: 'taper', label: '上方收窄', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
      { k: 'fuse', label: '融合圓滑', t: 'f', def: 0.4, min: 0, max: 1, step: 0.01 },
      { k: 'wobble', label: '手繪抖動', t: 'f', def: 0.35, min: 0, max: 1, step: 0.01 },
      { k: 'seed', label: '種子', t: 'seed', def: 5 },
    ],
    // 球體聯集高度場:每球 h=√(r²−d²),以 smax 平滑聯集 → 供 Cel Shade 打光成卡通團塊
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const n = Math.max(1, p.count | 0);
      const base = 0.2 * p.size;
      const blobs = [];
      blobs.push({ x: 0.5 + (Filters.rnd2(0, 0, p.seed) - 0.5) * 0.06, y: 0.56, r: base });
      for (let b = 1; b < n; b++) {
        const a = Filters.rnd2(b, 1, p.seed) * 6.283185;
        const dist = (0.10 + Filters.rnd2(b, 2, p.seed) * 0.13) * (0.4 + p.spread);
        const x = 0.5 + Math.cos(a) * dist;
        const y = 0.54 + Math.sin(a) * dist * 0.8;
        const up = 1 - (y - 0.3) / 0.5;                        // 越上面的球越小
        const rr = (0.09 + Filters.rnd2(b, 3, p.seed) * 0.09) * p.size
          * (1 - p.taper * 0.45 * (1 - Filters.clamp01(up)));
        blobs.push({ x, y, r: Math.max(0.03 * p.size, rr) });
      }
      let maxR = 0; for (const b of blobs) if (b.r > maxR) maxR = b.r;
      const wAmp = p.wobble * 0.08, k = p.fuse * 0.06;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const ox = (x + 0.5) / W, oy = (y + 0.5) / H;
        let px = ox, py = oy;
        if (wAmp > 0) {   // 手繪抖動:兩張低頻雜訊各自推移取樣座標
          px = ox + (Filters.fbm(ox * 4, oy * 4, 4, 2, 0.5, p.seed + 91, 'fbm') - 0.5) * wAmp;
          py = oy + (Filters.fbm(ox * 4, oy * 4, 4, 2, 0.5, p.seed + 173, 'fbm') - 0.5) * wAmp;
        }
        let h = 0;
        for (const b of blobs) {
          const dx = px - b.x, dy = py - b.y, d2 = dx * dx + dy * dy;
          if (d2 < b.r * b.r) h = Filters.smax(h, Math.sqrt(b.r * b.r - d2), k);
        }
        d[i] = Filters.clamp01(h / maxR);
      }
      return { t: 'g', d };
    }
  },

  tileSampler: {
    title: 'Tile Sampler', zh: '網格散佈', cat: 'gen',
    inputs: [{ n: '圖案(選用)', t: 'g' }, { n: '遮罩(選用)', t: 'g' }], out: 'g',
    params: [
      { k: 'pattern', label: '圖案(無輸入時)', t: 'sel', def: 'blob', opts: [['blob', '柔邊圓'], ['disc', '實心圓'], ['gauss', '高斯光點'], ['square', '方形'], ['spike', '尖刺']] },
      { k: 'count', label: '格數', t: 'i', def: 6, min: 1, max: 24 },
      { k: 'size', label: '大小', t: 'f', def: 0.8, min: 0.05, max: 4, step: 0.01 },
      { k: 'sizeRand', label: '大小隨機', t: 'f', def: 0.4, min: 0, max: 1, step: 0.01 },
      { k: 'posRand', label: '位置隨機', t: 'f', def: 0.5, min: 0, max: 2, step: 0.01 },
      { k: 'rotRand', label: '旋轉隨機', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'briRand', label: '亮度隨機', t: 'f', def: 0.3, min: 0, max: 1, step: 0.01 },
      { k: 'coverage', label: '覆蓋率', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
      { k: 'maskThreshold', label: '遮罩閾值', t: 'f', def: 0.5, min: 0, max: 1, step: 0.005 },
      { k: 'maskInvert', label: '反轉遮罩', t: 'b', def: false },
      { k: 'seed', label: '種子', t: 'seed', def: 1 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const img = ins[0] ? grayOf(ins, 0, ctx) : null;   // Pattern Input
      const mask = ins[1] ? grayOf(ins, 1, ctx) : null;  // Mask Input:依實例中心取樣遮罩決定去留
      const n = p.count, cw = 1 / n;
      const sp = { type: p.pattern, size: 1, soft: p.pattern === 'disc' || p.pattern === 'square' ? 0.06 : 0.02, falloff: 1.8, width: 0.5, sides: 5 };
      for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
        const r1 = Filters.rnd2(gx, gy, p.seed), r2 = Filters.rnd2(gx, gy, p.seed + 31);
        const r3 = Filters.rnd2(gx, gy, p.seed + 67), r4 = Filters.rnd2(gx, gy, p.seed + 97);
        const r5 = Filters.rnd2(gx, gy, p.seed + 131), r6 = Filters.rnd2(gx, gy, p.seed + 173);
        if (r6 > p.coverage) continue;
        const cx = (gx + 0.5 + (r1 - 0.5) * p.posRand) * cw;
        const cy = (gy + 0.5 + (r2 - 0.5) * p.posRand) * cw;
        if (mask) {
          const mi = Filters.mod(Math.floor(cy * H), H) * W + Filters.mod(Math.floor(cx * W), W);
          let keep = mask[mi] >= p.maskThreshold;
          if (p.maskInvert) keep = !keep;
          if (!keep) continue;
        }
        const sz = cw * 0.5 * p.size * (1 - p.sizeRand * r3);
        if (sz < 0.001) continue;
        const rot = r4 * 6.2832 * p.rotRand;
        const bri = 1 - p.briRand * r5;
        if (img) Filters.stampImage(d, W, H, cx, cy, sz, sz, rot, img, W, H, bri);
        else Filters.stampInstance(d, W, H, cx, cy, sz, sz, rot, sp, bri);
      }
      return { t: 'g', d };
    }
  },

  splatterCircular: {
    title: 'Splatter Circular', zh: '環狀散佈', cat: 'gen',
    inputs: [{ n: '圖案(選用)', t: 'g' }], out: 'g',
    params: [
      { k: 'pattern', label: '圖案(無輸入時)', t: 'sel', def: 'spike', opts: [['spike', '尖刺 Spike'], ['blob', '柔邊圓'], ['disc', '實心圓'], ['streak', '拖尾光條']] },
      { k: 'count', label: '數量', t: 'i', def: 12, min: 1, max: 64 },
      { k: 'radius', label: '環半徑', t: 'f', def: 0.28, min: 0, max: 0.6, step: 0.005 },
      { k: 'size', label: '長度', t: 'f', def: 0.22, min: 0.01, max: 0.6, step: 0.005 },
      { k: 'width', label: '寬度比', t: 'f', def: 0.3, min: 0.03, max: 1.5, step: 0.01 },
      { k: 'sizeRand', label: '長度隨機', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
      { k: 'angJitter', label: '角度抖動', t: 'f', def: 0.3, min: 0, max: 1, step: 0.01 },
      { k: 'radJitter', label: '半徑抖動', t: 'f', def: 0.15, min: 0, max: 1, step: 0.01 },
      { k: 'spread', label: '弧長範圍°', t: 'f', def: 360, min: 10, max: 360, step: 1 },
      { k: 'sizeFade', label: '大小漸變(首→尾)', t: 'f', def: 0, min: -1, max: 1, step: 0.01 },
      { k: 'radFade', label: '半徑螺旋(首→尾)', t: 'f', def: 0, min: -1, max: 1, step: 0.01 },
      { k: 'briFade', label: '亮度衰減(首→尾)', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'widthRand', label: '粗細隨機', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'briRand', label: '亮度隨機', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'sharp', label: '尖刺銳度', t: 'f', def: 1.6, min: 0.8, max: 4, step: 0.05 },
      { k: 'rotOff', label: '整體旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'seed', label: '種子', t: 'seed', def: 7 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const img = ins[0] ? grayOf(ins, 0, ctx) : null; // Pattern Image 輸入
      const base = p.rotOff * Math.PI / 180;
      const spreadRad = p.spread * Math.PI / 180;
      // 滿圈時均分整圓;弧段時首尾都落在端點上
      const denom = p.spread >= 359.5 ? p.count : Math.max(1, p.count - 1);
      for (let i = 0; i < p.count; i++) {
        const r1 = Filters.rnd2(i, 3, p.seed), r2 = Filters.rnd2(i, 17, p.seed + 41);
        const r3 = Filters.rnd2(i, 29, p.seed + 83);
        const r4 = Filters.rnd2(i, 47, p.seed + 131), r5 = Filters.rnd2(i, 59, p.seed + 173);
        const t = p.count > 1 ? i / (p.count - 1) : 0;     // 序列進度 0..1(首→尾漸變用)
        const a = base + (i / denom) * spreadRad + (r1 - 0.5) * p.angJitter * (spreadRad / denom);
        const rad = p.radius * (1 + (r2 - 0.5) * 2 * p.radJitter) * (1 + p.radFade * t);
        const sz = p.size * (1 - p.sizeRand * r3) * Math.max(0, 1 + p.sizeFade * t);
        if (sz < 0.002) continue;
        const cx = 0.5 + Math.cos(a) * rad, cy = 0.5 + Math.sin(a) * rad;
        const rot = a + Math.PI / 2;                       // 徑向朝外(圖像上緣朝外)
        const w = p.width * (1 - p.widthRand * r4);        // 每根粗細隨機分布
        const bri = (1 - p.briRand * r5) * (1 - p.briFade * t);
        if (img) {
          Filters.stampImage(d, W, H, cx, cy, sz * w, sz, rot, img, W, H, bri);
        } else {
          const isStreak = p.pattern === 'streak';
          const sp = { type: isStreak ? 'blob' : p.pattern, size: 1, soft: 0.04, falloff: isStreak ? p.sharp + 0.6 : p.sharp, width: 0.9, sides: 5 };
          Filters.stampInstance(d, W, H, cx, cy, sz * w, sz, rot, sp, bri);
        }
      }
      return { t: 'g', d };
    }
  },

  shapeMapper: {
    title: 'Shape Mapper', zh: '環形映射', cat: 'gen', inputs: [{ n: '圖案', t: 'g' }], out: 'g',
    params: [
      { k: 'count', label: '重複數', t: 'i', def: 8, min: 1, max: 48 },
      { k: 'r0', label: '內半徑', t: 'f', def: 0.25, min: 0, max: 1, step: 0.005 },
      { k: 'r1', label: '外半徑', t: 'f', def: 0.45, min: 0.01, max: 1, step: 0.005 },
      { k: 'phase', label: '相位旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'flip', label: '徑向翻轉', t: 'b', def: false },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const src = grayOf(ins, 0, ctx);
      const ph = p.phase * Math.PI / 180;
      const span = Math.max(1e-4, p.r1 - p.r0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x + 0.5) / W - 0.5, dy = (y + 0.5) / H - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        let sv = (r - p.r0) / span;
        if (sv < 0 || sv > 1) continue;
        if (p.flip) sv = 1 - sv;
        const th = Math.atan2(dy, dx) + ph;
        const su = Filters.fract(th / 6.283185 * p.count);
        d[y * W + x] = Filters.sampleWrap(src, W, H, su * W - 0.5, (1 - sv) * (H - 1));
      }
      return { t: 'g', d };
    }
  },

  /* ==================== 雜訊 ==================== */
  /* ==== 移植自 NoiseGenerator 的五個特效生成器(bbccx021.github.io/NoiseGenerator)==== */

  slashArc: {
    title: 'Slash Arc', zh: '弧月斬擊', cat: 'fx', inputs: [], out: 'g',
    params: [
      { k: 'radius', label: '弧半徑', t: 'f', def: 0.36, min: 0.15, max: 0.48, step: 0.005 },
      { k: 'width', label: '弧寬', t: 'f', def: 0.22, min: 0.05, max: 0.4, step: 0.005 },
      { k: 'span', label: '弧長°', t: 'f', def: 143, min: 40, max: 180, step: 1 },
      { k: 'rot', label: '旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'streak', label: '拖絲強度', t: 'f', def: 0.9, min: 0, max: 1.5, step: 0.01 },
      { k: 'freq', label: '絲密度', t: 'f', def: 1, min: 0.3, max: 3, step: 0.05 },
      { k: 'seed', label: '種子', t: 'seed', def: 7 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const ca = Math.cos(-p.rot * Math.PI / 180), sa = Math.sin(-p.rot * Math.PI / 180);
      const rIn = p.radius - p.width / 2, rOut = p.radius + p.width / 2;
      const fe = p.width * 0.45;                       // 內外緣羽化
      const span1 = p.span * Math.PI / 180, span0 = span1 * 0.52;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx0 = (x + 0.5) / W - 0.5, dy0 = (y + 0.5) / H - 0.5;
        const dx = dx0 * ca - dy0 * sa, dy = dx0 * sa + dy0 * ca;
        const r = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx);
        const band = Filters.sstep(rIn, rIn + fe, r) * (1 - Filters.sstep(rOut - fe * 0.4, rOut, r));
        if (band <= 0) { d[y * W + x] = 0; continue; }
        const arcT = 1 - Filters.sstep(span0, span1, Math.abs(a));
        if (arcT <= 0) { d[y * W + x] = 0; continue; }
        const edgeB = Filters.sstep(p.radius - p.width * 0.2, rOut, r);   // 外緣較利較亮
        // 拖絲:沿弧向拉長、跨半徑細變化的 fbm
        const a01 = a / (Math.PI * 2) + 0.5;
        const str = Filters.fbm(a01 * 1.0, r * 8.8 * p.freq, 16, 3, 0.5, p.seed, 'fbm');
        const v = band * arcT * (0.35 + edgeB * 1.1) * (0.5 + str * p.streak);
        d[y * W + x] = Filters.clamp01(v);
      }
      return { t: 'g', d };
    }
  },

  trailStrands: {
    title: 'Trail Strands', zh: '拖尾絲束', cat: 'fx', inputs: [], out: 'g',
    params: [
      { k: 'strands', label: '絲束數', t: 'i', def: 4, min: 2, max: 8 },
      { k: 'spread', label: '散開幅度', t: 'f', def: 0.26, min: 0.05, max: 0.6, step: 0.01 },
      { k: 'decay', label: '衰減', t: 'f', def: 1, min: 0.4, max: 2.5, step: 0.05 },
      { k: 'sway', label: '擺動', t: 'f', def: 1, min: 0, max: 3, step: 0.05 },
      { k: 'head', label: '頭部亮核', t: 'f', def: 0.9, min: 0, max: 1.5, step: 0.05 },
      { k: 'streak', label: '絲紋強度', t: 'f', def: 0.6, min: 0, max: 1.2, step: 0.05 },
      { k: 'seed', label: '種子', t: 'seed', def: 12 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const rand = Filters.seqRNG((p.seed | 0) + 101);
      const S = p.strands | 0;
      const yc = [], wd = [], dec = [], amp = [], wf = [], wp = [];
      for (let k = 0; k < S; k++) {
        yc.push(0.5 + (rand() - 0.5) * p.spread);
        wd.push(0.015 + rand() * 0.030);
        dec.push((1.2 + rand() * 1.0) * p.decay);
        amp.push(0.45 + rand() * 0.55);
        wf.push(6 + rand() * 6);
        wp.push(rand() * 6.28);
      }
      for (let y = 0; y < H; y++) {
        const v = (y + 0.5) / H;
        for (let x = 0; x < W; x++) {
          const u = (x + 0.5) / W;
          let b = 0;
          for (let k = 0; k < S; k++) {
            const yy = yc[k] + Math.sin(u * wf[k] + wp[k]) * 0.016 * p.sway;
            b += Math.exp(-Math.pow((v - yy) / wd[k], 2)) * Math.pow(1 - u, dec[k]) * amp[k];
          }
          const str = Filters.fbm(u * 0.45, v * 5.4, 8, 3, 0.5, p.seed, 'fbm');
          const head = Math.exp(-((u - 0.05) * (u - 0.05)) / 0.004 - ((v - 0.5) * (v - 0.5)) / 0.015) * p.head;
          d[y * W + x] = Math.min(1, (b * (0.55 + str * p.streak) + head) * Filters.sstep(0, 0.04, u));
        }
      }
      return { t: 'g', d };
    }
  },

  boltGen: {
    title: 'Bolt', zh: '閃電束', cat: 'fx', inputs: [], out: 'g',
    params: [
      { k: 'jag', label: '鋸齒程度', t: 'f', def: 0.5, min: 0.15, max: 0.8, step: 0.01 },
      { k: 'branches', label: '分支數', t: 'i', def: 3, min: 0, max: 6 },
      { k: 'width', label: '線寬', t: 'f', def: 1, min: 0.4, max: 2.5, step: 0.05 },
      { k: 'headW', label: '頭端粗細', t: 'f', def: 1, min: 0.05, max: 1.5, step: 0.01 },
      { k: 'tailW', label: '尾端粗細', t: 'f', def: 0.45, min: 0.05, max: 1.5, step: 0.01 },
      { k: 'taperLen', label: '收細距離', t: 'f', def: 0.35, min: 0.05, max: 0.5, step: 0.01 },
      { k: 'glow', label: '柔暈比重', t: 'f', def: 1, min: 0, max: 2, step: 0.05 },
      { k: 'endGlow', label: '末端光球', t: 'f', def: 0.55, min: 0, max: 1.2, step: 0.05 },
      { k: 'seed', label: '種子', t: 'seed', def: 3 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx;
      const rand = Filters.seqRNG(p.seed | 0);
      const segs = [];
      const wBase = 0.0075 * p.width;
      const addBolt = (pts, w0, w1, b0, b1) => {
        const n = pts.length - 1;
        for (let k = 0; k < n; k++) {
          const t = k / n;
          segs.push({
            ax: pts[k].x, ay: pts[k].y, bx: pts[k + 1].x, by: pts[k + 1].y,
            w: Math.max(1e-4, w0 + (w1 - w0) * t),
            b: (b0 + (b1 - b0) * t) * (0.8 + rand() * 0.35),   // 每段閃爍抖動
          });
        }
      };
      // 主幹(上→下):寬度剖面 = 兩端細、中段全寬;taperLen 控制端點到全寬的過渡距離
      const L = Math.max(0.02, Math.min(0.5, p.taperLen));
      const prof = t => {
        if (t < L) return p.headW + (1 - p.headW) * Filters.sstep(0, L, t);
        if (t > 1 - L) return 1 + (p.tailW - 1) * Filters.sstep(1 - L, 1, t);
        return 1;
      };
      const xTop = 0.5 + (rand() - 0.5) * 0.10;
      const xBot = 0.5 + (rand() - 0.5) * 0.16;
      const main = Filters.fractalPath(rand, xTop, 0.02, xBot, 0.98, 5, p.jag);
      {
        const n = main.length - 1;
        for (let k = 0; k < n; k++) {
          const t = k / n;
          segs.push({
            ax: main[k].x, ay: main[k].y, bx: main[k + 1].x, by: main[k + 1].y,
            w: Math.max(1e-4, wBase * prof(t)),
            b: (1.0 - 0.15 * t) * (0.8 + rand() * 0.35),
          });
        }
      }
      // 分支與子分支:斜出、末端收細淡出
      for (let b = 0; b < p.branches; b++) {
        const pi = 3 + Math.floor(rand() * (main.length - 8));
        const pt = main[pi];
        const dir = rand() < 0.5 ? -1 : 1;
        const ex = pt.x + dir * (0.08 + rand() * 0.16);
        const ey = Math.min(0.99, pt.y + 0.12 + rand() * 0.18);
        const bp = Filters.fractalPath(rand, pt.x, pt.y, ex, ey, 4, p.jag * 0.9);
        addBolt(bp, wBase * 0.45, wBase * 0.08, 0.5, 0.08);
        if (rand() > 0.6) {
          const spi = 2 + Math.floor(rand() * (bp.length - 4));
          const sp = bp[spi];
          const sp2 = Filters.fractalPath(rand, sp.x, sp.y,
            sp.x + dir * (0.06 + rand() * 0.12),
            Math.min(0.99, sp.y + 0.10 + rand() * 0.12), 3, p.jag * 0.9);
          addBolt(sp2, wBase * 0.25, wBase * 0.05, 0.4, 0.06);
        }
      }
      const d = Filters.rasterSegs(segs, W, H, p.glow);
      if (p.endGlow > 0.001) {                          // 末端衝擊光球
        const ex = main[main.length - 1].x, ey = main[main.length - 1].y;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = (x + 0.5) / W - ex, dy = (y + 0.5) / H - ey;
          const i = y * W + x;
          d[i] = Math.min(1, d[i] + Math.exp(-(dx * dx + dy * dy) / 0.0009) * p.endGlow);
        }
      }
      return { t: 'g', d };
    }
  },

  ringBolt: {
    title: 'Ring Bolt', zh: '環形電圈', cat: 'fx', inputs: [], out: 'g',
    params: [
      { k: 'radius', label: '半徑', t: 'f', def: 0.32, min: 0.15, max: 0.42, step: 0.005 },
      { k: 'loops', label: '環數', t: 'i', def: 2, min: 1, max: 3 },
      { k: 'jag', label: '鋸齒程度', t: 'f', def: 0.22, min: 0.05, max: 0.5, step: 0.01 },
      { k: 'sparks', label: '放電火花', t: 'i', def: 4, min: 0, max: 8 },
      { k: 'width', label: '線寬', t: 'f', def: 1, min: 0.4, max: 2.5, step: 0.05 },
      { k: 'glow', label: '柔暈比重', t: 'f', def: 1, min: 0, max: 2, step: 0.05 },
      { k: 'seed', label: '種子', t: 'seed', def: 5 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx;
      const rand = Filters.seqRNG(((p.seed * 2654435761) >>> 0) || 1);
      rand(); rand();
      const R = p.radius, wBase = 0.0065 * p.width, levels = 5;
      const segs = [];
      // 閉合的多尺度鋸齒偏移(首尾線性融合 → 無縫接環)
      const closedOffsets = (jag) => {
        let a = [0, 0];
        for (let l = 0; l < levels; l++) {
          const b = [a[0]];
          for (let k = 1; k < a.length; k++) {
            b.push((a[k - 1] + a[k]) / 2 + (rand() - 0.5) * jag / Math.pow(1.8, l));
            b.push(a[k]);
          }
          a = b;
        }
        const m = a.length - 1;
        for (let k = 0; k <= m; k++) { const t = k / m; a[k] = a[k] * (1 - t) + a[0] * t; }
        return a;
      };
      const addLoop = (jag, phase, w, b) => {
        const f = closedOffsets(jag);
        const m = f.length - 1;
        let px = null, py = null;
        for (let k = 0; k <= m; k++) {
          const th = k / m * Math.PI * 2 + phase;
          const r = R * (1 + f[k]);
          const x = 0.5 + Math.cos(th) * r, y = 0.5 + Math.sin(th) * r;
          if (px !== null) segs.push({ ax: px, ay: py, bx: x, by: y, w, b: b * (0.75 + rand() * 0.4) });
          px = x; py = y;
        }
      };
      addLoop(p.jag, 0, wBase, 1.0);                                // 主電環
      if (p.loops >= 2) addLoop(p.jag * 1.36, 0.9, wBase * 0.55, 0.45);   // 伴隨細環
      if (p.loops >= 3) addLoop(p.jag * 1.7, 2.1, wBase * 0.4, 0.3);
      // 放電火花:向外/向內短枝
      for (let s = 0; s < p.sparks; s++) {
        const th = rand() * Math.PI * 2;
        let x = 0.5 + Math.cos(th) * R, y = 0.5 + Math.sin(th) * R;
        const dir = rand() < 0.7 ? 1 : -1;
        const len = 0.06 + rand() * 0.10;
        for (let k = 1; k <= 4; k++) {
          const t = k / 4;
          const nx = 0.5 + Math.cos(th) * (R + dir * len * t) + (rand() - 0.5) * 0.03;
          const ny = 0.5 + Math.sin(th) * (R + dir * len * t) + (rand() - 0.5) * 0.03;
          segs.push({ ax: x, ay: y, bx: nx, by: ny, w: wBase * 0.5 * (1 - t * 0.8), b: 0.5 * (1 - t * 0.7) });
          x = nx; y = ny;
        }
      }
      return { t: 'g', d: Filters.rasterSegs(segs, W, H, p.glow) };
    }
  },

  magicCircle: {
    title: 'Magic Circle', zh: '魔法陣', cat: 'fx', inputs: [], out: 'g',
    params: [
      { k: 'scale', label: '陣形半徑', t: 'f', def: 1, min: 0.55, max: 1.2, step: 0.01 },
      { k: 'ticks', label: '刻度數', t: 'i', def: 30, min: 12, max: 48 },
      { k: 'star', label: '六芒星', t: 'b', def: true },
      { k: 'runes', label: '咒文符文', t: 'b', def: true },
      { k: 'lineW', label: '線條粗細', t: 'f', def: 1, min: 0.5, max: 3, step: 0.05 },
      { k: 'glow', label: '柔光強度', t: 'f', def: 0.13, min: 0, max: 0.5, step: 0.01 },
      { k: 'seed', label: '種子', t: 'seed', def: 4 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const rand = Filters.seqRNG(p.seed | 0);
      const RM = p.scale, LW = p.lineW;
      const r1 = 0.44 * RM, r2 = 0.40 * RM, r3 = 0.27 * RM, rDash = 0.315 * RM, rRune = 0.355 * RM;
      const segs = [];
      const rot = rand() * Math.PI * 2;
      // 符文筆畫:主豎幹 + 斜枝 + 機率副幹
      const addRune = (cx, cy, h, ang, w, b) => {
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        const stroke = (x1, y1, x2, y2) => segs.push({
          ax: cx + (x1 * cosA - y1 * sinA) * h, ay: cy + (x1 * sinA + y1 * cosA) * h,
          bx: cx + (x2 * cosA - y2 * sinA) * h, by: cy + (x2 * sinA + y2 * cosA) * h,
          w: w * LW, b,
        });
        stroke(0, -0.5, 0, 0.5);
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const y0 = -0.5 + rand() * 0.7;
          const dir = rand() < 0.5 ? -1 : 1;
          const dy = 0.25 + rand() * 0.5;
          const y1 = rand() < 0.35 ? y0 - dy * 0.6 : y0 + dy;
          stroke(0, y0, dir * 0.45, Math.max(-0.55, Math.min(0.55, y1)));
        }
        if (rand() < 0.30) {
          stroke(0.42, -0.5, 0.42, 0.5);
          if (rand() < 0.5) stroke(0, -0.1 + rand() * 0.2, 0.42, -0.1 + rand() * 0.2);
        }
      };
      if (p.star) for (let k = 0; k < 6; k++) {         // 六芒星弦線
        const a1 = k / 6 * Math.PI * 2 + rot, a2 = (k + 2) / 6 * Math.PI * 2 + rot;
        segs.push({ ax: 0.5 + Math.cos(a1) * r3, ay: 0.5 + Math.sin(a1) * r3,
                    bx: 0.5 + Math.cos(a2) * r3, by: 0.5 + Math.sin(a2) * r3, w: 0.0024 * LW, b: 0.85 });
      }
      if (p.runes) {
        for (let s = 0; s < 16; s++) {                  // 外圈 16 大符文
          const a = s / 16 * Math.PI * 2 + rot;
          addRune(0.5 + Math.cos(a) * rRune, 0.5 + Math.sin(a) * rRune,
            0.050 * RM, a + Math.PI / 2 + (rand() - 0.5) * 0.08, 0.0017, 0.95);
        }
        for (let s = 0; s < 12; s++) {                  // 內圈 12 小符文
          const a = s / 12 * Math.PI * 2 + rot + 0.13;
          addRune(0.5 + Math.cos(a) * 0.292 * RM, 0.5 + Math.sin(a) * 0.292 * RM,
            0.030 * RM, a + Math.PI / 2 + (rand() - 0.5) * 0.08, 0.0013, 0.8);
        }
      }
      // 逐列分桶
      const margin = 0.05;
      const rowSegs = Array.from({ length: H }, () => []);
      for (let si = 0; si < segs.length; si++) {
        const sg = segs[si];
        const y0 = Math.max(0, Math.floor((Math.min(sg.ay, sg.by) - margin) * H));
        const y1 = Math.min(H - 1, Math.ceil((Math.max(sg.ay, sg.by) + margin) * H));
        for (let j = y0; j <= y1; j++) rowSegs[j].push(si);
      }
      // 雙線環:[半徑, 線寬, 亮度](主線 + 伴隨細線)
      const rings = [
        [r1, 0.0050 * LW, 1.00], [r1 + 0.014, 0.0016 * LW, 0.70],
        [r2, 0.0028 * LW, 0.90],
        [r3, 0.0038 * LW, 0.90], [r3 - 0.017, 0.0014 * LW, 0.65],
      ];
      for (let j = 0; j < H; j++) {
        const dy = (j + 0.5) / H - 0.5;
        const list = rowSegs[j];
        for (let i = 0; i < W; i++) {
          const dx = (i + 0.5) / W - 0.5;
          const r = Math.sqrt(dx * dx + dy * dy);
          const a = Math.atan2(dy, dx) + Math.PI;
          let crisp = 0, glow = 0;
          for (let k = 0; k < rings.length; k++) {
            const dd = r - rings[k][0], lw = rings[k][1], b = rings[k][2];
            crisp = Math.max(crisp, b * Math.exp(-(dd * dd) / (lw * lw)));
            glow += b * Math.exp(-(dd * dd) / (lw * lw * 60));
          }
          const ph = (a / (Math.PI * 2) * 30) % 1;      // 虛線環
          const dash = Filters.sstep(0.02, 0.10, ph) * (1 - Filters.sstep(0.50, 0.58, ph));
          crisp = Math.max(crisp, Math.exp(-((r - rDash) * (r - rDash)) / (0.0022 * 0.0022 * LW * LW)) * 0.8 * dash);
          const tph = (a / (Math.PI * 2) * p.ticks) % 1;   // 外環刻度
          const tick = Math.max(1 - Filters.sstep(0.04, 0.10, tph), Filters.sstep(0.90, 0.96, tph));
          const bandT = Filters.sstep(r2 - 0.004, r2, r) * (1 - Filters.sstep(r1, r1 + 0.004, r));
          crisp = Math.max(crisp, tick * bandT * 0.95);
          const px = dx + 0.5, py = dy + 0.5;
          for (let s = 0; s < list.length; s++) {
            const sg = segs[list[s]];
            const dd = Filters.segDist(px, py, sg.ax, sg.ay, sg.bx, sg.by);
            if (dd > 0.05) continue;
            if (dd < 0.012) crisp = Math.max(crisp, sg.b * Math.exp(-(dd * dd) / (sg.w * sg.w)));
            glow += sg.b * Math.exp(-(dd * dd) / 0.0006) * 0.35;
          }
          const v = Math.min(1, crisp + glow * p.glow);
          d[j * W + i] = v * (1 - Filters.sstep(0.46 * RM + 0.02, 0.5, r));
        }
      }
      return { t: 'g', d };
    }
  },

  perlin: {
    title: 'Perlin Noise', zh: '柏林雜訊', cat: 'noise', inputs: [], out: 'g',
    params: [
      { k: 'mode', label: '型態', t: 'sel', def: 'fbm', opts: [['fbm', '分形 fBm'], ['billow', '雲絮 Billow'], ['ridged', '山脊 Ridged']] },
      { k: 'scale', label: '縮放(格)', t: 'i', def: 4, min: 1, max: 32 },
      { k: 'octaves', label: '疊代層數', t: 'i', def: 5, min: 1, max: 8 },
      { k: 'gain', label: '細節強度', t: 'f', def: 0.5, min: 0.1, max: 0.9, step: 0.01 },
      { k: 'seed', label: '種子', t: 'seed', def: 3 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        d[y * W + x] = Filters.fbm((x + 0.5) / W * p.scale, (y + 0.5) / H * p.scale, p.scale, p.octaves, p.gain, p.seed, p.mode);
      }
      return { t: 'g', d };
    }
  },

  cells: {
    title: 'Cells / Crystal', zh: '細胞雜訊', cat: 'noise', inputs: [], out: 'g',
    params: [
      { k: 'mode', label: '型態', t: 'sel', def: 'f1', opts: [['f1', '距離場 Cells'], ['crystal', '晶格 Crystal'], ['edge', '裂縫 Cracks'], ['value', '隨機色塊 Blocks']] },
      { k: 'scale', label: '縮放(格)', t: 'i', def: 8, min: 2, max: 48 },
      { k: 'contrast', label: '對比', t: 'f', def: 1, min: 0.3, max: 3, step: 0.01 },
      { k: 'seed', label: '種子', t: 'seed', def: 5 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const w = Filters.worley((x + 0.5) / W * p.scale, (y + 0.5) / H * p.scale, p.scale, p.seed);
        let v;
        if (p.mode === 'f1') v = 1 - Filters.clamp01(w.f1 * 1.25);
        else if (p.mode === 'crystal') v = Filters.clamp01((w.f2 - w.f1) * 1.5);
        else if (p.mode === 'edge') v = 1 - Filters.clamp01((w.f2 - w.f1) * 2.2);
        else v = w.id;
        d[y * W + x] = Filters.clamp01(Math.pow(v, p.contrast));
      }
      return { t: 'g', d };
    }
  },

  /* ==================== 變形扭曲 ==================== */
  warp: {
    title: 'Warp', zh: '扭曲', cat: 'distort', inputs: [{ n: '輸入', t: 'g' }, { n: '強度圖', t: 'g' }], out: 'g',
    params: [
      { k: 'mode', label: '模式', t: 'sel', def: 'grad', opts: [['grad', '梯度扭曲 Warp'], ['dir', '方向扭曲 Directional']] },
      { k: 'intensity', label: '強度', t: 'f', def: 3, min: 0, max: 12, step: 0.05 },
      { k: 'angle', label: '方向°', t: 'f', def: -90, min: -180, max: 180, step: 1, show: p => p.mode === 'dir' },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const src = grayOf(ins, 0, ctx);
      const slope = ins[1] ? grayOf(ins, 1, ctx) : src;
      if (p.mode === 'grad') {
        // 位移(px) = 每像素梯度 gx × 強度 × W²/1000 → 視覺效果與解析度無關
        const k = p.intensity * W * W / 1000;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const gx = (slope[y * W + (x + 1) % W] - slope[y * W + Filters.mod(x - 1, W)]) * 0.5;
          const gy = (slope[((y + 1) % H) * W + x] - slope[Filters.mod(y - 1, H) * W + x]) * 0.5;
          d[y * W + x] = Filters.sampleWrap(src, W, H, x + gx * k, y + gy * k);
        }
      } else {
        const a = p.angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
        const k = p.intensity * W / 24;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const s = (slope[y * W + x] - 0.5) * 2 * k;
          d[y * W + x] = Filters.sampleWrap(src, W, H, x + dx * s, y + dy * s);
        }
      }
      return { t: 'g', d };
    }
  },

  multiWarp: {
    title: 'Multi-Dir Warp', zh: '多向扭曲', cat: 'distort',
    inputs: [{ n: '輸入', t: 'g' }, { n: '強度圖', t: 'g' }], out: 'g',
    params: [
      { k: 'mode', label: '合成方式', t: 'sel', def: 'max', opts: [['max', '取亮 Max(拉出拖絲)'], ['min', '取暗 Min(收縮吃邊)'], ['avg', '平均 Average']] },
      { k: 'dirs', label: '方向數', t: 'i', def: 4, min: 2, max: 8 },
      { k: 'intensity', label: '強度', t: 'f', def: 2.5, min: 0, max: 12, step: 0.05 },
      { k: 'angle', label: '起始角°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx;
      const src = grayOf(ins, 0, ctx);
      const slope = ins[1] ? grayOf(ins, 1, ctx) : src;
      if (p.intensity <= 0.001) return { t: 'g', d: src.slice() };
      return { t: 'g', d: Filters.multiWarp(src, slope, W, H, p.dirs, p.angle, p.intensity, p.mode) };
    }
  },

  slopeBlur: {
    title: 'Slope Blur', zh: '斜率模糊', cat: 'distort',
    inputs: [{ n: '輸入', t: 'g' }, { n: '斜率圖', t: 'g' }], out: 'g',
    params: [
      { k: 'mode', label: '模式', t: 'sel', def: 'max', opts: [['max', '擴張生長 Max'], ['min', '侵蝕 Min'], ['blur', '融化拖絲 Blur']] },
      { k: 'intensity', label: '強度(負=反向)', t: 'f', def: 3, min: -10, max: 10, step: 0.05 },
      { k: 'samples', label: '取樣數(1=不規則)', t: 'i', def: 12, min: 1, max: 32 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx;
      const src = grayOf(ins, 0, ctx);
      const slope = ins[1] ? grayOf(ins, 1, ctx) : src;
      if (Math.abs(p.intensity) <= 0.001) return { t: 'g', d: src.slice() };
      return { t: 'g', d: Filters.slopeBlur(src, slope, W, H, p.samples, p.intensity, p.mode) };
    }
  },

  swirl: {
    title: 'Swirl', zh: '漩渦', cat: 'distort', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'amount', label: '旋轉量°', t: 'f', def: 160, min: -720, max: 720, step: 1 },
      { k: 'radius', label: '影響半徑', t: 'f', def: 0.7, min: 0.05, max: 1.5, step: 0.01 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const src = grayOf(ins, 0, ctx);
      const amt = p.amount * Math.PI / 180;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x + 0.5) / W - 0.5, dy = (y + 0.5) / H - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        const f = Filters.clamp01(1 - r / p.radius);
        const a = amt * f * f;
        const c = Math.cos(a), s = Math.sin(a);
        const nx = dx * c - dy * s + 0.5, ny = dx * s + dy * c + 0.5;
        d[y * W + x] = Filters.sampleWrap(src, W, H, nx * W - 0.5, ny * H - 0.5);
      }
      return { t: 'g', d };
    }
  },

  crossProfile: {
    title: 'Cross Profile', zh: '剖面曲線', cat: 'distort', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    // 取一條掃描線,把亮度當高度畫成剖面圖(對齊 SD Cross Section:切向/繪製樣式/位移縮放)
    params: [
      { k: 'axis', label: '切片方向', t: 'sel', def: 'h', opts: [['h', '水平切(剖面立在下方)'], ['v', '垂直切(剖面靠左)']] },
      { k: 'row', label: '取樣線位置', t: 'f', def: 0.5, min: 0, max: 1, step: 0.005 },
      { k: 'style', label: '繪製樣式', t: 'sel', def: 'solid', opts: [['solid', '實心 Solid'], ['gradient', '漸層 Gradient'], ['gmirror', '鏡像漸層 Mirrored'], ['line', '線條 Line']] },
      { k: 'scale', label: '高度縮放', t: 'f', def: 1, min: 0.1, max: 1.5, step: 0.01 },
      { k: 'base', label: '高度位移', t: 'f', def: 0, min: 0, max: 0.9, step: 0.01 },
      { k: 'lineW', label: '線條粗細(px)', t: 'f', def: 3, min: 1, max: 24, step: 0.5, show: p => p.style === 'line' },
      { k: 'soft', label: '邊緣柔度(px)', t: 'f', def: 1.5, min: 0.5, max: 24, step: 0.5 },
      { k: 'flip', label: '翻轉方向', t: 'b', def: false },
      { k: 'invert', label: '黑白反轉', t: 'b', def: false },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const src = grayOf(ins, 0, ctx);
      const vert = p.axis === 'v';
      const A = vert ? H : W;                 // 剖面取樣長度
      const across = vert ? W : H;            // 高度方向的像素數
      const prof = new Float32Array(A);
      if (vert) {
        const cx = Math.min(W - 1, Math.max(0, Math.round(p.row * (W - 1))));
        for (let y = 0; y < H; y++) prof[y] = Filters.clamp01(p.base + src[y * W + cx] * p.scale);
      } else {
        const ry = Math.min(H - 1, Math.max(0, Math.round(p.row * (H - 1))));
        for (let x = 0; x < W; x++) prof[x] = Filters.clamp01(p.base + src[ry * W + x] * p.scale);
      }
      const k = across / Math.max(0.5, p.soft);   // 填充邊緣的抗鋸齒斜率
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const h = prof[vert ? y : x];
          // u = 距基準邊的高度(水平切:底部;垂直切:左緣;flip 反向)
          let u = vert ? (x + 0.5) / W : 1 - (y + 0.5) / H;
          if (p.flip) u = 1 - u;
          let v;
          if (p.style === 'line') {
            const dist = Math.abs(h - u) * across;
            v = Filters.clamp01((p.lineW / 2 + p.soft / 2 - dist) / Math.max(0.25, p.soft));
          } else {
            const fill = Filters.clamp01((h - u) * k + 0.5);
            if (p.style === 'solid') v = fill;
            else {
              const t = h > 1e-4 ? Filters.clamp01(u / h) : 0;   // 0=基準邊 → 1=曲線頂
              v = fill * (p.style === 'gmirror' ? 1 - Math.abs(2 * t - 1) : t);
            }
          }
          d[y * W + x] = p.invert ? 1 - v : v;
        }
      }
      return { t: 'g', d };
    }
  },

  crossSection: {
    title: 'Cross Section', zh: '等高線提取', cat: 'distort', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'pos', label: '擷取位置', t: 'f', def: 0.5, min: 0, max: 1, step: 0.005 },
      { k: 'width', label: '線寬', t: 'f', def: 0.12, min: 0.005, max: 1, step: 0.005 },
      { k: 'curve', label: '曲線硬度', t: 'f', def: 1.2, min: 0.2, max: 6, step: 0.05 },
      { k: 'repeat', label: '重複次數', t: 'i', def: 1, min: 1, max: 12 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      for (let i = 0; i < N; i++) {
        let v = src[i];
        if (p.repeat > 1) v = Filters.fract(v * p.repeat);
        const band = Filters.clamp01(1 - Math.abs(v - p.pos) / (p.width * 0.5));
        d[i] = Math.pow(band, p.curve);
      }
      return { t: 'g', d };
    }
  },

  transform: {
    title: 'Transform 2D', zh: '變換', cat: 'distort', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'sx', label: '縮放 X', t: 'f', def: 1, min: 0.05, max: 4, step: 0.01 },
      { k: 'sy', label: '縮放 Y', t: 'f', def: 1, min: 0.05, max: 4, step: 0.01 },
      { k: 'rot', label: '旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'ox', label: '位移 X', t: 'f', def: 0, min: -1, max: 1, step: 0.005 },
      { k: 'oy', label: '位移 Y', t: 'f', def: 0, min: -1, max: 1, step: 0.005 },
      { k: 'tiling', label: '拼貼 Tiling', t: 'b', def: true },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const src = grayOf(ins, 0, ctx);
      const a = -p.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const smp = p.tiling ? Filters.sampleWrap : Filters.sampleZero;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let ux = (x + 0.5) / W - 0.5 - p.ox, uy = (y + 0.5) / H - 0.5 - p.oy;
        const rx = (ux * c - uy * s) / p.sx + 0.5, ry = (ux * s + uy * c) / p.sy + 0.5;
        d[y * W + x] = smp(src, W, H, rx * W - 0.5, ry * H - 0.5);
      }
      return { t: 'g', d };
    }
  },

  /* ==================== 混合 ==================== */
  blend: {
    title: 'Blend', zh: '混合', cat: 'blend', inputs: [{ n: '前景', t: 'g' }, { n: '背景', t: 'g' }], out: 'g',
    params: [
      { k: 'mode', label: '模式', t: 'sel', def: 'max', opts: [['normal', '正常 Normal'], ['add', '相加 Add'], ['sub', '相減 Subtract'], ['mul', '色彩增值 Multiply'], ['max', '取亮 Max'], ['min', '取暗 Min'], ['screen', '濾色 Screen'], ['diff', '差異 Difference']] },
      { k: 'opacity', label: '不透明度', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const fg = grayOf(ins, 0, ctx), bg = grayOf(ins, 1, ctx);
      const o = p.opacity;
      for (let i = 0; i < N; i++) {
        const f = fg[i], b = bg[i];
        let v;
        switch (p.mode) {
          case 'normal': v = f; break;
          case 'add': v = b + f; break;
          case 'sub': v = b - f; break;
          case 'mul': v = b * f; break;
          case 'max': v = Math.max(b, f); break;
          case 'min': v = Math.min(b, f); break;
          case 'screen': v = 1 - (1 - b) * (1 - f); break;
          case 'diff': v = Math.abs(b - f); break;
        }
        d[i] = Filters.clamp01(b + (v - b) * o);
      }
      return { t: 'g', d };
    }
  },

  /* ==================== 調整 ==================== */
  histogramScan: {
    title: 'Histogram Scan', zh: '直方圖掃描', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'pos', label: '位置', t: 'f', def: 0.5, min: 0, max: 1, step: 0.005 },
      { k: 'contrast', label: '對比', t: 'f', def: 0.5, min: 0, max: 1, step: 0.005 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const w = Math.max(1e-4, 1 - p.contrast), lo = p.pos - w * 0.5;
      for (let i = 0; i < N; i++) d[i] = Filters.clamp01((src[i] - lo) / w);
      return { t: 'g', d };
    }
  },

  levels: {
    title: 'Levels', zh: '色階', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'inLo', label: '輸入黑點', t: 'f', def: 0, min: 0, max: 1, step: 0.005 },
      { k: 'inHi', label: '輸入白點', t: 'f', def: 1, min: 0, max: 1, step: 0.005 },
      { k: 'gamma', label: 'Gamma', t: 'f', def: 1, min: 0.1, max: 6, step: 0.02 },
      { k: 'outLo', label: '輸出黑點', t: 'f', def: 0, min: 0, max: 1, step: 0.005 },
      { k: 'outHi', label: '輸出白點', t: 'f', def: 1, min: 0, max: 1, step: 0.005 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const span = Math.max(1e-5, p.inHi - p.inLo), g = 1 / p.gamma;
      for (let i = 0; i < N; i++) {
        const t = Math.pow(Filters.clamp01((src[i] - p.inLo) / span), g);
        d[i] = p.outLo + t * (p.outHi - p.outLo);
      }
      return { t: 'g', d };
    }
  },

  brightContrast: {
    title: 'Bright / Contrast', zh: '亮度對比', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'brightness', label: '亮度', t: 'f', def: 0, min: -1, max: 1, step: 0.01 },
      { k: 'contrast', label: '對比', t: 'f', def: 1, min: 0, max: 4, step: 0.02 },
      { k: 'pivot', label: '對比軸心', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      for (let i = 0; i < N; i++) {
        d[i] = Filters.clamp01((src[i] - p.pivot) * p.contrast + p.pivot + p.brightness);
      }
      return { t: 'g', d };
    }
  },

  curve: {
    title: 'Curve', zh: '色調曲線', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    // 五個控制點(輸入 0 / .25 / .5 / .75 / 1 的輸出值),Catmull-Rom 插值成 LUT
    params: [
      { k: 'p0', label: '黑點 (0.00)', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'p1', label: '暗部 (0.25)', t: 'f', def: 0.25, min: 0, max: 1, step: 0.01 },
      { k: 'p2', label: '中間 (0.50)', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
      { k: 'p3', label: '亮部 (0.75)', t: 'f', def: 0.75, min: 0, max: 1, step: 0.01 },
      { k: 'p4', label: '白點 (1.00)', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
      { k: 'amount', label: '套用程度', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const cp = [p.p0, p.p1, p.p2, p.p3, p.p4];
      const LUT = new Float32Array(257);
      for (let i = 0; i <= 256; i++) {
        const t = i / 256 * 4;                 // 0..4 段參數
        const k = Math.min(3, Math.floor(t)), f = t - k;
        const y0 = cp[Math.max(0, k - 1)], y1 = cp[k], y2 = cp[k + 1], y3 = cp[Math.min(4, k + 2)];
        const v = 0.5 * ((2 * y1) + (-y0 + y2) * f
          + (2 * y0 - 5 * y1 + 4 * y2 - y3) * f * f
          + (-y0 + 3 * y1 - 3 * y2 + y3) * f * f * f);
        LUT[i] = Filters.clamp01(v);
      }
      for (let i = 0; i < N; i++) {
        const x = Filters.clamp01(src[i]) * 256;
        const k = Math.min(255, x | 0);
        const v = LUT[k] + (LUT[k + 1] - LUT[k]) * (x - k);
        d[i] = src[i] + (v - src[i]) * p.amount;
      }
      return { t: 'g', d };
    }
  },

  clampRange: {
    title: 'Clamp / Remap', zh: '範圍裁切', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    // 只保留某段灰階(其餘裁掉),再拉伸回 0~1 — 挑出特定亮度層做遮罩很好用
    params: [
      { k: 'lo', label: '下限', t: 'f', def: 0, min: 0, max: 1, step: 0.005 },
      { k: 'hi', label: '上限', t: 'f', def: 1, min: 0, max: 1, step: 0.005 },
      { k: 'stretch', label: '拉伸回滿幅', t: 'b', def: true },
      { k: 'invert', label: '反轉結果', t: 'b', def: false },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const lo = Math.min(p.lo, p.hi), hi = Math.max(p.lo, p.hi);
      const span = Math.max(1e-5, hi - lo);
      for (let i = 0; i < N; i++) {
        let v = Math.max(lo, Math.min(hi, src[i]));
        if (p.stretch) v = (v - lo) / span;
        d[i] = p.invert ? 1 - v : v;
      }
      return { t: 'g', d };
    }
  },

  colorAdjust: {
    title: 'Color Adjust', zh: '色彩調整', cat: 'color', inputs: [{ n: '輸入', t: 'c' }], out: 'c',
    // 上色之後的整體修圖:色相 / 飽和 / 亮度 / 對比 / 透明度
    params: [
      { k: 'hue', label: '色相偏移°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'sat', label: '飽和度', t: 'f', def: 1, min: 0, max: 3, step: 0.02 },
      { k: 'brightness', label: '亮度', t: 'f', def: 0, min: -1, max: 1, step: 0.01 },
      { k: 'contrast', label: '對比', t: 'f', def: 1, min: 0, max: 4, step: 0.02 },
      { k: 'alpha', label: '透明度倍率', t: 'f', def: 1, min: 0, max: 3, step: 0.02 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H;
      const src = bufConvert(ins[0], 'c', ctx);
      const d = new Float32Array(N * 4);
      if (!src) return { t: 'c', d };
      const a = p.hue * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      // 繞亮度軸旋轉色相的標準 RGB 矩陣
      const m = [
        0.213 + c * 0.787 - sn * 0.213, 0.715 - c * 0.715 - sn * 0.715, 0.072 - c * 0.072 + sn * 0.928,
        0.213 - c * 0.213 + sn * 0.143, 0.715 + c * 0.285 + sn * 0.140, 0.072 - c * 0.072 - sn * 0.283,
        0.213 - c * 0.213 - sn * 0.787, 0.715 - c * 0.715 + sn * 0.715, 0.072 + c * 0.928 + sn * 0.072,
      ];
      for (let i = 0; i < N; i++) {
        const j = i * 4;
        let r = src.d[j], g = src.d[j + 1], b = src.d[j + 2];
        if (p.hue !== 0) {
          const nr = r * m[0] + g * m[1] + b * m[2];
          const ng = r * m[3] + g * m[4] + b * m[5];
          const nb = r * m[6] + g * m[7] + b * m[8];
          r = nr; g = ng; b = nb;
        }
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        r = luma + (r - luma) * p.sat;
        g = luma + (g - luma) * p.sat;
        b = luma + (b - luma) * p.sat;
        d[j]     = Filters.clamp01((r - 0.5) * p.contrast + 0.5 + p.brightness);
        d[j + 1] = Filters.clamp01((g - 0.5) * p.contrast + 0.5 + p.brightness);
        d[j + 2] = Filters.clamp01((b - 0.5) * p.contrast + 0.5 + p.brightness);
        d[j + 3] = Filters.clamp01(src.d[j + 3] * p.alpha);
      }
      return { t: 'c', d };
    }
  },

  autoLevels: {
    title: 'Auto Levels', zh: '自動色階', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'amount', label: '套用程度', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
    ],
    // 把實際用到的動態範圍拉滿,層層扭曲後對比流失時很好用
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H;
      const src = grayOf(ins, 0, ctx);
      const norm = Filters.autoLevels(src, N);
      if (p.amount >= 0.999) return { t: 'g', d: norm };
      const d = new Float32Array(N);
      for (let i = 0; i < N; i++) d[i] = src[i] + (norm[i] - src[i]) * p.amount;
      return { t: 'g', d };
    }
  },

  nonUniformBlur: {
    title: 'Non-Uniform Blur', zh: '非均勻模糊', cat: 'adjust',
    inputs: [{ n: '輸入', t: 'g' }, { n: '半徑圖', t: 'g' }], out: 'g',
    params: [
      { k: 'amount', label: '最大半徑', t: 'f', def: 3, min: 0, max: 20, step: 0.1 },
      { k: 'bias', label: '半徑偏移', t: 'f', def: 0, min: -1, max: 1, step: 0.01 },
    ],
    // 以三層模糊金字塔插值近似逐像素變半徑,比逐像素捲積快得多
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H;
      const src = grayOf(ins, 0, ctx);
      if (p.amount <= 0.01) return { t: 'g', d: src.slice() };
      const ctrl = ins[1] ? grayOf(ins, 1, ctx) : null;
      const s = p.amount / 100 * W;
      const b1 = Filters.gaussBlur(src, W, H, s * 0.45);
      const b2 = Filters.gaussBlur(src, W, H, s);
      const d = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = Filters.clamp01((ctrl ? ctrl[i] : 0.5) + p.bias) * 2;   // 0..2 跨三層
        d[i] = t <= 1 ? src[i] + (b1[i] - src[i]) * t
                      : b1[i] + (b2[i] - b1[i]) * (t - 1);
      }
      return { t: 'g', d };
    }
  },

  invert: {
    title: 'Invert', zh: '反轉', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      for (let i = 0; i < N; i++) d[i] = 1 - src[i];
      return { t: 'g', d };
    }
  },

  blur: {
    title: 'Blur', zh: '模糊', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'mode', label: '模式', t: 'sel', def: 'gauss', opts: [['gauss', '高斯 Gaussian'], ['dir', '方向 Directional'], ['zoom', '放射 Radial Zoom'], ['spin', '旋轉 Radial Spin']] },
      { k: 'amount', label: '強度', t: 'f', def: 2, min: 0, max: 20, step: 0.05 },
      { k: 'angle', label: '方向°', t: 'f', def: 0, min: -180, max: 180, step: 1, show: p => p.mode === 'dir' },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, src = grayOf(ins, 0, ctx);
      if (p.amount <= 0.001) return { t: 'g', d: src.slice() };
      if (p.mode === 'gauss') {
        return { t: 'g', d: Filters.gaussBlur(src, W, H, p.amount / 100 * W) };
      }
      const d = new Float32Array(W * H), N = 24;
      if (p.mode === 'dir') {
        const a = p.angle * Math.PI / 180, len = p.amount / 100 * W;
        const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let s = 0;
          for (let i = 0; i < N; i++) {
            const f = i / (N - 1) - 0.5;
            s += Filters.sampleWrap(src, W, H, x + dx * f, y + dy * f);
          }
          d[y * W + x] = s / N;
        }
      } else if (p.mode === 'zoom') {
        const k = p.amount / 40;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
          let s = 0;
          for (let i = 0; i < N; i++) {
            const f = 1 - (i / (N - 1)) * k;
            s += Filters.sampleWrap(src, W, H, W / 2 + dx * f - 0.5, H / 2 + dy * f - 0.5);
          }
          d[y * W + x] = s / N;
        }
      } else { // spin
        const ang = p.amount / 20 * Math.PI * 0.5;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
          let s = 0;
          for (let i = 0; i < N; i++) {
            const a = (i / (N - 1) - 0.5) * ang;
            const c = Math.cos(a), sn = Math.sin(a);
            s += Filters.sampleWrap(src, W, H, W / 2 + dx * c - dy * sn - 0.5, H / 2 + dx * sn + dy * c - 0.5);
          }
          d[y * W + x] = s / N;
        }
      }
      return { t: 'g', d };
    }
  },

  bevel: {
    title: 'Bevel', zh: '斜角厚度', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'radius', label: '半徑', t: 'f', def: 4, min: 0.2, max: 20, step: 0.1 },
      { k: 'curve', label: '曲率', t: 'f', def: 1.2, min: 0.2, max: 5, step: 0.05 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const bl = Filters.gaussBlur(src, W, H, p.radius / 100 * W);
      for (let i = 0; i < N; i++) {
        const e = Math.pow(Filters.clamp01((bl[i] - 0.5) * 2), p.curve);
        d[i] = Math.min(src[i], e);
      }
      return { t: 'g', d };
    }
  },

  distance: {
    title: 'Distance', zh: '距離場', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'dist', label: '最大距離', t: 'f', def: 0.15, min: 0.01, max: 0.6, step: 0.005 },
      { k: 'curve', label: '衰減曲線', t: 'f', def: 1, min: 0.25, max: 4, step: 0.05 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const df = Filters.distanceField(src, W, H);
      const maxD = Math.max(1, p.dist * W);
      for (let i = 0; i < N; i++) {
        d[i] = Math.pow(Filters.clamp01(1 - df[i] / maxD), p.curve);
      }
      return { t: 'g', d };
    }
  },

  celShade: {
    title: 'Cel Shade', zh: '卡通打光', cat: 'adjust', inputs: [{ n: '高度場', t: 'g' }], out: 'g',
    params: [
      { k: 'tones', label: '階調數', t: 'i', def: 2, min: 2, max: 4 },
      { k: 'terminator', label: '終端線位置', t: 'f', def: 0.55, min: 0.05, max: 0.95, step: 0.01 },
      { k: 'lightAngle', label: '光源角度°', t: 'f', def: -115, min: -180, max: 180, step: 1 },
      { k: 'relief', label: '立體強度', t: 'f', def: 0.5, min: 0.05, max: 3, step: 0.01 },
      { k: 'shadowTone', label: '暗面亮度', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
      { k: 'litTone', label: '亮面亮度', t: 'f', def: 0.95, min: 0, max: 1, step: 0.01 },
      { k: 'edge', label: '終端線柔度', t: 'f', def: 0.05, min: 0.002, max: 0.4, step: 0.002 },
      { k: 'lightZ', label: '光源前傾', t: 'f', def: 0.58, min: 0.1, max: 2, step: 0.01 },
    ],
    // 高度場 → 梯度求法線 → N·L 硬切成 2~4 階平塗(卡通終端線)
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, out = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const la = p.lightAngle * Math.PI / 180;
      const Ln = Math.hypot(Math.cos(la), Math.sin(la), p.lightZ) || 1;
      const lx = Math.cos(la) / Ln, ly = Math.sin(la) / Ln, lz = p.lightZ / Ln;
      const s = p.relief * W * 0.35;   // 讓法線在球面上大幅變化,終端線才切得出來
      const aa = p.edge, tones = Math.max(2, p.tones | 0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h = src[i];
        if (h <= 0.004) { out[i] = 0; continue; }
        const xm = src[y * W + Filters.mod(x - 1, W)], xp = src[y * W + (x + 1) % W];
        const ym = src[Filters.mod(y - 1, H) * W + x], yp = src[((y + 1) % H) * W + x];
        const gx = (xp - xm) * 0.5 * s, gy = (yp - ym) * 0.5 * s;
        const nl = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1);
        let tone;
        if (tones === 2) {
          tone = p.shadowTone + (p.litTone - p.shadowTone) * Filters.sstep(p.terminator - aa, p.terminator + aa, nl);
        } else {
          // 多階:在終端線兩側再切,形成 3~4 階平塗
          const span = 0.42, step = span / (tones - 1);
          let acc = 0;
          for (let t = 0; t < tones - 1; t++) {
            const th = p.terminator - span * 0.5 + step * t;
            acc += Filters.sstep(th - aa, th + aa, nl);
          }
          tone = p.shadowTone + (p.litTone - p.shadowTone) * (acc / (tones - 1));
        }
        out[i] = tone * Math.min(1, h / 0.02);   // 輪廓邊緣抗鋸齒
      }
      return { t: 'g', d: out };
    }
  },

  posterize: {
    title: 'Posterize', zh: '色調分離', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'levels', label: '階調數', t: 'i', def: 3, min: 2, max: 24 },
      { k: 'soft', label: '階梯柔度', t: 'f', def: 0, min: 0, max: 1, step: 0.01 },
      { k: 'bias', label: '階調偏移', t: 'f', def: 0, min: -0.5, max: 0.5, step: 0.01 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const L = Math.max(2, p.levels | 0) - 1;
      for (let i = 0; i < N; i++) {
        const v = Filters.clamp01(src[i] + p.bias);
        const q = Math.round(v * L) / L;
        d[i] = q + (v - q) * p.soft;     // soft=0 完全平塗,=1 回到原圖
      }
      return { t: 'g', d };
    }
  },

  outline: {
    title: 'Outline', zh: '描邊', cat: 'adjust', inputs: [{ n: '輸入', t: 'g' }], out: 'g',
    params: [
      { k: 'width', label: '線寬', t: 'f', def: 0.02, min: 0.002, max: 0.12, step: 0.002 },
      { k: 'side', label: '位置', t: 'sel', def: 'outer', opts: [['outer', '外描邊'], ['inner', '內描邊'], ['both', '內外都要']] },
      { k: 'threshold', label: '形狀門檻', t: 'f', def: 0.5, min: 0.02, max: 0.98, step: 0.01 },
      { k: 'keepFill', label: '保留填色', t: 'b', def: false },
      { k: 'fillTone', label: '填色亮度', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01, show: p => p.keepFill },
    ],
    // 以距離場擴張/內縮取環帶 = 卡通描邊
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N);
      const src = grayOf(ins, 0, ctx);
      const mask = new Float32Array(N), inv = new Float32Array(N);
      for (let i = 0; i < N; i++) { const on = src[i] >= p.threshold ? 1 : 0; mask[i] = on; inv[i] = 1 - on; }
      const w = Math.max(1, p.width * W);
      const dOut = (p.side === 'outer' || p.side === 'both') ? Filters.distanceField(mask, W, H) : null;
      const dIn = (p.side === 'inner' || p.side === 'both') ? Filters.distanceField(inv, W, H) : null;
      for (let i = 0; i < N; i++) {
        let line = 0;
        if (dOut && mask[i] < 0.5 && dOut[i] > 0 && dOut[i] <= w) line = Math.min(1, (w - dOut[i] + 1) / 1.5);
        if (dIn && mask[i] >= 0.5 && dIn[i] > 0 && dIn[i] <= w) line = Math.max(line, Math.min(1, (w - dIn[i] + 1) / 1.5));
        d[i] = p.keepFill ? Math.max(line, mask[i] * p.fillTone) : line;
      }
      return { t: 'g', d };
    }
  },

  /* ==================== 上色 / 後製 ==================== */
  gradientMap: {
    title: 'Gradient Map', zh: '漸層對應', cat: 'color', inputs: [{ n: '輸入', t: 'g' }], out: 'c',
    params: [
      { k: 'preset', label: '色帶', t: 'sel', def: 'fire', opts: Object.entries(GRADS).map(([k, v]) => [k, v.zh]) },
      { k: 'steps', label: '色階數(0=平滑)', t: 'i', def: 0, min: 0, max: 8 },
      { k: 'alphaFromLuma', label: 'Alpha=亮度', t: 'b', def: true },
      { k: 'alphaGain', label: '輪廓銳利度', t: 'f', def: 1, min: 1, max: 10, step: 0.1, show: p => p.alphaFromLuma },
      { k: 'invert', label: '反轉輸入', t: 'b', def: false },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H, d = new Float32Array(N * 4);
      const src = grayOf(ins, 0, ctx);
      const stops = (GRADS[p.preset] || GRADS.fire).stops;
      const L = (p.steps | 0) >= 2 ? (p.steps | 0) - 1 : 0;
      for (let i = 0; i < N; i++) {
        let v = src[i];
        if (p.invert) v = 1 - v;
        if (L) v = Math.round(v * L) / L;   // 需要平塗時才量化
        const [r, g, b] = Filters.gradSample(stops, v);
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
        // 輪廓銳利度:讓剪影乾脆,但顏色仍走完整漸層(風格化的關鍵)
        d[i * 4 + 3] = p.alphaFromLuma ? Filters.clamp01(v * (p.alphaGain || 1)) : 1;
      }
      return { t: 'c', d };
    }
  },

  glow: {
    title: 'Glow', zh: '發光', cat: 'color', inputs: [{ n: '輸入', t: 'c' }], out: 'c',
    params: [
      { k: 'threshold', label: '發光門檻', t: 'f', def: 0.45, min: 0, max: 1, step: 0.005 },
      { k: 'radius', label: '光暈半徑', t: 'f', def: 5, min: 0.5, max: 20, step: 0.1 },
      { k: 'intensity', label: '強度', t: 'f', def: 1.2, min: 0, max: 4, step: 0.02 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, N = W * H;
      const cb = bufConvert(ins[0], 'c', ctx);
      const src = cb ? cb.d : new Float32Array(N * 4);
      // 擷取高亮 → 各通道模糊 → 疊加
      const ch = [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)];
      const inv = 1 / Math.max(1e-4, 1 - p.threshold);
      for (let i = 0; i < N; i++) {
        const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        const m = Math.max(0, luma - p.threshold) * inv;
        ch[0][i] = r * m; ch[1][i] = g * m; ch[2][i] = b * m; ch[3][i] = m;
      }
      const sigma = p.radius / 100 * W;
      const bl = ch.map(c => Filters.gaussBlur(c, W, H, sigma));
      const d = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        d[i * 4] = Filters.clamp01(src[i * 4] + bl[0][i] * p.intensity);
        d[i * 4 + 1] = Filters.clamp01(src[i * 4 + 1] + bl[1][i] * p.intensity);
        d[i * 4 + 2] = Filters.clamp01(src[i * 4 + 2] + bl[2][i] * p.intensity);
        d[i * 4 + 3] = Filters.clamp01(src[i * 4 + 3] + bl[3][i] * p.intensity);
      }
      return { t: 'c', d };
    }
  },

  output: {
    title: 'Output', zh: '輸出', cat: 'out', inputs: [{ n: '結果', t: 'any' }], out: 'any',
    params: [],
    eval(p, ins, ctx) {
      return ins[0] || { t: 'g', d: new Float32Array(ctx.W * ctx.H) };
    }
  },
};

// 類別中繼資料(節點庫分組 & 顏色)
const NodeCats = {
  gen:     { zh: '基礎圖形', color: 'var(--cat-gen)' },
  fx:      { zh: '特效生成', color: 'var(--cat-fx)' },
  noise:   { zh: '雜訊', color: 'var(--cat-noise)' },
  distort: { zh: '變形扭曲', color: 'var(--cat-distort)' },
  blend:   { zh: '混合', color: 'var(--cat-blend)' },
  adjust:  { zh: '調整', color: 'var(--cat-adjust)' },
  color:   { zh: '上色後製', color: 'var(--cat-color)' },
  out:     { zh: '輸出', color: 'var(--cat-out)' },
};
