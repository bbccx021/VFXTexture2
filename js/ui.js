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

  // 進階參數(預設摺疊);未列出的節點所有參數皆為關鍵參數
  const ADV = {
    shape: ['rot', 'falloff'],
    ramp: ['curve', 'mirror'],
    tileSampler: ['sizeRand', 'rotRand', 'briRand', 'coverage', 'maskThreshold', 'maskInvert'],
    splatterCircular: ['width', 'sizeRand', 'angJitter', 'radJitter', 'rotOff', 'widthRand', 'briRand', 'sharp', 'sizeFade', 'radFade', 'briFade'],
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
    forge: { zh: '熔光琥珀', v: { '--bg': '#0a0908', '--pit': '#060505', '--panel': '#131110', '--panel-2': '#1a1713', '--line': '#292319', '--line-soft': '#1e1a14', '--text': '#ece5da', '--text-dim': '#a99c8a', '--text-faint': '#6a6053', '--track': '#33291c', '--acc': '#ff9d2e', '--acc-2': '#ffc45c', '--acc-deep': '#c96a10', '--acc-soft': '#ff9d2e24', '--on-acc': '#170c02', '--cy': '#41e0d6' } },
    iron:  { zh: '寒鐵靛青', v: { '--bg': '#080a0d', '--pit': '#040506', '--panel': '#10141a', '--panel-2': '#161c24', '--line': '#232c38', '--line-soft': '#1a2029', '--text': '#dde7f0', '--text-dim': '#8fa2b5', '--text-faint': '#566473', '--track': '#22303f', '--acc': '#3ec6e0', '--acc-2': '#72e0f2', '--acc-deep': '#1580a0', '--acc-soft': '#3ec6e024', '--on-acc': '#03151c', '--cy': '#ffc95c' } },
    royal: { zh: '皇家藍', v: { '--bg': '#090b14', '--pit': '#050609', '--panel': '#10131f', '--panel-2': '#171b2b', '--line': '#232842', '--line-soft': '#191d31', '--text': '#dbe0f0', '--text-dim': '#97a2c4', '--text-faint': '#646e93', '--track': '#2e3554', '--acc': '#4d7cff', '--acc-2': '#7fa0ff', '--acc-deep': '#2c4dbb', '--acc-soft': '#4d7cff24', '--on-acc': '#ffffff', '--cy': '#43e0d0' } },
    jade:  { zh: '翡翠爐', v: { '--bg': '#08110c', '--pit': '#040805', '--panel': '#0e1a12', '--panel-2': '#14251a', '--line': '#1f3527', '--line-soft': '#17281d', '--text': '#dcefe0', '--text-dim': '#98b7a2', '--text-faint': '#647f6e', '--track': '#2a4634', '--acc': '#2fd583', '--acc-2': '#5ceea3', '--acc-deep': '#128a4e', '--acc-soft': '#2fd58324', '--on-acc': '#03160b', '--cy': '#ffc95c' } },
    blood: { zh: '血月紅', v: { '--bg': '#0d0909', '--pit': '#070404', '--panel': '#171010', '--panel-2': '#201616', '--line': '#332222', '--line-soft': '#261a1a', '--text': '#f0dfdc', '--text-dim': '#b59a95', '--text-faint': '#7a625d', '--track': '#3e2926', '--acc': '#ff5252', '--acc-2': '#ff8a80', '--acc-deep': '#b31f2e', '--acc-soft': '#ff525224', '--on-acc': '#ffffff', '--cy': '#e6a23f' } },
    volt:  { zh: '紫電', v: { '--bg': '#0b0a12', '--pit': '#060509', '--panel': '#14121e', '--panel-2': '#1b1828', '--line': '#2a2540', '--line-soft': '#201c30', '--text': '#e2ddf0', '--text-dim': '#a196c0', '--text-faint': '#6a6188', '--track': '#332c52', '--acc': '#a86bff', '--acc-2': '#c497ff', '--acc-deep': '#6e35c9', '--acc-soft': '#a86bff24', '--on-acc': '#ffffff', '--cy': '#3fd8e2' } },
    moon:  { zh: '月銀', v: { '--bg': '#0a0a0c', '--pit': '#050506', '--panel': '#131316', '--panel-2': '#1a1a1e', '--line': '#28282e', '--line-soft': '#1e1e23', '--text': '#e6e6ec', '--text-dim': '#a4a4b0', '--text-faint': '#6c6c78', '--track': '#33333c', '--acc': '#c9d4e4', '--acc-2': '#eef3fa', '--acc-deep': '#8593ab', '--acc-soft': '#c9d4e424', '--on-acc': '#10141c', '--cy': '#ffc95c' } },
  };
  function applyTheme(name) {
    const t = THEMES[name] || THEMES.forge;
    const s = document.documentElement.style;
    for (const [k, v] of Object.entries(t.v)) s.setProperty(k, v);
    try { localStorage.setItem('texforge_theme2', name); } catch (e) {}
    const sel = document.getElementById('theme-select');
    if (sel && sel.value !== name) sel.value = name;
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('texforge_theme2'); } catch (e) {}
    if (!saved || !THEMES[saved]) saved = 'forge';   // 預設熔光琥珀(Forge)
    applyTheme(saved);
    const sel = document.getElementById('theme-select');
    if (sel) sel.addEventListener('change', e => applyTheme(e.target.value));
  }

  // ---------- 面板收合(節點庫 / 預覽面板;進階模式)----------
  function initPanelToggles() {
    const app = document.getElementById('app');
    const apply = () => {
      let lib = false, insp = false;
      try {
        lib = localStorage.getItem('texforge_libclosed') === '1';
        insp = localStorage.getItem('texforge_inspclosed') === '1';
      } catch (e) {}
      app.classList.toggle('lib-closed', lib);
      app.classList.toggle('insp-closed', insp);
      document.getElementById('lib-expand').classList.toggle('hidden', !lib);
      document.getElementById('insp-expand').classList.toggle('hidden', !insp);
    };
    const setFlag = (key, v) => { try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) {} apply(); };
    document.getElementById('lib-collapse').addEventListener('click', () => setFlag('texforge_libclosed', true));
    document.getElementById('lib-expand').addEventListener('click', () => setFlag('texforge_libclosed', false));
    document.getElementById('insp-collapse').addEventListener('click', () => setFlag('texforge_inspclosed', true));
    document.getElementById('insp-expand').addEventListener('click', () => setFlag('texforge_inspclosed', false));
    apply();
  }

  // ---------- 精簡模式:參數欄寬 / 膠卷卡片大小 拖曳 ----------
  function initSimpleResizes() {
    // 參數欄左緣
    const pr = document.getElementById('sparams-resize');
    if (pr) {
      try {
        const w = +localStorage.getItem('texforge_sparw');
        if (w >= 280) document.documentElement.style.setProperty('--sparams-w', w + 'px');
      } catch (e) {}
      pr.addEventListener('pointerdown', e => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = document.getElementById('params-sec').getBoundingClientRect().width;
        try { pr.setPointerCapture(e.pointerId); } catch (e2) {}
        let w = startW;
        const mv = ev => {
          w = Math.max(280, Math.min(innerWidth * 0.6, startW + (startX - ev.clientX)));
          document.documentElement.style.setProperty('--sparams-w', w + 'px');
        };
        const up = () => {
          pr.removeEventListener('pointermove', mv); pr.removeEventListener('pointerup', up);
          try { localStorage.setItem('texforge_sparw', Math.round(w)); } catch (e2) {}
        };
        pr.addEventListener('pointermove', mv); pr.addEventListener('pointerup', up);
      });
    }
    // 膠卷上緣 → 調卡片大小(= 膠卷高度)
    const rr = document.getElementById('reel-resize');
    if (rr) {
      try {
        const c = +localStorage.getItem('texforge_reelcard');
        if (c >= 72) document.documentElement.style.setProperty('--reel-card', c + 'px');
      } catch (e) {}
      rr.addEventListener('pointerdown', e => {
        e.preventDefault();
        const startY = e.clientY;
        const startC = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reel-card')) || 100;
        try { rr.setPointerCapture(e.pointerId); } catch (e2) {}
        let c = startC;
        const mv = ev => {
          c = Math.max(72, Math.min(170, startC + (startY - ev.clientY)));
          document.documentElement.style.setProperty('--reel-card', c + 'px');
        };
        const up = () => {
          rr.removeEventListener('pointermove', mv); rr.removeEventListener('pointerup', up);
          try { localStorage.setItem('texforge_reelcard', Math.round(c)); } catch (e2) {}
        };
        rr.addEventListener('pointermove', mv); rr.addEventListener('pointerup', up);
      });
    }
  }

  // ---------- 進階模式預覽面板寬度(拖曳左緣自由縮放)----------
  function initInspectorResize() {
    const rs = document.getElementById('insp-resize');
    if (!rs) return;
    try {
      const w = +localStorage.getItem('texforge_inspw');
      if (w >= 280) document.documentElement.style.setProperty('--insp-w', w + 'px');
    } catch (e) {}
    rs.addEventListener('pointerdown', e => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = document.getElementById('inspector').getBoundingClientRect().width;
      rs.classList.add('dragging');
      rs.setPointerCapture(e.pointerId);
      let w = startW;
      const move = ev => {
        w = Math.max(280, Math.min(innerWidth * 0.7, startW + (startX - ev.clientX)));
        document.documentElement.style.setProperty('--insp-w', w + 'px');
      };
      const up = () => {
        rs.classList.remove('dragging');
        rs.removeEventListener('pointermove', move);
        rs.removeEventListener('pointerup', up);
        try { localStorage.setItem('texforge_inspw', Math.round(w)); } catch (e2) {}
      };
      rs.addEventListener('pointermove', move);
      rs.addEventListener('pointerup', up);
    });
  }

  // ---------- 自訂色帶(localStorage 持久化,鍵名 u_ 開頭)----------
  const hex2f = h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  function rampOpts() { return NodeDefs.gradientMap.params.find(p => p.k === 'preset').opts; }
  function loadCustomRamps() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem('texforge_ramps') || '{}'); } catch (e) {}
    for (const [key, r] of Object.entries(data)) registerRamp(key, r.zh, r.stops, false);
  }
  // stopsHex: [[pos, 'rrggbb'], ...]
  function registerRamp(key, zh, stopsHex, persist) {
    GRADS[key] = { zh: '🎨 ' + zh, stops: stopsHex.map(([p, h]) => [p, ...hex2f(h)]), custom: true, raw: stopsHex };
    const opts = rampOpts();
    const i = opts.findIndex(o => o[0] === key);
    if (i >= 0) opts[i] = [key, GRADS[key].zh]; else opts.push([key, GRADS[key].zh]);
    if (persist) {
      let data = {};
      try { data = JSON.parse(localStorage.getItem('texforge_ramps') || '{}'); } catch (e) {}
      data[key] = { zh, stops: stopsHex };
      try { localStorage.setItem('texforge_ramps', JSON.stringify(data)); } catch (e) {}
    }
  }
  function deleteRamp(key) {
    delete GRADS[key];
    const opts = rampOpts();
    const i = opts.findIndex(o => o[0] === key);
    if (i >= 0) opts.splice(i, 1);
    let data = {};
    try { data = JSON.parse(localStorage.getItem('texforge_ramps') || '{}'); } catch (e) {}
    delete data[key];
    try { localStorage.setItem('texforge_ramps', JSON.stringify(data)); } catch (e) {}
    // 使用中的節點退回預設色帶
    for (const n of App.graph.nodes.values()) {
      if (n.type === 'gradientMap' && n.params.preset === key) { n.params.preset = 'celFire'; App.graph.markDirty(n.id); }
    }
    requestRender();
  }
  const f2hex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  function rampToHexStops(key) {   // 內建色帶轉 hex 供「複製編輯」
    const g = GRADS[key];
    if (g.raw) return g.raw.map(x => [...x]);
    return g.stops.map(([p, r, gg, b]) => [Math.round(p * 1000) / 1000, f2hex(r) + f2hex(gg) + f2hex(b)]);
  }

  // ---------- 色帶編輯器(小型彈窗)----------
  // onDone(key) 於儲存後回呼;editKey 為 u_ 鍵時就地編輯,否則另存新色帶
  function openRampEditor(baseKey, editKey, onDone) {
    document.getElementById('ramp-editor')?.remove();
    const stops = baseKey ? rampToHexStops(baseKey) : [[0, '120524'], [0.5, 'e04a1c'], [1, 'ffeeb0']];
    const baseZh = baseKey && GRADS[baseKey] ? GRADS[baseKey].zh.replace('🎨 ', '') : '';
    const name0 = editKey ? baseZh : (baseZh ? baseZh + ' 副本' : '自訂色帶');
    const ov = document.createElement('div');
    ov.id = 'ramp-editor';
    ov.innerHTML = `<div class="re-panel">
      <div class="re-head"><span>${tr('色帶編輯器')}</span><button class="re-x">✕</button></div>
      <div class="re-preview"></div>
      <input class="re-name" type="text" maxlength="12" value="${name0}">
      <div class="re-stops"></div>
      <div class="re-foot">
        <button class="re-add">＋ ${tr('色標')}</button>
        <span class="re-sp"></span>
        <button class="re-save">${tr('儲存')}</button>
      </div></div>`;
    document.body.appendChild(ov);
    const prev = ov.querySelector('.re-preview'), list = ov.querySelector('.re-stops');
    const paint = () => {
      const sorted = [...stops].sort((a, b) => a[0] - b[0]);
      prev.style.background = 'linear-gradient(90deg,' + sorted.map(([p, h]) => `#${h} ${(p * 100).toFixed(1)}%`).join(',') + ')';
    };
    const rebuild = () => {
      list.innerHTML = '';
      stops.forEach((st, i) => {
        const row = document.createElement('div');
        row.className = 're-row';
        row.innerHTML = `<input type="color" value="#${st[1]}">
          <input type="range" min="0" max="100" value="${Math.round(st[0] * 100)}">
          <span class="re-pct">${Math.round(st[0] * 100)}%</span>
          <button class="re-del" ${stops.length <= 2 ? 'disabled' : ''}>✕</button>`;
        const [ci, ri] = row.querySelectorAll('input');
        ci.addEventListener('input', () => { st[1] = ci.value.slice(1); paint(); });
        ri.addEventListener('input', () => { st[0] = ri.value / 100; row.querySelector('.re-pct').textContent = ri.value + '%'; paint(); });
        row.querySelector('.re-del').addEventListener('click', () => { stops.splice(i, 1); rebuild(); paint(); });
        list.appendChild(row);
      });
    };
    rebuild(); paint();
    ov.querySelector('.re-add').addEventListener('click', () => {
      if (stops.length >= 13) return;
      stops.push([0.5, 'ffffff']); rebuild(); paint();
    });
    const close = () => ov.remove();
    ov.querySelector('.re-x').addEventListener('click', close);
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    ov.querySelector('.re-save').addEventListener('click', () => {
      const zh = ov.querySelector('.re-name').value.trim() || '自訂色帶';
      const key = editKey || ('u_' + Date.now().toString(36));
      const sorted = [...stops].sort((a, b) => a[0] - b[0]);
      registerRamp(key, zh, sorted, true);
      // 使用中的節點立即反映
      for (const n of App.graph.nodes.values()) {
        if (n.type === 'gradientMap' && n.params.preset === key) App.graph.markDirty(n.id);
      }
      requestRender();
      close();
      if (onDone) onDone(key);
    });
  }

  // ---------- 色帶 → CSS 漸層字串 ----------
  function rampCss(key) {
    const g = GRADS[key];
    if (!g) return 'linear-gradient(90deg,#000,#fff)';
    const stops = g.stops.map(([p, r, gg, b]) =>
      `rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)}) ${(p * 100).toFixed(1)}%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }
  function rampLabel(key) {
    const g = GRADS[key];
    const zh = g ? g.zh.replace('🎨 ', '') : key;
    return `${tr(zh)} · ${key.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}`;
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
    perfEl.textContent = `⏱ ${ms.toFixed(0)} ms · ${App.graph.nodes.size} ${tr('節點')} · ${res}²`;
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
  function paintPreview(res) {
    const node = (previewPinned ? App.graph.findByType('output') : Editor.selectedNode())
      || App.graph.findByType('output') || Editor.selectedNode();
    const srcLabel = document.getElementById('preview-src');
    previewCtx.clearRect(0, 0, 512, 512);
    if (!node) { srcLabel.textContent = ''; return; }
    srcLabel.textContent = NodeDefs[node.type].title + (previewPinned ? ' 🔒' : '');
    const buf = App.graph.evaluate(node.id, res);
    drawPreviewBg();
    const cv = bufToCanvas(buf, res);
    previewCtx.imageSmoothingEnabled = true;
    if (document.getElementById('preview-tile').checked) {
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++)
        previewCtx.drawImage(cv, tx * 256, ty * 256, 256, 256);
    } else {
      previewCtx.drawImage(cv, 0, 0, 512, 512);
    }
  }

  // ---------- 節點庫(縮圖 / 搜尋 / 摺疊 / 拖放) ----------

  // 每個節點一行中文說明(hover 時顯示在狀態列)
  const DESC = {
    shape: '產生圓、多邊形、環、尖刺等基礎圖形',
    ramp: '線性漸層 — 拖尾淡出、方向遮罩必備',
    tileSampler: '網格陣列散佈圖案,大小/位置可隨機',
    splatterCircular: '沿圓環散佈圖案,可接自訂圖案輸入',
    shapeMapper: '把輸入圖案繞成環形陣列(魔法陣)',
    slashArc: '弧月斬擊 — 帶拖絲的弧形刀光',
    trailStrands: '拖尾絲束 — 多股擺動衰減的彗尾',
    boltGen: '閃電束 — 碎形折線主幹加分支',
    ringBolt: '環形電圈 — 閉合碎形電環加放電火花',
    magicCircle: '魔法陣 — 環、刻度、六芒星與咒文符文',
    perlin: '自然平滑的分形雜訊,扭曲的標準驅動源',
    cells: 'Voronoi 細胞雜訊 — 晶格、裂縫、色塊',
    warp: '用強度圖梯度推擠影像(火焰/閃電核心)',
    slopeBlur: '沿斜率圖梯度反覆位移取樣 — 裂縫擴張、侵蝕、融化',
    multiWarp: '多向扭曲 — Max 拉出飄絮拖絲、Min 收邊,風格化煙霧核心',
    autoLevels: '自動色階 — 把實際動態範圍拉滿,救回流失的對比',
    nonUniformBlur: '非均勻模糊 — 由半徑圖控制各處模糊量',
    swirl: '以中心為軸螺旋扭曲(火舌、氣流)',
    crossSection: '等高線 — 從灰階提取等高線亮帶(閃電/拖尾)',
    crossProfile: '剖面圖 — 掃描線亮度化為輪廓;實心/漸層/鏡像/線條四種樣式',
    transform: '縮放/旋轉/平移,可關閉拼貼',
    blend: '雙圖混合 — 減去挖空、取亮疊加、增值遮罩',
    histogramScan: '遮罩重映射 — 把柔和漸層掃成高對比硬邊輪廓',
    threshold: '閾值 — 硬切黑白,分離溫度層/精準遮罩(對比拉滿的掃描)',
    levels: '色階 — 黑白點與 Gamma 重新映射',
    brightContrast: '亮度對比 — 最直接的明暗與反差控制',
    curve: '色調曲線 — 五點控制暗部/中間調/亮部,做 S 曲線或反差',
    bandSelect: '亮度選帶 — 只保留某段灰階並拉伸回滿幅,挑亮度層做遮罩',
    colorAdjust: '色彩調整 — 上色後修色相/飽和/亮度/對比/透明度',
    invert: '反轉灰階',
    gaussianBlur: '高斯模糊 — X/Y 各軸倍率,可做方向性拉絲',
    blur: '高斯/方向/放射/旋轉模糊',
    bevel: '為扁平圖形加內斜角假厚度',
    distance: '距離場 — 搭配掃描把尖角變圓潤',
    blobField: '球體聯集高度場 — 卡通煙團/雲朵的骨架',
    celShade: '卡通打光 — 高度場硬切成 2~4 階平塗(終端線)',
    posterize: '色調分離 — 量化成 N 階平塗,卡通化任何素材',
    outline: '描邊 — 距離場取環帶,做卡通輪廓線',
    gradientMap: '灰階對應色帶上色(火/電/毒…)',
    glow: '模擬遊戲引擎 Bloom 發光',
    output: '最終輸出節點,匯出以此為準',
  };
  // 縮圖示範輸入(依節點特性挑選,讓效果一眼可辨)
  const DEMO_IN = {
    swirl: ['stripes'], transform: ['stripes'], blur: ['stripes'], gaussianBlur: ['perlin'],
    warp: ['stripes', 'perlin'], blend: ['stripes', 'blob'],
    slopeBlur: ['stripes', 'perlin'],
    multiWarp: ['blob', 'perlin'], autoLevels: ['perlin'], nonUniformBlur: ['stripes', 'perlin'],
    histogramScan: ['perlin'], crossSection: ['perlin'], crossProfile: ['perlin'],
    levels: ['perlin'], threshold: ['perlin'], gradientMap: ['perlin'], shapeMapper: ['spike'],
    brightContrast: ['perlin'], curve: ['perlin'], bandSelect: ['perlin'],
    distance: ['spike'], bevel: ['disc'],
    celShade: ['blob'], posterize: ['perlin'], outline: ['disc'],
  };
  // 縮圖示範參數覆寫(預設值看不出效果的節點)
  const DEMO_PARAMS = {
    transform: { rot: 25, sx: 0.75, sy: 0.75 },
    levels: { gamma: 2.6 },
    blur: { amount: 4 },
    gaussianBlur: { amount: 6, mulY: 0.08 },
    bevel: { radius: 10, curve: 1.4 },
    shapeMapper: { count: 10, r0: 0.3, r1: 0.8 },
    tileSampler: { size: 1.15, briRand: 0.5 },
    brightContrast: { contrast: 2.4 },
    curve: { p1: 0.08, p3: 0.92 },
    bandSelect: { lo: 0.35, hi: 0.7 },
    colorAdjust: { sat: 2.2, hue: 60 },
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
    return node;
  }

  function buildLibrary() {
    const wrap = document.getElementById('lib-list');
    const defaultHint = document.getElementById('hint').textContent;
    const byCat = {};
    for (const [type, def] of Object.entries(NodeDefs)) {
      (byCat[def.cat] = byCat[def.cat] || []).push([type, def]);
    }
    let html = `<input class="lib-search" id="lib-search" type="text" placeholder="${tr('🔍 搜尋節點…')}">`;
    for (const [cat, meta] of Object.entries(NodeCats)) {
      if (!byCat[cat] || meta.hidden) continue;
      html += `<div class="lib-group" data-cat="${cat}">
        <div class="lib-cat"><span class="tri">▾</span>${tr(meta.zh)}<span class="cnt">${byCat[cat].length}</span></div>`;
      for (const [type, def] of byCat[cat]) {
        html += `<div class="lib-item" data-type="${type}" data-search="${(def.title + ' ' + def.zh).toLowerCase()}"
          style="--nc:${meta.color}">
          <canvas class="lib-thumb" width="96" height="96"></canvas>
          <div class="lib-txt"><span class="nm">${def.title}</span><span class="zh">${window.APP_LANG === 'en' ? '' : def.zh}</span></div>
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
      row.innerHTML = `<div class="plabel"><span>${tr(p.label)}</span><span class="pval">${fmt(node.params[p.k])}</span></div>`;
      const pv = row.querySelector('.pval');
      pv.title = '點擊直接輸入數值';
      pv.addEventListener('click', () => {
        editValueInline(pv, node.params[p.k], p.min, p.max, p.t === 'i', v => {
          App.history.push();
          commit(v);
          showParams(node);            // 重繪整列讓滑桿同步
        });
      });
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
      row.innerHTML = `<div class="plabel"><span>${tr(p.label)}</span></div>`;
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
      row.innerHTML = `<label class="chk"><input type="checkbox" ${node.params[p.k] ? 'checked' : ''}> ${tr(p.label)}</label>`;
      row.querySelector('input').addEventListener('change', e => { App.history.push(); commit(e.target.checked, true); });
    } else if (p.t === 'seed') {
      row.innerHTML = `<div class="plabel"><span>${tr(p.label)}</span></div>`;
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
    nameEl.textContent = tr('✨ 模板控制');
    wrap.innerHTML = '';

    // ── 特效種類下拉(全部範本,依分類分組)──
    const pick = document.createElement('div');
    pick.className = 'prow macro-pick';
    pick.innerHTML = `<div class="plabel"><span>${tr('特效種類')}</span></div>`;
    const psel = document.createElement('select');
    for (const [catKey, catName] of Presets.cats) {
      const og = document.createElement('optgroup'); og.label = tr(catName);
      for (const [nm, meta] of Object.entries(Presets.meta)) {
        if (meta.cat !== catKey) continue;
        const o = document.createElement('option');
        o.value = nm; o.textContent = `${meta.emoji} ${window.APP_LANG === 'en' ? meta.en : meta.name}`;
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
    note.textContent = tr('以特效語言調整整條節點鏈;點任何節點可進入進階參數。');
    wrap.appendChild(note);

    // ── 巨集滑桿 ──
    for (const m of App.graph._macros) {
      const row = document.createElement('div');
      row.className = 'prow';
      const pct = v => Math.round(v * 100) + '%';
      row.innerHTML = `<div class="plabel"><span>${tr(m.label)}</span><span class="pval">${pct(m.value)}</span></div>`;
      const pv = row.querySelector('.pval');
      pv.title = '點擊直接輸入 0~100';
      pv.addEventListener('click', () => {
        editValueInline(pv, Math.round(m.value * 100), 0, 100, true, v => {
          App.history.push();
          m.value = v / 100;
          applyMacro(m);
          requestRender();
          showParams(null);
        });
      });
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
      const nStops = (GRADS[cur] ? GRADS[cur].stops.length : 0);
      row.innerHTML = `<div class="plabel"><span>${tr('🎨 配色 COLOR RAMP')}</span><span class="pval">${nStops} STOPS</span></div>`;
      const bar = document.createElement('div');
      bar.className = 'ramp-bar';
      const applyBar = key => {
        bar.style.background = rampCss(key);
        bar.dataset.label = rampLabel(key);
      };
      applyBar(cur);
      // 點色票 → 彈出全部色帶清單(每條都是漸層列)
      bar.addEventListener('click', () => {
        const old = row.querySelector('.ramp-pop');
        if (old) { old.remove(); return; }
        const pop = document.createElement('div');
        pop.className = 'ramp-pop';
        const applyKey = v => {
          App.history.push();
          for (const n of gmNodes) { n.params.preset = v; App.graph.markDirty(n.id); }
          applyBar(v);
          row.querySelector('.plabel .pval').textContent = (GRADS[v] ? GRADS[v].stops.length : 0) + ' STOPS';
          requestRender();
        };
        for (const [v] of pd.opts) {
          const it = document.createElement('div');
          it.className = 'ramp-item' + (v === gmNodes[0].params.preset ? ' on' : '');
          it.style.background = rampCss(v);
          it.dataset.label = rampLabel(v);
          // 動作鈕:內建 ⧉ 複製編輯;自訂 ✎ 編輯 / 🗑 刪除
          const acts = document.createElement('div');
          acts.className = 'ramp-acts';
          const isCustom = v.startsWith('u_');
          acts.innerHTML = isCustom ? '<button data-a="edit">✎</button><button data-a="del">🗑</button>'
                                    : '<button data-a="copy" title="以此為底建立自訂色帶">⧉</button>';
          acts.querySelectorAll('button').forEach(bt => bt.addEventListener('click', ev => {
            ev.stopPropagation();
            if (bt.dataset.a === 'del') { deleteRamp(v); pop.remove(); applyBar(gmNodes[0].params.preset); return; }
            openRampEditor(v, bt.dataset.a === 'edit' ? v : null, key => { applyKey(key); });
            pop.remove();
          }));
          it.appendChild(acts);
          it.addEventListener('click', ev => {
            ev.stopPropagation();
            applyKey(v);
            pop.querySelectorAll('.ramp-item').forEach(x => x.classList.remove('on'));
            it.classList.add('on');
            setTimeout(() => pop.remove(), 180);
          });
          pop.appendChild(it);
        }
        // 新增自訂色帶
        const add = document.createElement('div');
        add.className = 'ramp-item ramp-new';
        add.textContent = '＋ ' + tr('新增自訂色帶');
        add.addEventListener('click', ev => {
          ev.stopPropagation();
          openRampEditor(gmNodes[0].params.preset, null, key => applyKey(key));
          pop.remove();
        });
        pop.appendChild(add);
        row.appendChild(pop);
      });
      row.appendChild(bar);
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
      wrap.innerHTML = `<div class="params-empty">${tr('點選節點以編輯參數')}</div>`;
      nameEl.textContent = '';
      return;
    }
    const def = NodeDefs[node.type];
    nameEl.textContent = `${def.title} #${node.id}`;
    wrap.innerHTML = '';
    if (!def.params.length) {
      wrap.innerHTML = `<div class="params-empty">${tr('此節點沒有參數')}</div>`;
      return;
    }
    // 全部參數攤平顯示(套用 show 條件),不再摺疊進階區
    for (const p of def.params) {
      if (p.show && !p.show(node.params)) continue;
      wrap.appendChild(makeParamRow(node, p));
    }
  }

  // ---------- 範本縮圖牆 ----------
  let galleryBuilt = false;
  const galleryDone = new Set(); // 已渲染縮圖的範本

  function buildGallery() {
    const body = document.getElementById('gallery-body');
    const CAT_COLORS = { hit: '#ff6a4d', trail: '#4dc3ff', energy: '#ffab33', light: '#ffe14d', ringcat: '#b07dff', element: '#4dffa0', surface: '#8a97a8' };
    let html = '';
    for (const [catKey, catName] of Presets.cats) {
      const items = Object.entries(Presets.meta).filter(([, m]) => m.cat === catKey);
      if (!items.length) continue;
      html += `<div class="g-cat">${tr(catName)}</div><div class="g-grid">`;
      for (const [name, m] of items) {
        html += `<div class="g-card" data-preset="${name}" style="--gc:${CAT_COLORS[catKey] || 'var(--line)'}" title="載入「${m.name}」節點鏈">
          <canvas width="128" height="128"></canvas>
          <div class="g-name"><span>${m.emoji} ${window.APP_LANG === 'en' ? m.en : m.name}</span><span class="en">${window.APP_LANG === 'en' ? '' : m.en}</span></div></div>`;
      }
      html += '</div>';
    }
    let hasAuto = false;
    try { hasAuto = !!localStorage.getItem('texforge_autosave'); } catch (e) {}
    html += `<div class="g-cat">${tr('工作階段')}</div><div class="g-grid">`;
    if (hasAuto) {
      html += `<div class="g-card g-blank" data-preset="__autosave" title="載入自動存檔的節點圖">
        <div class="g-plus">⏪</div>
        <div class="g-name"><span>${tr('上次的工作')}</span><span class="en">${window.APP_LANG === 'en' ? '' : 'Autosave'}</span></div></div>`;
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

  // 範本縮圖共用快取:name → 128px canvas(範本牆與膠卷共用,只渲染一次)
  const thumbCache = new Map();
  function presetThumb(name) {
    if (thumbCache.has(name)) return thumbCache.get(name);
    const g = Presets.get(name);
    const out = g.findByType('output');
    const buf = g.evaluate(out.id, 128);
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
    ctx.drawImage(bufToCanvas(buf, 128), 0, 0, 128, 128);
    thumbCache.set(name, cv);
    return cv;
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
        const ctx = card.querySelector('canvas').getContext('2d');
        ctx.drawImage(presetThumb(name), 0, 0, 128, 128);
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
      <div class="cm-item" data-act="dup">${tr('📄 複製節點')}<span class="k">Ctrl+D</span></div>
      <div class="cm-item" data-act="disc">${tr('✂ 斷開所有連線')}</div>
      <div class="cm-item cm-danger" data-act="del">${tr('🗑 刪除節點')}<span class="k">Del</span></div>`;
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
  // connectFrom = { nodeId, out, portIdx }:從連接埠拖到空白處時傳入,選定後自動接線
  function showCanvasMenu(cx, cy, connectFrom) {
    const world = Editor.toWorld(cx, cy);
    const m = ctxMenuEl();
    let list = '';
    for (const [cat, meta] of Object.entries(NodeCats)) {
      if (meta.hidden) continue;
      for (const [type, def] of Object.entries(NodeDefs)) {
        if (def.cat !== cat) continue;
        // 從輸出口拖出 → 只列出「有輸入口」的節點
        if (connectFrom && connectFrom.out && !(def.inputs && def.inputs.length)) continue;
        list += `<div class="cm-item cm-node" data-type="${type}" data-search="${(def.title + ' ' + def.zh).toLowerCase()}">
          <span class="dot" style="background:${meta.color}"></span>${def.title}<span class="k">${window.APP_LANG === 'en' ? '' : def.zh}</span></div>`;
      }
    }
    m.innerHTML = `<input class="cm-search" type="text" placeholder="${tr(connectFrom ? '🔍 新增並自動連接…' : '🔍 新增節點於此…')}"><div class="cm-list">${list}</div>`;
    const search = m.querySelector('.cm-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      m.querySelectorAll('.cm-node').forEach(el => {
        el.style.display = (!q || el.dataset.search.includes(q)) ? '' : 'none';
      });
    });
    m.querySelectorAll('.cm-node').forEach(el => el.addEventListener('click', () => {
      const node = addNodeAt(el.dataset.type, world.x + 75, world.y + 66, false); // addNodeAt 會扣回節點半寬高
      if (connectFrom && node) {
        // Blend 預設接「背景」口:串鏈時原結果當底、前景留給新圖層(sub/normal 語意才正確)
        const inPort = node.type === 'blend' ? 1 : 0;
        if (connectFrom.out) App.graph.addLink(connectFrom.nodeId, node.id, inPort);
        else App.graph.addLink(node.id, connectFrom.nodeId, connectFrom.portIdx);
        Editor.drawWires();
        App.onGraphChanged();
      }
      closeMenu();
    }));
    // Enter 直接加入第一個符合的節點;Esc 關閉
    search.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        const first = [...m.querySelectorAll('.cm-node')].find(el => el.style.display !== 'none');
        if (first) { ev.preventDefault(); first.click(); }
      } else if (ev.key === 'Escape') closeMenu();
    });
    setTimeout(() => search.focus(), 0);
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

  // 匯出配方:目前圖的節點(含調整後參數)/連線/模板滑桿 → presets.js 規格文字
  // 只輸出與預設值不同的參數,貼回 SPECS 即可成為新範本
  function exportRecipe() {
    const g = App.graph;
    const key = id => 'n' + id;
    const fmtV = v => typeof v === 'string' ? "'" + v + "'"
      : typeof v === 'boolean' ? String(v)
      : String(Math.round(v * 1000) / 1000);
    const lines = [];
    lines.push('    ' + (g._presetName || 'myPreset') + '_custom: {');
    lines.push('      nodes: [');
    for (const n of g.nodes.values()) {
      const def = NodeDefs[n.type];
      const diff = def.params
        .filter(p => n.params[p.k] !== p.def)
        .map(p => p.k + ': ' + fmtV(n.params[p.k]));
      lines.push("        ['" + key(n.id) + "', '" + n.type + "', " + Math.round(n.x) + ', ' + Math.round(n.y)
        + (diff.length ? ', { ' + diff.join(', ') + ' }' : '') + '],');
    }
    lines.push('      ],');
    lines.push('      links: [');
    lines.push('        ' + g.links.map(l =>
      "['" + key(l.from) + "', '" + key(l.to) + "'" + (l.toPort ? ', ' + l.toPort : '') + ']').join(', '));
    lines.push('      ],');
    if (g._macros && g._macros.length) {
      lines.push('      macros: [');
      for (const m of g._macros) {
        const t = m.targets.map(x => "['" + key(x.id) + "', '" + x.param + "', " + x.pmin + ', ' + x.pmax + ']').join(', ');
        lines.push("        { label: '" + m.label + "', def: " + Math.round(m.value * 100) / 100 + ', targets: [' + t + '] },');
      }
      lines.push('      ],');
    }
    lines.push('    },');
    // 自訂色帶:附上色標資料,配方貼到別處也能重建
    for (const n of g.nodes.values()) {
      if (n.type === 'gradientMap' && n.params.preset && n.params.preset.startsWith('u_') && GRADS[n.params.preset]) {
        const gr = GRADS[n.params.preset];
        lines.push('    // 自訂色帶 ' + n.params.preset + ' (' + gr.zh.replace('🎨 ', '') + '): ' + JSON.stringify(gr.raw || rampToHexStops(n.params.preset)));
      }
    }
    const text = lines.join('\n');
    console.log(text);
    const btn = document.getElementById('btn-recipe');
    const done = copied => {
      if (!copied) download('vfxgen_recipe.txt', new Blob([text], { type: 'text/plain' }));
      if (btn) { const old = btn.textContent; btn.textContent = copied ? '已複製 ✓' : '已下載 ✓'; setTimeout(() => { btn.textContent = old; }, 1600); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    } else done(false);
  }

  // 精簡模式把「輸出解析度 + 匯出按鈕」移到預覽下方;進階模式移回頂列
  function placeExportControls(advanced) {
    const lb = document.getElementById('lb-export');
    const res = document.getElementById('export-res');
    const btn = document.getElementById('btn-export');
    if (advanced) {
      const anchor = document.getElementById('btn-recipe');
      anchor.parentNode.insertBefore(lb, anchor);
      anchor.parentNode.insertBefore(res, anchor);
      anchor.parentNode.insertBefore(btn, document.getElementById('btn-settings'));
    } else {
      const bar = document.getElementById('export-bar');
      bar.appendChild(lb); bar.appendChild(res); bar.appendChild(btn);
    }
  }

  // 數值點擊直接輸入(參數與模板滑桿共用)
  function editValueInline(pvalEl, current, min, max, isInt, apply) {
    if (pvalEl.querySelector('input')) return;
    const old = pvalEl.textContent;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'pval-edit';
    inp.min = min; inp.max = max; inp.step = isInt ? 1 : 'any';
    inp.value = current;
    pvalEl.textContent = ''; pvalEl.appendChild(inp);
    inp.focus(); inp.select();
    let done = false;
    const finish = ok => {
      if (done) return; done = true;
      if (ok && inp.value !== '') {
        let v = +inp.value;
        if (!isNaN(v)) {
          v = Math.max(min, Math.min(max, v));
          if (isInt) v = Math.round(v);
          apply(v);
          return;                      // apply 端負責重繪列
        }
      }
      pvalEl.textContent = old;
    };
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') finish(true);
      else if (ev.key === 'Escape') finish(false);
      ev.stopPropagation();
    });
    inp.addEventListener('blur', () => finish(true));
  }

  // ---------- 範本膠卷(底部 Template Reel) ----------
  const reelDone = new Set();
  function buildReel() {
    const wrap = document.getElementById('reel-cards');
    const cats = document.getElementById('reel-cats');
    if (!wrap) return;
    // 分類籤:全部 + 各分類(取「/」前的短名)
    let ch = `<button class="on" data-cat="">${tr('全部')}</button>`;
    for (const [key, name] of Presets.cats) {
      ch += `<button data-cat="${key}">${tr(name).split('/')[0].trim()}</button>`;
    }
    cats.innerHTML = ch;
    cats.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      cats.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const cat = b.dataset.cat;
      wrap.querySelectorAll('.r-card').forEach(c => {
        c.style.display = (!cat || c.dataset.cat === cat) ? '' : 'none';
      });
      renderReelThumbs();
    }));
    // 卡片(依分類順序)
    let html = '';
    for (const [catKey] of Presets.cats) {
      for (const [name, m] of Object.entries(Presets.meta)) {
        if (m.cat !== catKey) continue;
        html += `<div class="r-card" data-preset="${name}" data-cat="${catKey}">
          <canvas width="128" height="128"></canvas>
          <div class="n">${m.emoji} ${window.APP_LANG === 'en' ? m.en : m.name}</div>
          <div class="e">${window.APP_LANG === 'en' ? m.name : m.en}</div></div>`;
      }
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('.r-card').forEach(el => el.addEventListener('click', () => {
      App.history.push();
      setGraph(Presets.get(el.dataset.preset));
      Editor.fitView();
    }));
    // 左鍵按住拖曳滑動膠卷(位移 >6px 視為拖曳,放開時攔下 click 不觸發載入)
    let dragging = false;
    wrap.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const startX = e.clientX, startSL = wrap.scrollLeft;
      dragging = false;
      const mv = ev => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 6) { dragging = true; wrap.classList.add('dragging'); }
        if (dragging) wrap.scrollLeft = startSL - dx;
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        wrap.classList.remove('dragging');
        if (dragging) setTimeout(() => { dragging = false; }, 0);   // 讓 click 攔截器先讀到
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    wrap.addEventListener('click', e => {
      if (dragging) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    // 收合(記住狀態)
    const strip = document.getElementById('strip');
    const tg = document.getElementById('strip-toggle');
    const applyClosed = c => {
      strip.classList.toggle('closed', c);
      tg.textContent = c ? '▴' : '▾';
      try { localStorage.setItem('texforge_reel', c ? '1' : '0'); } catch (e) {}
    };
    tg.addEventListener('click', () => applyClosed(!strip.classList.contains('closed')));
    try {
      const saved = localStorage.getItem('texforge_reel');
      if (saved === '1') applyClosed(true);
      else if (saved === null && matchMedia('(max-width:700px) and (pointer:coarse), (max-width:480px)').matches) {
        applyClosed(true);   // 手機首次載入預設收合,參數區才放得下;點 ▴ 展開
      }
    } catch (e) {}
  }
  // 逐張渲染可見卡片(共用 presetThumb 快取)
  function renderReelThumbs() {
    const cards = [...document.querySelectorAll('#reel-cards .r-card')]
      .filter(c => c.style.display !== 'none' && !reelDone.has(c.dataset.preset));
    let i = 0;
    const step = () => {
      if (i >= cards.length) return;
      const card = cards[i++];
      const name = card.dataset.preset;
      try {
        card.querySelector('canvas').getContext('2d').drawImage(presetThumb(name), 0, 0, 128, 128);
        reelDone.add(name);
      } catch (err) { console.error('膠卷縮圖渲染失敗:', name, err); }
      setTimeout(step, 0);
    };
    step();
  }
  // 目前載入的範本 → 膠卷高亮
  function reelSync() {
    const name = App.graph._presetName;
    document.querySelectorAll('#reel-cards .r-card').forEach(c =>
      c.classList.toggle('on', c.dataset.preset === name));
  }

  function setGraph(g) {
    App.graph = g;
    Editor.select(null);
    Editor.rebuild();
    requestRender();
    reelSync();
  }

  // ---------- 初始化 ----------
  function init() {
    previewCv = document.getElementById('preview');
    previewCtx = previewCv.getContext('2d');
    perfEl = document.getElementById('perf');
    initTheme();
    applyStaticLang();
    loadCustomRamps();
    buildReel();
    initSimpleResizes();
    setTimeout(renderReelThumbs, 400);   // 等首個範本渲染完成再背景鋪縮圖
    initPanelToggles();
    const smBtn = document.getElementById('btn-settings');
    const sm = document.getElementById('settings-menu');
    smBtn.addEventListener('click', e => { e.stopPropagation(); sm.classList.toggle('hidden'); });
    document.addEventListener('click', e => {
      if (!sm.classList.contains('hidden') && !sm.contains(e.target)) sm.classList.add('hidden');
    });
    const langSel = document.getElementById('lang-select');
    if (langSel) {
      langSel.value = window.APP_LANG;
      langSel.addEventListener('change', () => {
        try { localStorage.setItem('texforge_lang', langSel.value); } catch (e) {}
        location.reload();   // 全頁重繪最穩,節點圖由自動存檔恢復
      });
    }
    initInspectorResize();
    buildLibrary();

    document.getElementById('preview-res').addEventListener('change', () => {
      App.graph.markAllDirty(); requestRender();
    });
    document.getElementById('preview-bg').addEventListener('change', requestRender);
    document.getElementById('preview-tile').addEventListener('change', requestRender);
    document.getElementById('btn-export').addEventListener('click', exportPNG);
    document.getElementById('btn-recipe').addEventListener('click', exportRecipe);

    // 範本牆 & 變體
    document.getElementById('btn-gallery').addEventListener('click', openGallery);

    // 精簡 / 進階模式切換
    const modeBtn = document.getElementById('btn-mode');
    function setMode(advanced) {
      const app = document.getElementById('app');
      app.classList.toggle('simple', !advanced);
      modeBtn.classList.toggle('on', advanced);
      placeExportControls(advanced);
      modeBtn.textContent = tr(advanced ? '🎛 精簡' : '🔧 進階');
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
    else placeExportControls(false);   // 初始即精簡模式:匯出鈕直接就定位到預覽下方
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
