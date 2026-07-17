'use strict';
/* ============================================================
   ui.js — 介面控制:節點庫 / 參數面板 / 預覽 / 匯出 / 存讀檔 / 範本牆
   全域中介者 App:graph 持有者 + 重繪排程
   ============================================================ */

const App = {
  graph: new NodeGraph(),
  onGraphChanged() { UI.requestRender(); },
  onSelect(node) { UI.showParams(node); UI.requestRender(); },
  // ---------- 復原 / 重做(快照式,上限 60 步) ----------
  history: {
    undoStack: [], redoStack: [], LIMIT: 60,
    capture() { return JSON.stringify(App.graph.serialize()); },
    commit(snap) {
      this.undoStack.push(snap);
      if (this.undoStack.length > this.LIMIT) this.undoStack.shift();
      this.redoStack.length = 0;
    },
    push() { this.commit(this.capture()); }, // 在「變更前」呼叫
    restore(json) {
      App.graph = NodeGraph.deserialize(JSON.parse(json));
      Editor.select(null);
      Editor.rebuild();
      UI.requestRender();
    },
    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this.capture());
      this.restore(this.undoStack.pop());
    },
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this.capture());
      this.restore(this.redoStack.pop());
    },
  },
};

const UI = (() => {
  let previewCv, previewCtx, perfEl;
  let pending = false;
  let previewPinned = false;   // 📌 鎖定預覽顯示 Output
  let autosaveTimer = null;
  let previewTex = null;       // 目前輸出貼圖(512 離屏 canvas,供動畫變換)
  let animRAF = 0, animT0 = 0; // 動態預覽 requestAnimationFrame

  // 進階參數(預設摺疊);未列出的節點所有參數皆為關鍵參數
  const ADV = {
    shape: ['rot', 'falloff'],
    ramp: ['curve', 'mirror'],
    tileSampler: ['sizeRand', 'rotRand', 'briRand', 'coverage', 'maskThreshold', 'maskInvert'],
    splatterCircular: ['width', 'sizeRand', 'angJitter', 'radJitter', 'rotOff'],
    shapeMapper: ['phase', 'flip'],
    perlin: ['gain'],
    cells: ['contrast'],
    crossSection: ['curve', 'repeat'],
    slopeBlur: ['samples'],
    transform: ['tiling'],
    levels: ['outLo', 'outHi'],
    distance: ['curve'],
    gradientMap: ['alphaFromLuma', 'invert'],
  };
  const advOpen = new Set(); // 記住哪些節點型別的進階區是展開的

  // ---------- 介面主題(配色)----------
  const THEMES = {
    teal:    { zh: '深海青', v: { '--bg': '#08100f', '--panel': '#0e1a18', '--panel-2': '#142523', '--line': '#1e332f', '--line-soft': '#172824', '--text': '#d6ece8', '--text-dim': '#7d9c96', '--text-faint': '#4a625d', '--acc': '#17c3a6', '--acc-2': '#34e0c0', '--acc-soft': '#17c3a633', '--on-acc': '#04120e', '--cy': '#ffcc55' } },
    indigo:  { zh: '皇家藍', v: { '--bg': '#090b14', '--panel': '#10131f', '--panel-2': '#171b2b', '--line': '#232842', '--line-soft': '#191d31', '--text': '#dbe0f0', '--text-dim': '#808aad', '--text-faint': '#4c5476', '--acc': '#4d7cff', '--acc-2': '#6f97ff', '--acc-soft': '#4d7cff33', '--on-acc': '#ffffff', '--cy': '#43e0d0' } },
    emerald: { zh: '翡翠綠', v: { '--bg': '#08110c', '--panel': '#0e1a12', '--panel-2': '#14251a', '--line': '#1f3527', '--line-soft': '#17281d', '--text': '#dcefe0', '--text-dim': '#82a08c', '--text-faint': '#4d6656', '--acc': '#24c26a', '--acc-2': '#43e08a', '--acc-soft': '#24c26a33', '--on-acc': '#04160c', '--cy': '#f0c04a' } },
    violet:  { zh: '電馭紫', v: { '--bg': '#0b0c12', '--panel': '#13141d', '--panel-2': '#191b26', '--line': '#262a38', '--line-soft': '#1d2130', '--text': '#d9dcea', '--text-dim': '#838aa0', '--text-faint': '#4e5468', '--acc': '#9d5bff', '--acc-2': '#b47dff', '--acc-soft': '#9d5bff33', '--on-acc': '#ffffff', '--cy': '#3fd8e2' } },
    crimson: { zh: '暗血紅', v: { '--bg': '#0c0a0b', '--panel': '#16110f', '--panel-2': '#1e1715', '--line': '#2f2320', '--line-soft': '#241b18', '--text': '#ecdedb', '--text-dim': '#9a867f', '--text-faint': '#5f4e49', '--acc': '#d62236', '--acc-2': '#f0384c', '--acc-soft': '#d6223633', '--on-acc': '#ffffff', '--cy': '#e6a23f' } },
    magenta: { zh: '烈焰洋紅', v: { '--bg': '#0d0b0f', '--panel': '#17131a', '--panel-2': '#1e1922', '--line': '#302632', '--line-soft': '#241d28', '--text': '#ecdce6', '--text-dim': '#9a8592', '--text-faint': '#5f4e5a', '--acc': '#ff2e63', '--acc-2': '#ff5c85', '--acc-soft': '#ff2e6333', '--on-acc': '#ffffff', '--cy': '#3fd8e2' } },
    ember:   { zh: '熔爐橘', v: { '--bg': '#0b0d10', '--panel': '#14110d', '--panel-2': '#1c1811', '--line': '#2a2318', '--line-soft': '#1f1a12', '--text': '#e6ded0', '--text-dim': '#97897a', '--text-faint': '#574d40', '--acc': '#ff7a1a', '--acc-2': '#ff9440', '--acc-soft': '#ff7a1a33', '--on-acc': '#140a02', '--cy': '#3fd8e2' } },
  };
  function applyTheme(name) {
    const t = THEMES[name] || THEMES.teal;
    const s = document.documentElement.style;
    for (const [k, v] of Object.entries(t.v)) s.setProperty(k, v);
    try { localStorage.setItem('texforge_theme', name); } catch (e) {}
    const sel = document.getElementById('theme-select');
    if (sel && sel.value !== name) sel.value = name;
  }
  function initTheme() {
    let saved = 'teal';
    try { saved = localStorage.getItem('texforge_theme') || 'teal'; } catch (e) {}
    if (!THEMES[saved]) saved = 'teal';
    applyTheme(saved);
    const sel = document.getElementById('theme-select');
    if (sel) sel.addEventListener('change', e => applyTheme(e.target.value));
  }

  // ---------- buffer → canvas ----------
  function bufToCanvas(buf, W) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = W;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, W);
    const px = img.data, N = W * W;
    if (!buf) { ctx.putImageData(img, 0, 0); return cv; }
    if (buf.t === 'g') {
      for (let i = 0; i < N; i++) {
        const v = Math.round(Filters.clamp01(buf.d[i]) * 255);
        px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < N; i++) {
        px[i * 4] = Math.round(Filters.clamp01(buf.d[i * 4]) * 255);
        px[i * 4 + 1] = Math.round(Filters.clamp01(buf.d[i * 4 + 1]) * 255);
        px[i * 4 + 2] = Math.round(Filters.clamp01(buf.d[i * 4 + 2]) * 255);
        px[i * 4 + 3] = Math.round(Filters.clamp01(buf.d[i * 4 + 3]) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ---------- 重繪排程 ----------
  function requestRender() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; renderAll(); }, 16);
  }

  function renderAll() {
    const t0 = performance.now();
    const res = +document.getElementById('preview-res').value;
    for (const node of App.graph.nodes.values()) {
      const buf = App.graph.evaluate(node.id, res);
      paintThumb(node, buf, res);
    }
    paintPreview(res);
    const ms = performance.now() - t0;
    perfEl.textContent = `⏱ ${ms.toFixed(0)} ms · ${App.graph.nodes.size} 節點 · ${res}²`;
    scheduleAutosave();
  }

  // ---------- 自動存檔(localStorage,防手滑) ----------
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem('texforge_autosave', JSON.stringify(App.graph.serialize())); } catch (e) { /* 空間滿時靜默略過 */ }
    }, 800);
  }
  function loadAutosave() {
    try {
      const s = localStorage.getItem('texforge_autosave');
      const g = s ? NodeGraph.deserialize(JSON.parse(s)) : null;
      return g && g.nodes.size ? g : null;
    } catch (e) { return null; }
  }

  function paintThumb(node, buf, res) {
    if (!node._thumb || !node._thumb.isConnected) return;
    const ctx = node._thumb.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(bufToCanvas(buf, res), 0, 0, 96, 96);
  }

  // ---------- 動態預覽:依特效類型自動選動畫 ----------
  const ANIM_BY_CAT = { hit: 'burst', trail: 'scroll', energy: 'flicker', light: 'twinkle', ringcat: 'spin', element: 'pulse', surface: 'pulse' };
  const ANIM_OVERRIDE = {
    fire: 'flicker', fireball: 'flicker', plasma: 'flicker', muzzle: 'flicker', lightning: 'flicker',
    projectile: 'scroll', trail: 'scroll', stylizedTrail: 'scroll', pattern: 'scroll', smoke: 'scroll',
    magic: 'spin', portal: 'spin',
    impact: 'burst', burst: 'burst', circleImpact: 'burst', ring: 'burst', firework: 'burst', slash: 'burst', groundSlash: 'burst',
    sparkle: 'twinkle', lens: 'twinkle', bokeh: 'twinkle',
    cracks: 'pulse', groundCrack: 'pulse', water: 'pulse', frost: 'pulse', toxic: 'pulse',
  };
  function animModeFor(name) {
    if (ANIM_OVERRIDE[name]) return ANIM_OVERRIDE[name];
    const m = name && Presets.meta[name];
    return (m && ANIM_BY_CAT[m.cat]) || 'pulse';
  }
  function currentAnimMode() {
    const sel = document.getElementById('preview-anim-mode');
    const v = sel ? sel.value : 'auto';
    return v === 'auto' ? animModeFor(App.graph._presetName) : v;
  }

  function drawPreviewBg() {
    const bg = document.getElementById('preview-bg').value;
    if (bg === 'checker') {
      const s = 24;
      for (let y = 0; y < 512 / s; y++) for (let x = 0; x < 512 / s; x++) {
        previewCtx.fillStyle = (x + y) % 2 ? '#2b313a' : '#3a424d';
        previewCtx.fillRect(x * s, y * s, s, s);
      }
    } else {
      previewCtx.fillStyle = bg === 'dark' ? '#20242b' : '#000';
      previewCtx.fillRect(0, 0, 512, 512);
    }
  }
  // 以中心為基準畫 previewTex
  function blit(scale, alpha, rot, dx, dy) {
    const c = previewCtx;
    c.save();
    c.globalAlpha = Filters.clamp01(alpha);
    c.translate(256 + (dx || 0), 256 + (dy || 0));
    if (rot) c.rotate(rot);
    c.scale(scale, scale);
    c.drawImage(previewTex, -256, -256);
    c.restore();
  }

  function drawPreviewFrame(t) {
    if (!previewTex) { previewCtx.clearRect(0, 0, 512, 512); return; }
    const c = previewCtx;
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, 512, 512);
    drawPreviewBg();
    c.imageSmoothingEnabled = true;

    // 無縫檢查:靜態 2×2,不套動畫
    if (document.getElementById('preview-tile').checked) {
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++)
        c.drawImage(previewTex, tx * 256, ty * 256, 256, 256);
      return;
    }
    const animEl = document.getElementById('preview-anim');
    if (animEl && !animEl.checked) { c.drawImage(previewTex, 0, 0); return; }

    const mode = currentAnimMode();
    if (mode === 'pulse') {
      blit(1 + 0.03 * Math.sin(t * 2.2), 1, 0, 0, 0);
      c.globalCompositeOperation = 'lighter';
      blit(1.06 + 0.05 * Math.sin(t * 2.2 + 0.8), 0.28 + 0.12 * Math.sin(t * 3), 0, 0, 0);
      c.globalCompositeOperation = 'source-over';
    } else if (mode === 'flicker') {
      const f = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3));
      const jit = Math.sin(t * 9) * 2;
      blit(1 + 0.02 * Math.sin(t * 3), f, 0, 0, jit);
      c.globalCompositeOperation = 'lighter';
      blit(1.04, 0.22 * f, 0, 0, jit);
      c.globalCompositeOperation = 'source-over';
    } else if (mode === 'scroll') {
      const off = (t * 80) % 512;
      c.globalAlpha = 1;
      c.drawImage(previewTex, -off, 0);
      c.drawImage(previewTex, 512 - off, 0);
    } else if (mode === 'spin') {
      blit(1, 1, t * 0.6, 0, 0);
      c.globalCompositeOperation = 'lighter';
      blit(1.02, 0.24, -t * 0.3, 0, 0);
      c.globalCompositeOperation = 'source-over';
    } else if (mode === 'burst') {
      const T = 1.5, p = (t % T) / T;
      const s = 0.72 + p * 0.5;
      const a = p < 0.12 ? p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.88);
      c.globalCompositeOperation = 'lighter';
      blit(s, a, 0, 0, 0);
      c.globalCompositeOperation = 'source-over';
    } else if (mode === 'twinkle') {
      const tw = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(t * 4), 2);
      blit(0.94 + 0.08 * tw, tw, 0, 0, 0);
      c.globalCompositeOperation = 'lighter';
      blit(1.1, 0.3 * tw, t * 0.15, 0, 0);
      c.globalCompositeOperation = 'source-over';
    } else {
      c.drawImage(previewTex, 0, 0);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function ensureAnimLoop() {
    const on = previewTex &&
      document.getElementById('preview-anim') && document.getElementById('preview-anim').checked &&
      !document.getElementById('preview-tile').checked;
    if (on && !animRAF) {
      animT0 = performance.now();
      const tick = () => { drawPreviewFrame((performance.now() - animT0) / 1000); animRAF = requestAnimationFrame(tick); };
      animRAF = requestAnimationFrame(tick);
    } else if (!on && animRAF) {
      cancelAnimationFrame(animRAF); animRAF = 0;
      drawPreviewFrame(0); // 收尾畫一張靜態
    }
  }

  function paintPreview(res) {
    const node = (previewPinned ? App.graph.findByType('output') : Editor.selectedNode())
      || App.graph.findByType('output') || Editor.selectedNode();
    const srcLabel = document.getElementById('preview-src');
    if (!node) { previewTex = null; drawPreviewFrame(0); srcLabel.textContent = ''; ensureAnimLoop(); return; }
    srcLabel.textContent = NodeDefs[node.type].title + (previewPinned ? ' 🔒' : '');
    const buf = App.graph.evaluate(node.id, res);
    if (!previewTex) { previewTex = document.createElement('canvas'); previewTex.width = 512; previewTex.height = 512; }
    const ptx = previewTex.getContext('2d');
    ptx.clearRect(0, 0, 512, 512);
    ptx.imageSmoothingEnabled = true;
    ptx.drawImage(bufToCanvas(buf, res), 0, 0, 512, 512);
    drawPreviewFrame(animRAF ? (performance.now() - animT0) / 1000 : 0);
    ensureAnimLoop();
  }

  // ---------- 節點庫(縮圖 / 搜尋 / 摺疊 / 拖放) ----------

  // 每個節點一行中文說明(hover 時顯示在狀態列)
  const DESC = {
    shape: '產生圓、多邊形、環、尖刺等基礎圖形',
    ramp: '線性漸層 — 拖尾淡出、方向遮罩必備',
    tileSampler: '網格陣列散佈圖案,大小/位置可隨機',
    splatterCircular: '沿圓環散佈圖案,可接自訂圖案輸入',
    shapeMapper: '把輸入圖案繞成環形陣列(魔法陣)',
    perlin: '自然平滑的分形雜訊,扭曲的標準驅動源',
    cells: 'Voronoi 細胞雜訊 — 晶格、裂縫、色塊',
    warp: '用強度圖梯度推擠影像(火焰/閃電核心)',
    slopeBlur: '沿斜率圖梯度反覆位移取樣 — 裂縫擴張、侵蝕、融化',
    swirl: '以中心為軸螺旋扭曲(火舌、氣流)',
    crossSection: '從灰階提取等高線亮帶(閃電/拖尾)',
    transform: '縮放/旋轉/平移,可關閉拼貼',
    blend: '雙圖混合 — 減去挖空、取亮疊加、增值遮罩',
    histogramScan: '把柔和漸層掃成高對比硬邊輪廓',
    levels: '色階 — 黑白點與 Gamma 重新映射',
    invert: '反轉灰階',
    blur: '高斯/方向/放射/旋轉模糊',
    bevel: '為扁平圖形加內斜角假厚度',
    distance: '距離場 — 搭配掃描把尖角變圓潤',
    gradientMap: '灰階對應色帶上色(火/電/毒…)',
    glow: '模擬遊戲引擎 Bloom 發光',
    output: '最終輸出節點,匯出以此為準',
  };
  // 縮圖示範輸入(依節點特性挑選,讓效果一眼可辨)
  const DEMO_IN = {
    swirl: ['stripes'], transform: ['stripes'], blur: ['stripes'],
    warp: ['stripes', 'perlin'], blend: ['stripes', 'blob'],
    slopeBlur: ['stripes', 'perlin'],
    histogramScan: ['perlin'], crossSection: ['perlin'],
    levels: ['perlin'], gradientMap: ['perlin'], shapeMapper: ['spike'],
    distance: ['spike'], bevel: ['disc'],
  };
  // 縮圖示範參數覆寫(預設值看不出效果的節點)
  const DEMO_PARAMS = {
    transform: { rot: 25, sx: 0.75, sy: 0.75 },
    levels: { gamma: 2.6 },
    blur: { amount: 4 },
    bevel: { radius: 10, curve: 1.4 },
    shapeMapper: { count: 10, r0: 0.3, r1: 0.8 },
    tileSampler: { size: 1.15, briRand: 0.5 },
  };
  const demoCache = {};
  function demoBuf(kind, R) {
    const key = kind + R;
    if (demoCache[key]) return demoCache[key];
    const d = new Float32Array(R * R);
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const ux = (x + 0.5) / R * 2 - 1, uy = (y + 0.5) / R * 2 - 1;
      let v = 0;
      if (kind === 'blob') v = Math.pow(Filters.clamp01(1 - Math.hypot(ux, uy) / 0.85), 1.5);
      else if (kind === 'stripes') v = 0.5 - 0.5 * Math.cos((x + 0.5) / R * Math.PI * 6);
      else if (kind === 'perlin') v = Filters.fbm((x + 0.5) / R * 3, (y + 0.5) / R * 3, 3, 3, 0.5, 7, 'fbm');
      else if (kind === 'spike') v = Filters.shapeField(ux, uy, { type: 'spike', size: 0.85, width: 0.55, soft: 0.05, falloff: 1.5 });
      else if (kind === 'disc') v = Filters.edgeFn(Math.hypot(ux, uy), 0.72, 0.03);
      d[y * R + x] = v;
    }
    demoCache[key] = d;
    return d;
  }

  // 用節點自己的演算法渲染 96² 縮圖(統一灰階呈現;彩色輸出取亮度)
  function renderLibThumb(canvas, type) {
    const R = 96, ctx = { W: R, H: R };
    const def = NodeDefs[type];
    const params = {};
    def.params.forEach(p => { params[p.k] = p.def; });
    Object.assign(params, DEMO_PARAMS[type] || {});
    const kinds = DEMO_IN[type] || [];
    const ins = def.inputs.map((inp, i) => {
      const b = { t: 'g', d: demoBuf(kinds[i] || (i === 0 ? 'blob' : 'perlin'), R) };
      return bufConvert(b, inp.t === 'any' ? 'g' : inp.t, ctx);
    });
    let buf;
    try { buf = def.eval(params, ins, ctx); }
    catch (err) { buf = { t: 'g', d: new Float32Array(R * R) }; }
    const c2 = canvas.getContext('2d');
    const img = c2.createImageData(R, R);
    const px = img.data;
    const c8 = x => x < 0 ? 0 : x > 1 ? 255 : Math.round(x * 255);
    for (let i = 0; i < R * R; i++) {
      let v;
      if (buf.t === 'c') {
        const a = Filters.clamp01(buf.d[i * 4 + 3]);
        v = (buf.d[i * 4] * 0.299 + buf.d[i * 4 + 1] * 0.587 + buf.d[i * 4 + 2] * 0.114) * a;
      } else {
        v = buf.d[i];
      }
      const g8 = c8(v);
      px[i * 4] = g8; px[i * 4 + 1] = g8; px[i * 4 + 2] = g8; px[i * 4 + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
  }

  function addNodeAt(type, wx, wy, jitter) {
    App.history.push();
    const j = jitter ? () => (Math.random() - 0.5) * 60 : () => 0;
    const node = App.graph.addNode(type, wx - 75 + j(), wy - 66 + j());
    Editor.rebuild();
    Editor.select({ kind: 'node', id: node.id });
    App.onGraphChanged();
  }

  function buildLibrary() {
    const wrap = document.getElementById('lib-list');
    const defaultHint = document.getElementById('hint').textContent;
    const byCat = {};
    for (const [type, def] of Object.entries(NodeDefs)) {
      (byCat[def.cat] = byCat[def.cat] || []).push([type, def]);
    }
    let html = '<input class="lib-search" id="lib-search" type="text" placeholder="🔍 搜尋節點…">';
    for (const [cat, meta] of Object.entries(NodeCats)) {
      if (!byCat[cat]) continue;
      html += `<div class="lib-group" data-cat="${cat}">
        <div class="lib-cat"><span class="tri">▾</span>${meta.zh}<span class="cnt">${byCat[cat].length}</span></div>`;
      for (const [type, def] of byCat[cat]) {
        html += `<div class="lib-item" data-type="${type}" data-search="${(def.title + ' ' + def.zh).toLowerCase()}"
          style="--nc:${meta.color}">
          <canvas class="lib-thumb" width="96" height="96"></canvas>
          <div class="lib-txt"><span class="nm">${def.title}</span><span class="zh">${def.zh}</span></div>
        </div>`;
      }
      html += '</div>';
    }
    wrap.innerHTML = html;

    // 縮圖分批渲染(不卡啟動)
    const items = [...wrap.querySelectorAll('.lib-item')];
    let ti = 0;
    const step = () => {
      if (ti >= items.length) return;
      const el = items[ti++];
      renderLibThumb(el.querySelector('.lib-thumb'), el.dataset.type);
      setTimeout(step, 0);
    };
    setTimeout(step, 50);

    // 點擊=加到畫布中央;拖曳=加到放開的位置
    items.forEach(el => {
      const type = el.dataset.type;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        let ghost = null;
        const mv = ev => {
          if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
            ghost = document.createElement('div');
            ghost.className = 'drag-ghost';
            const src = el.querySelector('.lib-thumb');
            const cv = document.createElement('canvas');
            cv.width = src.width; cv.height = src.height;
            cv.getContext('2d').drawImage(src, 0, 0);
            ghost.appendChild(cv);
            ghost.insertAdjacentHTML('beforeend', `<span>${NodeDefs[type].title}</span>`);
            document.body.appendChild(ghost);
          }
          if (ghost) {
            ghost.style.left = (ev.clientX + 12) + 'px';
            ghost.style.top = (ev.clientY + 8) + 'px';
          }
        };
        const up = ev => {
          window.removeEventListener('pointermove', mv);
          window.removeEventListener('pointerup', up);
          const dragged = !!ghost;
          if (ghost) { ghost.remove(); ghost = null; }
          const vp = document.getElementById('viewport');
          const r = vp.getBoundingClientRect();
          if (!dragged) {
            const c = Editor.toWorld(r.left + r.width / 2, r.top + r.height / 2);
            addNodeAt(type, c.x, c.y, true);
          } else if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            const c = Editor.toWorld(ev.clientX, ev.clientY);
            addNodeAt(type, c.x, c.y, false);
          }
        };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
      });
      // hover 顯示說明
      el.addEventListener('mouseenter', () => {
        document.getElementById('hint').textContent = `${NodeDefs[type].title} — ${DESC[type] || ''}(點擊加到中央,拖曳放到指定位置)`;
      });
      el.addEventListener('mouseleave', () => {
        document.getElementById('hint').textContent = defaultHint;
      });
    });

    // 分類摺疊
    wrap.querySelectorAll('.lib-cat').forEach(head => {
      head.addEventListener('click', () => {
        const group = head.parentElement;
        group.classList.toggle('collapsed');
        head.querySelector('.tri').textContent = group.classList.contains('collapsed') ? '▸' : '▾';
      });
    });

    // 搜尋過濾:項目比對 title+zh;搜尋中無視摺疊,分類沒有可見項目時整組隱藏
    document.getElementById('lib-search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      wrap.querySelectorAll('.lib-group').forEach(group => {
        let visible = 0;
        group.querySelectorAll('.lib-item').forEach(item => {
          const hit = !q || item.dataset.search.includes(q);
          item.style.display = hit ? '' : 'none';
          if (hit) visible++;
        });
        group.style.display = visible ? '' : 'none';
        group.classList.toggle('searching', !!q);
      });
    });
  }

  // ---------- 參數面板 ----------
  function makeParamRow(node, p) {
    const row = document.createElement('div');
    row.className = 'prow';
    const commit = (val, rerender) => {
      node.params[p.k] = val;
      App.graph.markDirty(node.id);
      requestRender();
      if (rerender) showParams(node); // select/bool 可能改變其他參數可見性
    };

    if (p.t === 'f' || p.t === 'i') {
      const fmt = v => p.t === 'i' ? String(v) : (+v).toFixed(p.step >= 1 ? 0 : 2);
      row.innerHTML = `<div class="plabel"><span>${p.label}</span><span class="pval">${fmt(node.params[p.k])}</span></div>`;
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = p.min; inp.max = p.max; inp.step = p.t === 'i' ? 1 : (p.step || 0.01);
      inp.value = node.params[p.k];
      const setFill = () => inp.style.setProperty('--fill', ((inp.value - p.min) / (p.max - p.min) * 100) + '%');
      setFill();
      inp.addEventListener('pointerdown', () => App.history.push()); // 一次拖曳 = 一個復原點
      inp.addEventListener('input', () => {
        const v = p.t === 'i' ? parseInt(inp.value) : parseFloat(inp.value);
        row.querySelector('.pval').textContent = fmt(v);
        setFill();
        commit(v);
      });
      row.appendChild(inp);
    } else if (p.t === 'sel') {
      row.innerHTML = `<div class="plabel"><span>${p.label}</span></div>`;
      const s = document.createElement('select');
      for (const [v, lb] of p.opts) {
        const o = document.createElement('option');
        o.value = v; o.textContent = lb;
        if (node.params[p.k] === v) o.selected = true;
        s.appendChild(o);
      }
      s.addEventListener('change', () => { App.history.push(); commit(s.value, true); });
      row.appendChild(s);
    } else if (p.t === 'b') {
      row.innerHTML = `<label class="chk"><input type="checkbox" ${node.params[p.k] ? 'checked' : ''}> ${p.label}</label>`;
      row.querySelector('input').addEventListener('change', e => { App.history.push(); commit(e.target.checked, true); });
    } else if (p.t === 'seed') {
      row.innerHTML = `<div class="plabel"><span>${p.label}</span></div>`;
      const d = document.createElement('div');
      d.className = 'seed-row';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.value = node.params[p.k];
      inp.addEventListener('change', () => { App.history.push(); commit(parseInt(inp.value) || 0); });
      const btn = document.createElement('button');
      btn.textContent = '🎲';
      btn.addEventListener('click', () => {
        App.history.push();
        inp.value = 1 + Math.floor(Math.random() * 9999);
        commit(+inp.value);
      });
      d.appendChild(inp); d.appendChild(btn);
      row.appendChild(d);
    }
    return row;
  }

  // ---------- 模板巨集:以特效語言命名的滑桿,寫穿到底層節點參數 ----------
  function applyMacro(m) {
    for (const t of m.targets) {
      const node = App.graph.nodes.get(t.id);
      if (!node) continue;
      const pd = NodeDefs[node.type].params.find(p => p.k === t.param);
      let val = t.pmin + (t.pmax - t.pmin) * m.value;
      if (pd && pd.t === 'i') val = Math.round(val);
      node.params[t.param] = val;
      App.graph.markDirty(node.id);
    }
  }

  // 切換特效種類:載入該範本(macros 隨圖,面板會自動重建)
  function loadPreset(name) {
    const g = Presets.get(name);
    if (!g) return;
    App.history.push();
    setGraph(g);
    Editor.fitView();
  }

  function showMacros(wrap, nameEl) {
    nameEl.textContent = '✨ 模板控制';
    wrap.innerHTML = '';

    // ── 特效種類下拉(全部範本,依分類分組)──
    const pick = document.createElement('div');
    pick.className = 'prow macro-pick';
    pick.innerHTML = `<div class="plabel"><span>特效種類</span></div>`;
    const psel = document.createElement('select');
    for (const [catKey, catName] of Presets.cats) {
      const og = document.createElement('optgroup'); og.label = catName;
      for (const [nm, meta] of Object.entries(Presets.meta)) {
        if (meta.cat !== catKey) continue;
        const o = document.createElement('option');
        o.value = nm; o.textContent = `${meta.emoji} ${meta.name}`;
        if (nm === App.graph._presetName) o.selected = true;
        og.appendChild(o);
      }
      psel.appendChild(og);
    }
    psel.addEventListener('change', () => loadPreset(psel.value));
    pick.appendChild(psel);
    wrap.appendChild(pick);

    const note = document.createElement('div');
    note.className = 'macro-note';
    note.textContent = '以特效語言調整整條節點鏈;點任何節點可進入進階參數。';
    wrap.appendChild(note);

    // ── 巨集滑桿 ──
    for (const m of App.graph._macros) {
      const row = document.createElement('div');
      row.className = 'prow';
      const pct = v => Math.round(v * 100) + '%';
      row.innerHTML = `<div class="plabel"><span>${m.label}</span><span class="pval">${pct(m.value)}</span></div>`;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.01;
      inp.value = m.value;
      const setFill = () => inp.style.setProperty('--fill', (inp.value * 100) + '%');
      setFill();
      inp.addEventListener('pointerdown', () => App.history.push());
      inp.addEventListener('input', () => {
        m.value = parseFloat(inp.value);
        row.querySelector('.pval').textContent = pct(m.value);
        setFill();
        applyMacro(m);
        requestRender();
      });
      row.appendChild(inp);
      wrap.appendChild(row);
    }

    // ── 配色:有 Gradient Map 節點時,直接切換色帶 ──
    const gmNodes = [...App.graph.nodes.values()].filter(n => n.type === 'gradientMap');
    if (gmNodes.length) {
      const pd = NodeDefs.gradientMap.params.find(p => p.k === 'preset');
      const cur = gmNodes[0].params.preset;
      const row = document.createElement('div');
      row.className = 'prow color-row';
      row.innerHTML = `<div class="plabel"><span>🎨 配色</span></div>`;
      const cs = document.createElement('select');
      for (const [v, lb] of pd.opts) {
        const o = document.createElement('option');
        o.value = v; o.textContent = lb;
        if (v === cur) o.selected = true;
        cs.appendChild(o);
      }
      cs.addEventListener('change', () => {
        App.history.push();
        for (const n of gmNodes) { n.params.preset = cs.value; App.graph.markDirty(n.id); }
        requestRender();
      });
      row.appendChild(cs);
      wrap.appendChild(row);
    } else {
      const gn = document.createElement('div');
      gn.className = 'macro-note dim';
      gn.textContent = '此範本輸出灰階,設計為在遊戲引擎內染色。';
      wrap.appendChild(gn);
    }
  }

  function showParams(node) {
    const wrap = document.getElementById('params');
    const nameEl = document.getElementById('param-node-name');
    if (!node) {
      if (App.graph._macros && App.graph._macros.length) return showMacros(wrap, nameEl);
      // 精簡模式下沒有模板滑桿 → 給出路,避免死路
      if (document.getElementById('app').classList.contains('simple')) {
        nameEl.textContent = '';
        wrap.innerHTML = `<div class="macro-note">此節點圖沒有模板滑桿。<br>從「範本牆」挑一個特效範本,即可用滑桿快速調整;或切換「進階」直接編輯節點。</div>
          <div class="prow seed-row">
            <button id="mk-gallery">🖼 範本牆</button>
            <button id="mk-advanced">🔧 進階編輯</button>
          </div>`;
        wrap.querySelector('#mk-gallery').addEventListener('click', openGallery);
        wrap.querySelector('#mk-advanced').addEventListener('click', () => document.getElementById('btn-mode').click());
        return;
      }
      wrap.innerHTML = '<div class="params-empty">點選節點以編輯參數</div>';
      nameEl.textContent = '';
      return;
    }
    const def = NodeDefs[node.type];
    nameEl.textContent = `${def.title} #${node.id}`;
    wrap.innerHTML = '';
    if (!def.params.length) {
      wrap.innerHTML = '<div class="params-empty">此節點沒有參數</div>';
      return;
    }
    // 依 ADV 表分成「關鍵」與「進階」兩組(先套用 show 條件)
    const advKeys = new Set(ADV[node.type] || []);
    const keyParams = [], advParams = [];
    for (const p of def.params) {
      if (p.show && !p.show(node.params)) continue;
      (advKeys.has(p.k) ? advParams : keyParams).push(p);
    }
    keyParams.forEach(p => wrap.appendChild(makeParamRow(node, p)));

    if (advParams.length) {
      const open = advOpen.has(node.type);
      const tg = document.createElement('div');
      tg.className = 'adv-toggle';
      tg.innerHTML = `<span class="tri">${open ? '▾' : '▸'}</span>進階參數(${advParams.length})`;
      tg.addEventListener('click', () => {
        if (advOpen.has(node.type)) advOpen.delete(node.type);
        else advOpen.add(node.type);
        showParams(node);
      });
      wrap.appendChild(tg);
      if (open) advParams.forEach(p => wrap.appendChild(makeParamRow(node, p)));
    }
  }

  // ---------- 範本縮圖牆 ----------
  let galleryBuilt = false;
  const galleryDone = new Set(); // 已渲染縮圖的範本

  function buildGallery() {
    const body = document.getElementById('gallery-body');
    let html = '';
    for (const [catKey, catName] of Presets.cats) {
      const items = Object.entries(Presets.meta).filter(([, m]) => m.cat === catKey);
      if (!items.length) continue;
      html += `<div class="g-cat">${catName}</div><div class="g-grid">`;
      for (const [name, m] of items) {
        html += `<div class="g-card" data-preset="${name}" title="載入「${m.name}」節點鏈">
          <canvas width="128" height="128"></canvas>
          <div class="g-name"><span>${m.emoji} ${m.name}</span><span class="en">${m.en}</span></div></div>`;
      }
      html += '</div>';
    }
    let hasAuto = false;
    try { hasAuto = !!localStorage.getItem('texforge_autosave'); } catch (e) {}
    html += `<div class="g-cat">工作階段</div><div class="g-grid">`;
    if (hasAuto) {
      html += `<div class="g-card g-blank" data-preset="__autosave" title="載入自動存檔的節點圖">
        <div class="g-plus">⏪</div>
        <div class="g-name"><span>上次的工作</span><span class="en">Autosave</span></div></div>`;
    }
    html += `<div class="g-card g-blank" data-preset="" title="空白畫布,只留一個 Output 節點">
        <div class="g-plus">＋</div>
        <div class="g-name"><span>空白畫布</span><span class="en">Blank</span></div></div></div>`;
    body.innerHTML = html;

    body.querySelectorAll('.g-card').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.preset;
        App.history.push(); // 載入前存復原點,Ctrl+Z 可回到原本的圖
        if (name === '__autosave') {
          const g = loadAutosave();
          if (g) setGraph(g);
        } else if (name) {
          setGraph(Presets.get(name));
        } else {
          const g = new NodeGraph();
          g.addNode('output', 700, 200);
          setGraph(g);
        }
        Editor.fitView();
        closeGallery();
      });
    });
  }

  // 縮圖逐張渲染(setTimeout 分批,不卡 UI);結果留在 canvas 上,重開即快取
  function renderGalleryThumbs() {
    const cards = [...document.querySelectorAll('#gallery-body .g-card[data-preset]')]
      .filter(c => c.dataset.preset && c.querySelector('canvas') && !galleryDone.has(c.dataset.preset));
    let i = 0;
    const step = () => {
      if (i >= cards.length) return;
      const card = cards[i++];
      const name = card.dataset.preset;
      try {
        const g = Presets.get(name);
        const out = g.findByType('output');
        const buf = g.evaluate(out.id, 128);
        const ctx = card.querySelector('canvas').getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 128, 128);
        ctx.drawImage(bufToCanvas(buf, 128), 0, 0, 128, 128);
        galleryDone.add(name);
      } catch (err) {
        console.error('範本縮圖渲染失敗:', name, err);
      }
      setTimeout(step, 0);
    };
    step();
  }

  function openGallery() {
    if (!galleryBuilt) { buildGallery(); galleryBuilt = true; }
    document.getElementById('gallery').classList.remove('hidden');
    renderGalleryThumbs();
  }
  function closeGallery() {
    document.getElementById('gallery').classList.add('hidden');
  }

  // ---------- 一鍵變體:隨機化圖中所有種子 ----------
  function randomVariant() {
    const targets = [];
    for (const node of App.graph.nodes.values()) {
      for (const p of NodeDefs[node.type].params) {
        if (p.t === 'seed') targets.push([node, p.k]);
      }
    }
    if (!targets.length) {
      document.getElementById('hint').textContent = '此節點圖沒有種子參數,無法產生變體';
      return;
    }
    App.history.push();
    for (const [node, k] of targets) {
      node.params[k] = 1 + Math.floor(Math.random() * 9999);
      App.graph.markDirty(node.id);
    }
    document.getElementById('hint').textContent = `🎲 已隨機化 ${targets.length} 個種子,產生新變體(Ctrl+Z 可復原)`;
    requestRender();
    const sel = Editor.selectedNode();
    if (sel) showParams(sel);
  }

  // ---------- 右鍵選單 ----------
  function ctxMenuEl() { return document.getElementById('ctx-menu'); }
  function closeMenu() { ctxMenuEl().classList.add('hidden'); }
  function openMenuAt(cx, cy) {
    const m = ctxMenuEl();
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(cx, innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(4, Math.min(cy, innerHeight - r.height - 8)) + 'px';
  }
  // 節點選單:複製 / 斷線 / 刪除
  function showNodeMenu(id, cx, cy) {
    const node = App.graph.nodes.get(id);
    if (!node) return;
    const def = NodeDefs[node.type];
    const m = ctxMenuEl();
    m.innerHTML = `
      <div class="cm-title">${def.title} <span>#${id}</span></div>
      <div class="cm-item" data-act="dup">📄 複製節點<span class="k">Ctrl+D</span></div>
      <div class="cm-item" data-act="disc">✂ 斷開所有連線</div>
      <div class="cm-item cm-danger" data-act="del">🗑 刪除節點<span class="k">Del</span></div>`;
    m.querySelectorAll('.cm-item').forEach(el => el.addEventListener('click', () => {
      const act = el.dataset.act;
      if (act === 'dup') Editor.duplicateNode(id);
      else if (act === 'disc') Editor.disconnectNode(id);
      else if (act === 'del') {
        App.history.push();
        App.graph.removeNode(id);
        Editor.select(null);
        Editor.rebuild();
        App.onGraphChanged();
      }
      closeMenu();
    }));
    openMenuAt(cx, cy);
  }
  // 畫布選單:搜尋 + 新增節點於游標處
  function showCanvasMenu(cx, cy) {
    const world = Editor.toWorld(cx, cy);
    const m = ctxMenuEl();
    let list = '';
    for (const [cat, meta] of Object.entries(NodeCats)) {
      for (const [type, def] of Object.entries(NodeDefs)) {
        if (def.cat !== cat) continue;
        list += `<div class="cm-item cm-node" data-type="${type}" data-search="${(def.title + ' ' + def.zh).toLowerCase()}">
          <span class="dot" style="background:${meta.color}"></span>${def.title}<span class="k">${def.zh}</span></div>`;
      }
    }
    m.innerHTML = `<input class="cm-search" type="text" placeholder="🔍 新增節點於此…"><div class="cm-list">${list}</div>`;
    const search = m.querySelector('.cm-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      m.querySelectorAll('.cm-node').forEach(el => {
        el.style.display = (!q || el.dataset.search.includes(q)) ? '' : 'none';
      });
    });
    m.querySelectorAll('.cm-node').forEach(el => el.addEventListener('click', () => {
      addNodeAt(el.dataset.type, world.x + 75, world.y + 66, false); // addNodeAt 會扣回節點半寬高
      closeMenu();
    }));
    openMenuAt(cx, cy);
    search.focus();
  }

  // ---------- 存讀檔 / 匯出 ----------
  function download(name, blobOrUrl) {
    const a = document.createElement('a');
    a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.download = name;
    a.click();
    if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportPNG() {
    const res = +document.getElementById('export-res').value;
    const node = App.graph.findByType('output') || Editor.selectedNode();
    if (!node) { alert('請先建立 Output 節點或選取一個節點'); return; }
    App.graph.markAllDirty(); // 以匯出解析度重新評估
    const buf = App.graph.evaluate(node.id, res);
    const cv = bufToCanvas(buf, res);
    App.graph.markAllDirty(); // 快取回到預覽解析度用
    requestRender();
    cv.toBlob(b => download(`texforge_${res}.png`, b), 'image/png');
  }

  function setGraph(g) {
    App.graph = g;
    Editor.select(null);
    Editor.rebuild();
    requestRender();
  }

  // ---------- 初始化 ----------
  function init() {
    previewCv = document.getElementById('preview');
    previewCtx = previewCv.getContext('2d');
    perfEl = document.getElementById('perf');
    initTheme();
    buildLibrary();

    document.getElementById('preview-res').addEventListener('change', () => {
      App.graph.markAllDirty(); requestRender();
    });
    document.getElementById('preview-bg').addEventListener('change', requestRender);
    document.getElementById('preview-tile').addEventListener('change', () => { requestRender(); ensureAnimLoop(); });
    document.getElementById('preview-anim').addEventListener('change', ensureAnimLoop);
    document.getElementById('preview-anim-mode').addEventListener('change', () => { animT0 = performance.now(); });
    document.getElementById('btn-export').addEventListener('click', exportPNG);

    // 範本牆 & 變體
    document.getElementById('btn-gallery').addEventListener('click', openGallery);
    document.getElementById('btn-variant').addEventListener('click', randomVariant);

    // 精簡 / 進階模式切換
    const modeBtn = document.getElementById('btn-mode');
    function setMode(advanced) {
      const app = document.getElementById('app');
      app.classList.toggle('simple', !advanced);
      modeBtn.classList.toggle('on', advanced);
      modeBtn.textContent = advanced ? '🎛 精簡' : '🔧 進階';
      modeBtn.title = advanced ? '返回精簡模式:只保留結果預覽與模板滑桿' : '進階模式:展開底層節點編輯器';
      try { localStorage.setItem('texforge_mode', advanced ? 'advanced' : 'simple'); } catch (e) {}
      if (advanced) {
        Editor.rebuild(); Editor.fitView();   // 畫布剛顯示,重新框圖
      } else {
        Editor.select(null);                  // 回精簡:清選取以顯示模板滑桿
      }
      requestRender();                         // 預覽尺寸改變,重繪
    }
    modeBtn.addEventListener('click', () => setMode(document.getElementById('app').classList.contains('simple')));
    // 還原上次模式(預設精簡)
    let savedMode = null;
    try { savedMode = localStorage.getItem('texforge_mode'); } catch (e) {}
    if (savedMode === 'advanced') setMode(true);
    document.getElementById('gallery-close').addEventListener('click', closeGallery);
    document.getElementById('gallery').addEventListener('pointerdown', e => {
      if (e.target.id === 'gallery') closeGallery(); // 點背景關閉
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeGallery(); closeMenu(); }
    });

    // 📌 預覽鎖定
    document.getElementById('preview-pin').addEventListener('click', e => {
      previewPinned = !previewPinned;
      e.target.classList.toggle('on', previewPinned);
      requestRender();
    });

    // 右鍵選單:點選單外任意處關閉
    window.addEventListener('pointerdown', e => {
      if (!e.target.closest || !e.target.closest('#ctx-menu')) closeMenu();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (!confirm('確定清空整個節點圖?(Ctrl+Z 可復原)')) return;
      App.history.push();
      const g = new NodeGraph();
      g.addNode('output', 700, 200);
      setGraph(g);
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      const json = JSON.stringify(App.graph.serialize(), null, 2);
      download('texforge_graph.json', new Blob([json], { type: 'application/json' }));
    });

    const fileInput = document.getElementById('file-load');
    document.getElementById('btn-load').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          App.history.push();
          setGraph(NodeGraph.deserialize(JSON.parse(rd.result)));
          Editor.fitView();
        }
        catch (err) { alert('讀取失敗:' + err.message); }
      };
      rd.readAsText(f);
      fileInput.value = '';
    });
  }

  return { init, requestRender, showParams, setGraph, bufToCanvas, openGallery, showNodeMenu, showCanvasMenu, loadAutosave };
})();
