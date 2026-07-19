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
      { k: 'soft', label: '邊緣柔化', t: 'f', def: 0.06, min: 0.002, max: 1, step: 0.002 },
      { k: 'falloff', label: '衰減曲線', t: 'f', def: 1.6, min: 0.2, max: 6, step: 0.05, show: p => p.type === 'blob' || p.type === 'spike' },
      { k: 'sides', label: '邊數', t: 'i', def: 5, min: 3, max: 12, show: p => p.type === 'poly' },
      { k: 'width', label: '寬度', t: 'f', def: 0.18, min: 0.01, max: 1, step: 0.005, show: p => p.type === 'ring' || p.type === 'spike' },
      { k: 'rot', label: '旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
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
      { k: 'rotOff', label: '整體旋轉°', t: 'f', def: 0, min: -180, max: 180, step: 1 },
      { k: 'seed', label: '種子', t: 'seed', def: 7 },
    ],
    eval(p, ins, ctx) {
      const { W, H } = ctx, d = new Float32Array(W * H);
      const img = ins[0] ? grayOf(ins, 0, ctx) : null; // Pattern Image 輸入
      const base = p.rotOff * Math.PI / 180;
      for (let i = 0; i < p.count; i++) {
        const r1 = Filters.rnd2(i, 3, p.seed), r2 = Filters.rnd2(i, 17, p.seed + 41);
        const r3 = Filters.rnd2(i, 29, p.seed + 83);
        const a = base + (i / p.count) * 6.283185 + (r1 - 0.5) * p.angJitter * (6.283185 / p.count);
        const rad = p.radius * (1 + (r2 - 0.5) * 2 * p.radJitter);
        const sz = p.size * (1 - p.sizeRand * r3);
        if (sz < 0.002) continue;
        const cx = 0.5 + Math.cos(a) * rad, cy = 0.5 + Math.sin(a) * rad;
        // 尖刺/光條/輸入圖案 沿徑向朝外(圖像上緣朝外)
        if (img) {
          Filters.stampImage(d, W, H, cx, cy, sz * p.width, sz, a + Math.PI / 2, img, W, H, 1);
        } else {
          const isStreak = p.pattern === 'streak';
          const sp = { type: isStreak ? 'blob' : p.pattern, size: 1, soft: 0.04, falloff: isStreak ? 2.2 : 1.6, width: 0.9, sides: 5 };
          Filters.stampInstance(d, W, H, cx, cy, sz * p.width, sz, a + Math.PI / 2, sp, 1);
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
      { k: 'levels', label: '階調數', t: 'i', def: 3, min: 2, max: 10 },
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
        if (L) v = Math.round(v * L) / L;   // 平塗卡通色階
        const [r, g, b] = Filters.gradSample(stops, v);
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
        d[i * 4 + 3] = p.alphaFromLuma ? v : 1;
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
  noise:   { zh: '雜訊', color: 'var(--cat-noise)' },
  distort: { zh: '變形扭曲', color: 'var(--cat-distort)' },
  blend:   { zh: '混合', color: 'var(--cat-blend)' },
  adjust:  { zh: '調整', color: 'var(--cat-adjust)' },
  color:   { zh: '上色後製', color: 'var(--cat-color)' },
  out:     { zh: '輸出', color: 'var(--cat-out)' },
};
