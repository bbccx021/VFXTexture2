'use strict';
/* ============================================================
   filters.js — 影像濾鏡演算法核心
   所有貼圖以 Float32Array 表示:
     灰階 buffer: 長度 W*H,值域 [0,1]
     彩色 buffer: 長度 W*H*4 (RGBA),值域 [0,1]
   所有取樣皆採 wrap(重複)模式 → 天生無縫貼圖
   ============================================================ */

const Filters = (() => {

  // ---------- 基礎工具 ----------
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract = x => x - Math.floor(x);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10); // Perlin quintic
  const mod = (n, m) => ((n % m) + m) % m;

  // 32-bit 整數雜湊 → [0,1)
  function hashInt(x) {
    x = (x ^ 61) ^ (x >>> 16);
    x = (x + (x << 3)) | 0;
    x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d);
    x = x ^ (x >>> 15);
    return (x >>> 0) / 4294967296;
  }
  // 2D 座標 + 種子 → [0,1)
  function rnd2(x, y, seed) {
    return hashInt((x | 0) * 1597 + (y | 0) * 51749 + (seed | 0) * 7919 + 1013);
  }

  // 雙線性取樣(wrap),x/y 為像素座標
  function sampleWrap(d, W, H, x, y) {
    let x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    x0 = mod(x0, W); y0 = mod(y0, H);
    const x1 = (x0 + 1) % W, y1 = (y0 + 1) % H;
    const a = d[y0 * W + x0], b = d[y0 * W + x1];
    const c = d[y1 * W + x0], e = d[y1 * W + x1];
    return lerp(lerp(a, b, fx), lerp(c, e, fx), fy);
  }
  // 雙線性取樣(超出範圍回傳 0,用於非拼貼模式)
  function sampleZero(d, W, H, x, y) {
    if (x < -1 || y < -1 || x > W || y > H) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : d[yy * W + xx];
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), fx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx), fy);
  }

  // ---------- 週期性 Perlin 雜訊(無縫) ----------
  // u,v 以「格」為單位,per = 週期格數(整數 → 無縫拼貼)
  function perlinP(u, v, perX, perY, seed) {
    const xi = Math.floor(u), yi = Math.floor(v);
    const xf = u - xi, yf = v - yi;
    const uu = fade(xf), vv = fade(yf);
    const g = (ix, iy, dx, dy) => {
      const a = rnd2(mod(ix, perX), mod(iy, perY), seed) * 6.283185307;
      return Math.cos(a) * dx + Math.sin(a) * dy;
    };
    const n00 = g(xi, yi, xf, yf);
    const n10 = g(xi + 1, yi, xf - 1, yf);
    const n01 = g(xi, yi + 1, xf, yf - 1);
    const n11 = g(xi + 1, yi + 1, xf - 1, yf - 1);
    return lerp(lerp(n00, n10, uu), lerp(n01, n11, uu), vv) * 1.414; // ≈ [-1,1]
  }

  // fBm 分形疊加。mode: 'fbm' | 'billow' | 'ridged'
  function fbm(u, v, cells, octaves, gain, seed, m) {
    // flow(域扭曲):座標先被低頻雜訊推移,產生有機流動/漩渦感
    if (m === 'flow') {
      const wx = perlinP(u + 1.7, v + 9.2, cells, cells, seed + 2131);
      const wy = perlinP(u + 8.3, v + 2.8, cells, cells, seed + 3719);
      u += wx * 0.85; v += wy * 0.85;
    }
    let sum = 0, amp = 1, tot = 0, freq = 1;
    for (let o = 0; o < octaves; o++) {
      let n = perlinP(u * freq, v * freq, cells * freq, cells * freq, seed + o * 131);
      if (m === 'billow') n = Math.abs(n) * 2 - 1;
      else if (m === 'ridged') { n = 1 - Math.abs(n); n = n * n * 2 - 1; }
      else if (m === 'turb' || m === 'marble') n = Math.abs(n); // 累加絕對值:尖銳谷、圓潤峰
      sum += amp * n; tot += amp;
      amp *= gain; freq *= 2;
    }
    const r = sum / tot;
    if (m === 'turb') return clamp01(r);                                   // 0..1 湍流
    if (m === 'marble') { // 條紋被湍流扭曲;條紋數取整數以維持無縫平鋪
      const stripes = Math.max(1, Math.round(cells * 0.5));
      return clamp01(0.5 + 0.5 * Math.sin((u * stripes + r * 1.6) * 2 * Math.PI));
    }
    return clamp01(r * 0.5 + 0.5);                                          // fbm / billow / ridged / flow
  }

  // ---------- Voronoi / Cells(無縫) ----------
  // 回傳 {f1, f2, id}(距離以格為單位)
  function worley(u, v, cells, seed) {
    const xi = Math.floor(u), yi = Math.floor(v);
    let f1 = 1e9, f2 = 1e9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const wx = mod(cx, cells), wy = mod(cy, cells);
      const jx = rnd2(wx, wy, seed), jy = rnd2(wx, wy, seed + 777);
      const px = cx + jx, py = cy + jy;
      const d = Math.hypot(u - px, v - py);
      if (d < f1) { f2 = f1; f1 = d; id = rnd2(wx, wy, seed + 555); }
      else if (d < f2) f2 = d;
    }
    return { f1, f2, id };
  }

  // ---------- 圖形場函式(x,y ∈ [-1,1] 局部空間) ----------
  const edgeFn = (dist, e, soft) => clamp01((e - dist) / Math.max(soft, 1e-4));

  function shapeField(x, y, p) {
    const r = Math.hypot(x, y), sz = p.size;
    switch (p.type) {
      case 'disc': return edgeFn(r, sz, p.soft);
      case 'blob': return Math.pow(clamp01(1 - r / sz), p.falloff);
      case 'gauss': { const s = sz * 0.38; return Math.exp(-(r * r) / (2 * s * s)); }
      case 'poly': {
        const n = Math.max(3, p.sides | 0), seg = 6.283185307 / n;
        const a = Math.atan2(y, x);
        const dp = r * Math.cos(mod(a, seg) - seg / 2);
        return edgeFn(dp, sz * 0.82, p.soft);
      }
      case 'ring': return edgeFn(Math.abs(r - sz * 0.72), p.width * 0.5, p.soft);
      case 'square': return edgeFn(Math.max(Math.abs(x), Math.abs(y)), sz * 0.75, p.soft);
      case 'spike': {
        // 尖刺:底在 y=+sz,尖端在 y=-sz,寬度向尖端收斂
        if (y < -sz || y > sz) return 0;
        const t = (y + sz) / (2 * sz);           // 0=尖端 1=底部
        const hw = p.width * 0.5 * Math.pow(t, 0.8) * sz;
        const v = edgeFn(Math.abs(x), hw, p.soft * sz);
        return v * Math.pow(t, p.falloff * 0.3); // 往尖端漸淡
      }
    }
    return 0;
  }

  // 在目標 buffer 上蓋印一個實例(max 混合、wrap)
  // cx,cy ∈ [0,1] uv;sx,sy = 實例半徑(uv);rot = 弧度
  function stampInstance(dst, W, H, cx, cy, sx, sy, rot, p, intensity) {
    const rad = Math.max(sx, sy) * 1.05;
    const x0 = Math.floor((cx - rad) * W), x1 = Math.ceil((cx + rad) * W);
    const y0 = Math.floor((cy - rad) * H), y1 = Math.ceil((cy + rad) * H);
    const cr = Math.cos(-rot), sr = Math.sin(-rot);
    for (let py = y0; py <= y1; py++) {
      const wy = mod(py, H);
      for (let px = x0; px <= x1; px++) {
        const wx = mod(px, W);
        const dx = (px + 0.5) / W - cx, dy = (py + 0.5) / H - cy;
        const lx = (dx * cr - dy * sr) / sx, ly = (dx * sr + dy * cr) / sy;
        if (lx < -1 || lx > 1 || ly < -1 || ly > 1) continue;
        const v = shapeField(lx, ly, p) * intensity;
        const i = wy * W + wx;
        if (v > dst[i]) dst[i] = v;
      }
    }
  }

  // 蓋印一張灰階圖(供 Splatter 的 Pattern Image 輸入使用)
  // 圖像上緣(v=0)對應局部 -y 方向 → 旋轉後朝外
  function stampImage(dst, W, H, cx, cy, sx, sy, rot, src, sw, sh, intensity) {
    const rad = Math.hypot(sx, sy) * 1.02;
    const x0 = Math.floor((cx - rad) * W), x1 = Math.ceil((cx + rad) * W);
    const y0 = Math.floor((cy - rad) * H), y1 = Math.ceil((cy + rad) * H);
    const cr = Math.cos(-rot), sr = Math.sin(-rot);
    for (let py = y0; py <= y1; py++) {
      const wy = mod(py, H);
      for (let px = x0; px <= x1; px++) {
        const dx = (px + 0.5) / W - cx, dy = (py + 0.5) / H - cy;
        const lx = (dx * cr - dy * sr) / sx, ly = (dx * sr + dy * cr) / sy;
        if (lx < -1 || lx > 1 || ly < -1 || ly > 1) continue;
        const v = sampleZero(src, sw, sh, (lx + 1) * 0.5 * sw - 0.5, (ly + 1) * 0.5 * sh - 0.5) * intensity;
        const i = wy * W + mod(px, W);
        if (v > dst[i]) dst[i] = v;
      }
    }
  }

  // ---------- 距離場(兩趟 3-4 倒角距離變換,近似歐氏距離) ----------
  // 回傳每像素到最近白色(>0.5)像素的距離(px)
  function distanceField(src, W, H) {
    const INF = 1e9, d = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) d[i] = src[i] > 0.5 ? 0 : INF;
    // 正向掃描
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + 1.4);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + 1.4);
      }
      d[i] = v;
    }
    // 反向掃描
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + 1.4);
        if (x > 0) v = Math.min(v, d[i + W - 1] + 1.4);
      }
      d[i] = v;
    }
    return d;
  }

  // 平滑階梯(卡通終端線用):x < a → 0,x > b → 1,中間三次平滑
  function sstep(a, b, x) {
    const t = clamp01((x - a) / Math.max(1e-6, b - a));
    return t * t * (3 - 2 * t);
  }
  // 多項式平滑最大值:球體聯集時谷地圓滑,不產生尖銳摺痕(卡通團塊核心)
  function smax(a, b, k) {
    if (k <= 1e-6) return Math.max(a, b);
    const h = clamp01(0.5 + 0.5 * (b - a) / k);
    return a * (1 - h) + b * h + k * h * (1 - h);
  }

  // ---------- 斜率模糊 Slope Blur ----------
  // 沿斜率圖的梯度方向反覆位移取樣:max=擴張生長、min=侵蝕、blur=融化拖絲
  // intensity 為視覺上與解析度無關的位移量(0..10)
  function slopeBlur(src, slope, W, H, samples, intensity, mode) {
    const N = W * H;
    // 預計算梯度場(中央差分)
    const gx = new Float32Array(N), gy = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      gx[i] = (slope[y * W + (x + 1) % W] - slope[y * W + mod(x - 1, W)]) * 0.5;
      gy[i] = (slope[((y + 1) % H) * W + x] - slope[mod(y - 1, H) * W + x]) * 0.5;
    }
    const out = new Float32Array(N);
    const k = intensity * W * W / (88 * samples); // 每步位移 = 梯度 × k
    const isMax = mode === 'max', isMin = mode === 'min';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let px = x, py = y;
      let acc = src[y * W + x];
      let sum = acc;
      for (let s = 0; s < samples; s++) {
        const gi = mod(Math.round(py), H) * W + mod(Math.round(px), W);
        px += gx[gi] * k;
        py += gy[gi] * k;
        const v = sampleWrap(src, W, H, px, py);
        if (isMax) { if (v > acc) acc = v; }
        else if (isMin) { if (v < acc) acc = v; }
        else sum += v;
      }
      out[y * W + x] = (isMax || isMin) ? acc : sum / (samples + 1);
    }
    return out;
  }

  // ---------- 多向扭曲 Multi-Directional Warp ----------
  // 沿 N 個等分方向各取樣一次,再以 min/max/平均合成。
  // Max 會把亮部往外拉成拖絲,Min 會把暗部吃進來收縮 — 風格化煙霧的核心手法
  function multiWarp(src, slope, W, H, dirs, angleDeg, intensity, mode) {
    const N = W * H, out = new Float32Array(N);
    const k = intensity * W / 24;
    const a0 = angleDeg * Math.PI / 180, n = Math.max(1, dirs | 0);
    const vx = new Float32Array(n), vy = new Float32Array(n);
    for (let d = 0; d < n; d++) {
      const a = a0 + d * 6.283185307 / n;
      vx[d] = Math.cos(a); vy[d] = Math.sin(a);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, s = slope[i] * k;
      let acc = mode === 'min' ? Infinity : mode === 'max' ? -Infinity : 0;
      for (let d = 0; d < n; d++) {
        const v = sampleWrap(src, W, H, x + vx[d] * s, y + vy[d] * s);
        if (mode === 'min') { if (v < acc) acc = v; }
        else if (mode === 'max') { if (v > acc) acc = v; }
        else acc += v;
      }
      out[i] = mode === 'avg' ? acc / n : acc;
    }
    return out;
  }

  // ---------- 自動色階:把實際最小/最大值拉伸到 0..1 ----------
  function autoLevels(src, N) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const out = new Float32Array(N), span = Math.max(1e-5, hi - lo);
    for (let i = 0; i < N; i++) out[i] = (src[i] - lo) / span;
    return out;
  }

  // ---------- 可分離高斯模糊(wrap) ----------
  function gaussBlur(src, W, H, sigma) {
    if (sigma < 0.3) return src.slice();
    // 大半徑時先降採樣再模糊(金字塔加速,誤差視覺上可忽略)
    if (sigma > 8 && W % 2 === 0 && H % 2 === 0) {
      const hw = W >> 1, hh = H >> 1;
      const half = new Float32Array(hw * hh);
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
        const i = (y * 2) * W + x * 2;
        half[y * hw + x] = (src[i] + src[i + 1] + src[i + W] + src[i + W + 1]) * 0.25;
      }
      const bl = gaussBlur(half, hw, hh, sigma / 2);
      const out = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        out[y * W + x] = sampleWrap(bl, hw, hh, (x - 0.5) / 2, (y - 0.5) / 2);
      }
      return out;
    }
    const R = Math.min(Math.ceil(sigma * 3), Math.floor(Math.min(W, H) / 2));
    const k = new Float32Array(R * 2 + 1);
    let ksum = 0;
    for (let i = -R; i <= R; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + R] = w; ksum += w; }
    for (let i = 0; i < k.length; i++) k[i] /= ksum;
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let i = -R; i <= R; i++) s += src[row + mod(x + i, W)] * k[i + R];
        tmp[row + x] = s;
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        let s = 0;
        for (let i = -R; i <= R; i++) s += tmp[mod(y + i, H) * W + x] * k[i + R];
        out[y * W + x] = s;
      }
    }
    return out;
  }

  // ---------- 漸層色帶 ----------
  // stops: [pos, r, g, b] 已排序;t ∈ [0,1] → [r,g,b]
  function gradSample(stops, t) {
    if (t <= stops[0][0]) { const s = stops[0]; return [s[1], s[2], s[3]]; }
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
      }
    }
    const s = stops[stops.length - 1]; return [s[1], s[2], s[3]];
  }

  // 序列亂數(xorshift32):線段生成需要「依呼叫順序」的穩定亂數流,rnd2 做不到
  // seed 先乘 Knuth 常數並暖機兩輪 — 否則小 seed 的第一個輸出幾乎相同(混合不足)
  function seqRNG(seed) {
    let s = ((seed * 2654435761) >>> 0) || 1;
    const next = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    next(); next();
    return next;
  }

  // 點到線段距離(uv 空間)
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const L2 = vx * vx + vy * vy;
    let t = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 中點位移碎形路徑:多尺度鋸齒,比均勻折線自然(移植自 NoiseGenerator Bolt)
  function fractalPath(rand, x0, y0, x1, y1, levels, jag) {
    let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
    for (let l = 0; l < levels; l++) {
      const np = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const disp = (rand() - 0.5) * jag * len * 2;
        np.push({ x: mx - dy / len * disp, y: my + dx / len * disp });
        np.push(b);
      }
      pts = np;
    }
    return pts;
  }

  // 線段集光柵化:逐列分桶 + 三層輝光(白熱核心/中暈/寬柔暈)
  // segs: [{ax,ay,bx,by,w,b}](uv 空間);glow 縮放外圈兩層的比重
  function rasterSegs(segs, W, H, glow) {
    let wMax = 0;
    for (const sg of segs) if (sg.w > wMax) wMax = sg.w;
    const margin = wMax * 26;
    const rowSegs = Array.from({ length: H }, () => []);
    for (let si = 0; si < segs.length; si++) {
      const sg = segs[si];
      const y0 = Math.max(0, Math.floor((Math.min(sg.ay, sg.by) - margin) * H));
      const y1 = Math.min(H - 1, Math.ceil((Math.max(sg.ay, sg.by) + margin) * H));
      for (let j = y0; j <= y1; j++) rowSegs[j].push(si);
    }
    const out = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      const py = (j + 0.5) / H;
      const list = rowSegs[j];
      for (let i = 0; i < W; i++) {
        const px = (i + 0.5) / W;
        let v = 0;
        for (let s = 0; s < list.length; s++) {
          const sg = segs[list[s]];
          const d = segDist(px, py, sg.ax, sg.ay, sg.bx, sg.by);
          if (d > sg.w * 24) continue;
          const q = d / sg.w;
          v += sg.b * (Math.exp(-q * q) + (Math.exp(-q * q / 12) * 0.28 + Math.exp(-q * q / 120) * 0.08) * glow);
        }
        if (v > 1) v = 1;
        out[j * W + i] = v;
      }
    }
    return out;
  }

  return {
    clamp01, clamp, lerp, fract, mod, rnd2, hashInt,
    sampleWrap, sampleZero, perlinP, fbm, worley,
    shapeField, stampInstance, stampImage, distanceField, slopeBlur,
    multiWarp, autoLevels, gaussBlur, gradSample, edgeFn, sstep, smax,
    seqRNG, segDist, fractalPath, rasterSegs
  };
})();
