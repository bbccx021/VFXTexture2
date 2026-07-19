'use strict';
/* ============================================================
   presets.js — 內建範本節點圖
   spec: { nodes: [key, type, x, y, params], links: [[from, to, port]] }
   ============================================================ */

const Presets = (() => {

  function build(spec) {
    const g = new NodeGraph();
    const map = {};
    for (const [key, type, x, y, params] of spec.nodes) {
      const n = g.addNode(type, x, y);
      if (params) Object.assign(n.params, params);
      map[key] = n.id;
    }
    for (const [f, t, p] of spec.links) g.addLink(map[f], map[t], p || 0);
    // 模板巨集:{ label, def(0..1), targets:[[節點key, 參數, 最小值, 最大值]] }
    // 滑桿 0..1 線性映射到每個目標參數的 [pmin, pmax]
    if (spec.macros) {
      g._macros = spec.macros.map(m => ({
        label: m.label, value: m.def,
        targets: m.targets.map(([key, param, pmin, pmax]) => ({ id: map[key], param, pmin, pmax })),
      }));
    }
    return g;
  }

  const SPECS = {

    // 🔥 火焰:柔邊圓 → 柏林雜訊方向扭曲(往上) → 漩渦 → 直方圖掃描 → 火焰漸層 → 發光
    fire: {
      nodes: [
        ['base', 'shape', 40, 40, { type: 'spike', size: 0.92, width: 1.15, falloff: 0.4, soft: 0.08 }],
        ['str', 'transform', 230, 40, { sx: 1, sy: 0.92, oy: 0.03, tiling: false }],
        ['nz', 'perlin', 230, 260, { scale: 4, octaves: 2, seed: 11 }],   // 低頻:卡通不要細碎雜訊
        ['wp', 'warp', 420, 130, { mode: 'grad', intensity: 5 }],         // 擾動出火舌
        ['sc', 'histogramScan', 610, 130, { pos: 0.4, contrast: 0.92 }],  // 硬邊剪影
        ['iv1', 'invert', 800, 130, {}],
        ['dst', 'distance', 990, 130, { dist: 0.14, curve: 1 }],
        ['iv2', 'invert', 1180, 130, {}],                                  // ↑三連 = 內距離場(中心亮)
        ['po', 'posterize', 1370, 130, { levels: 4, soft: 0 }],            // 同心平塗色帶
        ['grad', 'gradientMap', 1560, 130, { preset: 'fire', steps: 4 }],
        ['out', 'output', 1750, 130],
      ],
      links: [
        ['base', 'str'],
        ['str', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['iv2', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '火舌擾動', def: 0.44, targets: [['wp', 'intensity', 1, 7]] },
        { label: '火焰高度', def: 0.5, targets: [['str', 'sy', 1, 1.7]] },
        { label: '輪廓緊實', def: 0.9, targets: [['sc', 'contrast', 0.5, 0.98]] },
        { label: '色帶層數', def: 0.33, targets: [['po', 'levels', 2, 8]] },
        { label: '核心大小', def: 0.5, targets: [['dst', 'dist', 0.06, 0.24]] },
      ],
    },

    // ⚡ 閃電:柏林雜訊先被晶格雜訊扭曲出銳利折點 → 再等高線提取連續閃電亮線 → 電光漸層 → 發光
    lightning: {
      nodes: [
        ['noise', 'perlin', 40, 40, { scale: 2, octaves: 2, seed: 21 }],
        ['cells', 'cells', 40, 260, { mode: 'crystal', scale: 12, seed: 9 }],
        ['warp', 'warp', 250, 130, { mode: 'grad', intensity: 0.7 }],
        // 外層電光束(粗)
        ['xsec', 'crossSection', 460, 40, { pos: 0.5, width: 0.05, curve: 1 }],
        ['sc', 'histogramScan', 650, 40, { pos: 0.5, contrast: 0.88 }],
        ['lv', 'levels', 840, 40, { outHi: 0.55 }],                       // 壓成中階藍
        // 內層亮核(細)
        ['xsec2', 'crossSection', 460, 300, { pos: 0.5, width: 0.017, curve: 1 }],
        ['sc2', 'histogramScan', 650, 300, { pos: 0.5, contrast: 0.9 }],
        ['mx', 'blend', 1030, 170, { mode: 'max' }],                       // 白核疊在藍身上
        ['grad', 'gradientMap', 1220, 170, { preset: 'electric', steps: 3 }],
        ['out', 'output', 1410, 170],
      ],
      links: [
        ['noise', 'warp', 0], ['cells', 'warp', 1],
        ['warp', 'xsec'], ['xsec', 'sc'], ['sc', 'lv'],
        ['warp', 'xsec2'], ['xsec2', 'sc2'],
        ['sc2', 'mx', 0], ['lv', 'mx', 1],
        ['mx', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '扭折強度', def: 0.36, targets: [['warp', 'intensity', 0.2, 1.6]] },
        { label: '分支密度', def: 0.43, targets: [['cells', 'scale', 6, 20]] },
        { label: '閃電粗細', def: 0.35, targets: [['xsec', 'width', 0.04, 0.18]] },
        { label: '亮核粗細', def: 0.3, targets: [['xsec2', 'width', 0.012, 0.08]] },
      ],
    },

    // 💥 打擊爆閃:環狀尖刺 + 放射模糊 + 中心高斯光核取亮 → 聖金漸層 → 發光
    burst: {
      nodes: [
        ['spikes', 'splatterCircular', 40, 40, { pattern: 'spike', count: 16, radius: 0.24, size: 0.3, width: 0.22, sizeRand: 0.55, seed: 4 }],
        ['zoom', 'blur', 250, 40, { mode: 'zoom', amount: 3 }],
        ['core', 'shape', 250, 260, { type: 'gauss', size: 0.55 }],
        ['mix', 'blend', 460, 130, { mode: 'max' }],
        ['grad', 'gradientMap', 670, 130, { preset: 'gold', steps: 4 }],
        ['glow', 'glow', 880, 130, { threshold: 0.45, radius: 7, intensity: 1.4 }],
        ['out', 'output', 1090, 130],
      ],
      links: [
        ['spikes', 'zoom'], ['core', 'mix', 0], ['zoom', 'mix', 1],
        ['mix', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.35, targets: [['spikes', 'count', 8, 28]] },
        { label: '放射拉絲', def: 0.4, targets: [['zoom', 'amount', 1, 6]] },
        { label: '光核大小', def: 0.5, targets: [['core', 'size', 0.3, 0.8]] },
        { label: '光暈強度', def: 0.42, targets: [['glow', 'intensity', 0.6, 2.5]] },
      ],
    },

    // 🪄 魔法陣:外環 + 環形映射尖刺 + 內環 疊加 → 奧術漸層 → 發光
    magic: {
      nodes: [
        ['ring1', 'shape', 40, 40, { type: 'ring', size: 1.25, width: 0.1, soft: 0.015 }],
        ['pat', 'shape', 40, 260, { type: 'spike', size: 0.85, width: 0.6, falloff: 1, soft: 0.03 }],
        ['mapper', 'shapeMapper', 250, 260, { count: 12, r0: 0.5, r1: 0.82, flip: true }],
        ['ring2', 'shape', 250, 480, { type: 'ring', size: 0.62, width: 0.06, soft: 0.012 }],
        ['mix1', 'blend', 460, 130, { mode: 'max' }],
        ['mix2', 'blend', 670, 200, { mode: 'max' }],
        ['grad', 'gradientMap', 880, 200, { preset: 'arcane', steps: 4 }],
        ['glow', 'glow', 1090, 200, { threshold: 0.3, radius: 4, intensity: 1.6 }],
        ['out', 'output', 1300, 200],
      ],
      links: [
        ['ring1', 'mix1', 0], ['pat', 'mapper'], ['mapper', 'mix1', 1],
        ['ring2', 'mix2', 0], ['mix1', 'mix2', 1],
        ['mix2', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '符文數量', def: 0.33, targets: [['mapper', 'count', 6, 24]] },
        { label: '外環大小', def: 0.78, targets: [['ring1', 'size', 0.9, 1.35]] },
        { label: '內環大小', def: 0.49, targets: [['ring2', 'size', 0.4, 0.85]] },
        { label: '光暈強度', def: 0.42, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 💢 碎裂衝擊(1MaFX Impact 工作流):
    // ① 三角形被兩顆圓 Subtract 雕成風格化尖刺
    // ② 尖刺餵入 Splatter Circular 的 Pattern Image 環狀陣列 ×5 → 圓形挖空中心
    // ③ Cells → Histogram Scan 高對比碎塊 → 圓形 Multiply 限制範圍 → Subtract 打碎尖刺
    // ④ 圓形被 Perlin 扭曲 → 減去小圓 → 不規則內環 → Max 疊回主圖
    // ⑤ Blur 作為引擎 Bloom 基礎;下方懸掛分支:Distance → Histogram Scan → Blur = 柔軟圓潤替代版
    impact: {
      nodes: [
        // ── 第一階段:雕刻單一尖刺 ──
        ['tri', 'shape', 40, 40, { type: 'poly', sides: 3, size: 0.62, soft: 0.01, rot: -90 }],
        ['t1', 'transform', 230, 40, { sx: 0.55, sy: 1.15, tiling: false }],
        ['c1', 'shape', 40, 260, { type: 'disc', size: 0.62, soft: 0.008 }],
        ['ct1', 'transform', 230, 260, { ox: 0.34, oy: 0.3, tiling: false }],
        ['ct2', 'transform', 230, 480, { ox: -0.34, oy: 0.3, tiling: false }],
        ['b1', 'blend', 420, 130, { mode: 'sub' }],
        ['b2', 'blend', 610, 130, { mode: 'sub' }],
        // ── 第二階段:環狀陣列 + 挖空中心 ──
        ['splat', 'splatterCircular', 800, 40, { count: 5, radius: 0.26, size: 0.3, width: 1, sizeRand: 0.3, radJitter: 0.25, angJitter: 0.1, rotOff: -90, seed: 3 }],
        ['hole', 'shape', 800, 260, { type: 'disc', size: 0.36, soft: 0.01 }],
        ['bh', 'blend', 990, 130, { mode: 'sub' }],
        // ── 第三階段:雜訊打碎 ──
        ['cells', 'cells', 610, 430, { mode: 'f1', scale: 9, seed: 5 }],
        ['cscan', 'histogramScan', 800, 430, { pos: 0.62, contrast: 0.95 }],
        ['cmask', 'shape', 800, 650, { type: 'blob', size: 1.2, falloff: 0.5 }],
        ['cm', 'blend', 990, 500, { mode: 'mul' }],
        ['bsub', 'blend', 1180, 130, { mode: 'sub' }],
        // ── 第四階段:內部扭曲波紋環 ──
        ['ic', 'shape', 990, 720, { type: 'disc', size: 0.5, soft: 0.015 }],
        ['ip', 'perlin', 990, 940, { scale: 5, octaves: 3, seed: 8 }],
        ['iw', 'warp', 1180, 800, { mode: 'grad', intensity: 4.5 }],
        ['ih', 'shape', 1180, 1020, { type: 'disc', size: 0.36, soft: 0.015 }],
        ['iring', 'blend', 1370, 860, { mode: 'sub' }],
        ['merge', 'blend', 1370, 130, { mode: 'add' }], // 教學為 Linear Dodge (Add)
        // ── 第五階段:柔化收尾 ──
        ['fblur', 'blur', 1560, 130, { mode: 'gauss', amount: 0.5 }],
        ['out', 'output', 1750, 130],
        // ── 替代分支:柔軟圓潤版(點選預覽)──
        ['sdist', 'distance', 1560, 360, { dist: 0.16, curve: 1 }],
        ['sscan', 'histogramScan', 1750, 360, { pos: 0.52, contrast: 0.55 }],
        ['sblur', 'blur', 1940, 360, { mode: 'gauss', amount: 1 }],
      ],
      links: [
        ['tri', 't1'], ['c1', 'ct1'], ['c1', 'ct2'],
        ['ct1', 'b1', 0], ['t1', 'b1', 1],
        ['ct2', 'b2', 0], ['b1', 'b2', 1],
        ['b2', 'splat'],
        ['hole', 'bh', 0], ['splat', 'bh', 1],
        ['cells', 'cscan'], ['cscan', 'cm', 0], ['cmask', 'cm', 1],
        ['cm', 'bsub', 0], ['bh', 'bsub', 1],
        ['ic', 'iw', 0], ['ip', 'iw', 1],
        ['ih', 'iring', 0], ['iw', 'iring', 1],
        ['iring', 'merge', 0], ['bsub', 'merge', 1],
        ['merge', 'fblur'], ['fblur', 'out'],
        ['merge', 'sdist'], ['sdist', 'sscan'], ['sscan', 'sblur'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.33, targets: [['splat', 'count', 3, 9]] },
        { label: '尖刺長度', def: 0.5, targets: [['splat', 'size', 0.18, 0.42]] },
        { label: '中心空洞', def: 0.47, targets: [['hole', 'size', 0.15, 0.6]] },
        { label: '破碎程度', def: 1, targets: [['bsub', 'opacity', 0, 1]] },
        { label: '柔化收尾', def: 0.17, targets: [['fblur', 'amount', 0, 3]] },
      ],
    },

    // ➰ 一般拖尾:高斯光核橫向拉伸 → Ramp 淡出尾端 → 拉絲雜訊增值 → 灰階輸出(引擎內自行染色)
    trail: {
      nodes: [
        ['core', 'shape', 40, 40, { type: 'gauss', size: 1.35 }],
        ['stretch', 'transform', 230, 40, { sx: 2.2, sy: 0.42, tiling: false }],
        ['fade', 'ramp', 230, 260, { angle: 0, start: 0.02, end: 0.95, curve: 1.3 }],
        ['fm', 'blend', 420, 130, { mode: 'mul' }],
        ['nz', 'perlin', 230, 480, { scale: 6, octaves: 4, seed: 14 }],
        ['nstr', 'transform', 420, 480, { sx: 3, sy: 1 }],
        ['nm', 'blend', 610, 260, { mode: 'mul', opacity: 0.35 }],
        ['lv', 'levels', 800, 260, { inLo: 0.02, inHi: 0.52, gamma: 0.85 }],
        ['out', 'output', 990, 260],
      ],
      links: [
        ['core', 'stretch'],
        ['fade', 'fm', 0], ['stretch', 'fm', 1],
        ['nz', 'nstr'], ['nstr', 'nm', 0], ['fm', 'nm', 1],
        ['nm', 'lv'], ['lv', 'out'],
      ],
      macros: [
        { label: '拖尾長度', def: 0.35, targets: [['stretch', 'sx', 1.2, 3.2]] },
        { label: '拖尾粗細', def: 0.33, targets: [['stretch', 'sy', 0.3, 0.9]] },
        { label: '淡出位置', def: 0.83, targets: [['fade', 'end', 0.7, 1]] },
        { label: '拉絲雜訊', def: 0.56, targets: [['nm', 'opacity', 0, 0.9]] },
      ],
    },

    // 🎗 風格化拖尾:柔邊橫帶 → 拉絲雜訊扭曲 → Ramp 淡出 → 直方圖掃描硬邊 → 寒冰漸層
    stylizedTrail: {
      nodes: [
        ['band', 'shape', 40, 40, { type: 'blob', size: 1.3, falloff: 1 }],
        ['bandT', 'transform', 230, 40, { sx: 2.4, sy: 0.42, tiling: false }],
        ['nz', 'perlin', 40, 260, { scale: 6, octaves: 4, seed: 27 }],
        ['nstr', 'transform', 230, 260, { sx: 3, sy: 1 }],
        ['wp', 'warp', 420, 130, { mode: 'grad', intensity: 2.5 }],
        ['fade', 'ramp', 420, 350, { angle: 0, start: 0.02, end: 0.9, curve: 1.3 }],
        ['fm', 'blend', 610, 220, { mode: 'mul' }],
        ['sc', 'histogramScan', 800, 220, { pos: 0.45, contrast: 0.85 }],
        ['grad', 'gradientMap', 990, 220, { preset: 'ice', steps: 4 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['band', 'bandT'], ['nz', 'nstr'],
        ['bandT', 'wp', 0], ['nstr', 'wp', 1],
        ['fade', 'fm', 0], ['wp', 'fm', 1],
        ['fm', 'sc'], ['sc', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '拖尾長度', def: 0.4, targets: [['bandT', 'sx', 1.6, 3.6]] },
        { label: '扭曲拉絲', def: 0.57, targets: [['wp', 'intensity', 0.5, 4]] },
        { label: '淡出位置', def: 0.72, targets: [['fade', 'end', 0.7, 1]] },
        { label: '輪廓緊實', def: 0.78, targets: [['sc', 'contrast', 0.5, 0.95]] },
      ],
    },

    // 🔆 鏡頭光暈:光核 + 十字星芒(橫/縱拉伸)+ 放射光條 + 外圈光暈 → 寒冰漸層 → 發光
    lens: {
      nodes: [
        ['core', 'shape', 40, 40, { type: 'gauss', size: 0.5 }],
        ['streak', 'shape', 40, 260, { type: 'gauss', size: 0.9 }],
        ['sh', 'transform', 230, 260, { sx: 3.2, sy: 0.12, tiling: false }],
        ['sv', 'transform', 230, 480, { sx: 2, sy: 0.1, rot: 90, tiling: false }],
        ['mx1', 'blend', 420, 130, { mode: 'max' }],
        ['mx2', 'blend', 610, 200, { mode: 'max', opacity: 0.75 }],
        ['sp', 'splatterCircular', 420, 480, { pattern: 'streak', count: 8, radius: 0.1, size: 0.38, width: 0.15, sizeRand: 0.6, angJitter: 0.4, seed: 5 }],
        ['mx3', 'blend', 800, 270, { mode: 'max', opacity: 0.8 }],
        ['halo', 'shape', 800, 480, { type: 'ring', size: 1.35, width: 0.06, soft: 0.25 }],
        ['ad', 'blend', 990, 340, { mode: 'add', opacity: 0.3 }],
        ['grad', 'gradientMap', 1180, 340, { preset: 'ice', steps: 4 }],
        ['glow', 'glow', 1370, 340, { threshold: 0.35, radius: 6, intensity: 1.6 }],
        ['out', 'output', 1560, 340],
      ],
      links: [
        ['streak', 'sh'], ['streak', 'sv'],
        ['sh', 'mx1', 0], ['core', 'mx1', 1],
        ['sv', 'mx2', 0], ['mx1', 'mx2', 1],
        ['sp', 'mx3', 0], ['mx2', 'mx3', 1],
        ['halo', 'ad', 0], ['mx3', 'ad', 1],
        ['ad', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '光核大小', def: 0.4, targets: [['core', 'size', 0.3, 0.8]] },
        { label: '星芒長度', def: 0.48, targets: [['sh', 'sx', 2, 4.5]] },
        { label: '放射光條', def: 0.4, targets: [['sp', 'count', 4, 14]] },
        { label: '外圈光暈', def: 0.58, targets: [['halo', 'size', 1, 1.6]] },
        { label: '光暈強度', def: 0.5, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 🕸 裂縫:細胞裂縫雜訊 → 柏林梯度扭曲(有機化)→ 圓形遮罩 → 直方圖掃描 → 餘燼漸層(熔岩裂縫)
    cracks: {
      nodes: [
        ['cr', 'cells', 40, 40, { mode: 'edge', scale: 7, contrast: 1.2, seed: 12 }],
        ['nz', 'perlin', 40, 260, { scale: 4, octaves: 3, seed: 6 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 1.2 }],
        ['mask', 'shape', 230, 350, { type: 'blob', size: 1.25, falloff: 0.8 }],
        ['mm', 'blend', 420, 220, { mode: 'mul' }],
        ['sc', 'histogramScan', 610, 220, { pos: 0.55, contrast: 0.7 }],
        ['grad', 'gradientMap', 800, 220, { preset: 'ember', steps: 4 }],
        ['glow', 'glow', 990, 220, { threshold: 0.35, radius: 4, intensity: 1.6 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['cr', 'wp', 0], ['nz', 'wp', 1],
        ['mask', 'mm', 0], ['wp', 'mm', 1],
        ['mm', 'sc'], ['sc', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '裂縫密度', def: 0.3, targets: [['cr', 'scale', 4, 14]] },
        { label: '有機扭曲', def: 0.38, targets: [['wp', 'intensity', 0.4, 2.5]] },
        { label: '範圍大小', def: 0.56, targets: [['mask', 'size', 0.8, 1.6]] },
        { label: '輪廓緊實', def: 0.66, targets: [['sc', 'contrast', 0.3, 0.9]] },
        { label: '光暈強度', def: 0.5, targets: [['glow', 'intensity', 0.5, 2.5]] },
      ],
    },

    // ⭕ 環狀衝擊波:圓環被柏林扭曲(波動)→ 放射模糊 → 疊內圈餘波 → 灰階輸出(引擎內染色)
    ring: {
      nodes: [
        ['ring', 'shape', 40, 40, { type: 'ring', size: 1, width: 0.12, soft: 0.05 }],
        ['nz', 'perlin', 40, 260, { scale: 6, octaves: 3, seed: 19 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 1.5 }],
        ['zb', 'blur', 420, 130, { mode: 'zoom', amount: 4 }],
        ['ring2', 'shape', 420, 350, { type: 'ring', size: 0.58, width: 0.04, soft: 0.14 }],
        ['ad', 'blend', 610, 220, { mode: 'add', opacity: 0.6 }],
        ['lv', 'levels', 800, 220, { inHi: 0.68 }],
        ['out', 'output', 990, 220],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'zb'],
        ['ring2', 'ad', 0], ['zb', 'ad', 1],
        ['ad', 'lv'], ['lv', 'out'],
      ],
      macros: [
        { label: '波動強度', def: 0.36, targets: [['wp', 'intensity', 0.5, 3]] },
        { label: '環厚度', def: 0.42, targets: [['ring', 'width', 0.06, 0.25]] },
        { label: '放射殘影', def: 0.44, targets: [['zb', 'amount', 0.5, 5]] },
        { label: '餘波亮度', def: 0.56, targets: [['ad', 'opacity', 0, 0.8]] },
        { label: '整體亮度', def: 0.3, targets: [['lv', 'inHi', 1, 0.5]] },
      ],
    },

    // 🚀 投射物:光核偏右為彈頭 → 同源拉伸+方向模糊+Ramp 淡出為尾焰 → 取亮合併 → 劇毒漸層
    projectile: {
      nodes: [
        ['head', 'shape', 40, 40, { type: 'gauss', size: 0.6 }],
        ['hoff', 'transform', 230, 40, { ox: 0.28, tiling: false }],
        ['tail', 'transform', 230, 260, { sx: 3.2, sy: 0.5, ox: -0.05, tiling: false }],
        ['tb', 'blur', 420, 260, { mode: 'dir', angle: 0, amount: 10 }],
        ['fade', 'ramp', 420, 480, { angle: 0, start: 0.12, end: 1, curve: 1 }],
        ['fm', 'blend', 610, 350, { mode: 'mul' }],
        ['mx', 'blend', 800, 130, { mode: 'max' }],
        ['lv', 'levels', 990, 130, { gamma: 0.8 }],
        ['grad', 'gradientMap', 1180, 130, { preset: 'toxic', steps: 4 }],
        ['glow', 'glow', 1370, 130, { threshold: 0.4, radius: 5, intensity: 1.5 }],
        ['out', 'output', 1560, 130],
      ],
      links: [
        ['head', 'hoff'], ['head', 'tail'],
        ['tail', 'tb'],
        ['fade', 'fm', 0], ['tb', 'fm', 1],
        ['fm', 'mx', 0], ['hoff', 'mx', 1],
        ['mx', 'lv'], ['lv', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '彈頭大小', def: 0.4, targets: [['head', 'size', 0.4, 0.9]] },
        { label: '尾焰長度', def: 0.44, targets: [['tail', 'sx', 1.4, 3.2]] },
        { label: '尾焰模糊', def: 0.45, targets: [['tb', 'amount', 3, 14]] },
        { label: '尾焰淡出', def: 0.67, targets: [['fade', 'end', 0.7, 1]] },
        { label: '光暈強度', def: 0.38, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 🔳 規則圖騰:網格圓點陣列 + 柏林等高線重複條紋 → 取亮疊合 → 無縫可平鋪圖案
    pattern: {
      nodes: [
        ['dots', 'tileSampler', 40, 40, { pattern: 'gauss', count: 8, size: 0.62, sizeRand: 0, posRand: 0, briRand: 0, coverage: 1, seed: 2 }],
        ['topo', 'perlin', 40, 260, { scale: 4, octaves: 3, seed: 33 }],
        ['bands', 'crossSection', 230, 260, { pos: 0.5, width: 0.24, repeat: 8, curve: 1.4 }],
        ['mx', 'blend', 420, 130, { mode: 'max', opacity: 0.7 }],
        ['lv', 'levels', 610, 130, { inHi: 0.85, gamma: 1.1 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['topo', 'bands'],
        ['bands', 'mx', 0], ['dots', 'mx', 1],
        ['mx', 'lv'], ['lv', 'out'],
      ],
      macros: [
        { label: '圓點密度', def: 0.4, targets: [['dots', 'count', 4, 14]] },
        { label: '圓點大小', def: 0.5, targets: [['dots', 'size', 0.3, 0.8]] },
        { label: '條紋數量', def: 0.4, targets: [['bands', 'repeat', 2, 12]] },
        { label: '條紋混合', def: 0.79, targets: [['mx', 'opacity', 0.3, 1]] },
      ],
    },

    // 🔫 槍口火光:中心放射尖刺星芒 + 高斯光核 → 柏林輕度扭曲 → 直方圖掃描 → 聖金漸層 → 發光
    muzzle: {
      nodes: [
        ['sp', 'splatterCircular', 40, 40, { pattern: 'spike', count: 5, radius: 0.05, size: 0.5, width: 0.3, sizeRand: 0.45, angJitter: 0.2, seed: 9 }],
        ['core', 'shape', 40, 260, { type: 'gauss', size: 0.4 }],
        ['mx', 'blend', 230, 130, { mode: 'max' }],
        ['nz', 'perlin', 230, 350, { scale: 5, octaves: 3, seed: 40 }],
        ['wp', 'warp', 420, 220, { mode: 'grad', intensity: 1 }],
        ['sc', 'histogramScan', 610, 220, { pos: 0.35, contrast: 0.6 }],
        ['grad', 'gradientMap', 800, 220, { preset: 'gold', steps: 4 }],
        ['glow', 'glow', 990, 220, { threshold: 0.4, radius: 6, intensity: 1.5 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['sp', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sc'], ['sc', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '星芒數量', def: 0.1, targets: [['sp', 'count', 4, 12]] },
        { label: '星芒長度', def: 0.4, targets: [['sp', 'size', 0.3, 0.8]] },
        { label: '光核大小', def: 0.43, targets: [['core', 'size', 0.25, 0.6]] },
        { label: '邊緣擾動', def: 0.41, targets: [['wp', 'intensity', 0.3, 2]] },
        { label: '光暈強度', def: 0.38, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // ⚔ 近戰揮砍:圓弧帶(Ring)→ 柏林粗糙化 → Spin 旋轉模糊拉出動勢 → 垂直 Ramp 遮出下方弧段(尖端漸縮)
    //            → 硬邊 → 水平 Ramp 做出「前緣亮、尾端淡」的揮擊方向感 → 寒冰漸層 → 發光
    slash: {
      nodes: [
        ['ring', 'shape', 40, 40, { type: 'ring', size: 1.1, width: 0.24, soft: 0.04 }],
        ['nz', 'perlin', 40, 260, { scale: 5, octaves: 3, seed: 22 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 0.6 }],
        ['spin', 'blur', 420, 130, { mode: 'spin', amount: 2 }],
        ['vmask', 'ramp', 420, 350, { angle: 90, start: 0.45, end: 0.85, curve: 1 }],
        ['fm1', 'blend', 610, 220, { mode: 'mul' }],
        ['recen', 'transform', 800, 220, { oy: -0.1, tiling: false }],
        ['sc', 'histogramScan', 990, 220, { pos: 0.25, contrast: 0.45 }],
        ['lead', 'ramp', 990, 440, { angle: 0, start: 0.05, end: 0.75, curve: 0.7 }],
        ['fm2', 'blend', 1180, 300, { mode: 'mul' }],
        ['lv', 'levels', 1370, 300, { gamma: 1.6, outHi: 0.92 }],
        ['grad', 'gradientMap', 1560, 300, { preset: 'ice', steps: 4 }],
        ['glow', 'glow', 1750, 300, { threshold: 0.4, radius: 5, intensity: 2 }],
        ['out', 'output', 1940, 300],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'spin'],
        ['vmask', 'fm1', 0], ['spin', 'fm1', 1],
        ['fm1', 'recen'], ['recen', 'sc'],
        ['lead', 'fm2', 0], ['sc', 'fm2', 1],
        ['fm2', 'lv'], ['lv', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '弧帶厚度', def: 0.47, targets: [['ring', 'width', 0.1, 0.4]] },
        { label: '動勢模糊', def: 0.33, targets: [['spin', 'amount', 0, 6]] },
        { label: '邊緣粗糙', def: 0.3, targets: [['wp', 'intensity', 0, 2]] },
        { label: '光暈強度', def: 0.5, targets: [['glow', 'intensity', 0.5, 3.5]] },
      ],
    },

    // 🎯 圓形撞擊:粗圓環被柏林扭曲(有機感)+ 環外側放射尖刺 → 硬邊 → 中心光核最後疊上
    //            → Levels 壓亮度讓本體落在金色 → 聖金漸層 → 發光
    circleImpact: {
      nodes: [
        ['ring', 'shape', 40, 40, { type: 'ring', size: 0.8, width: 0.14, soft: 0.03 }],
        ['nz', 'perlin', 40, 260, { scale: 5, octaves: 3, seed: 15 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 1.5 }],
        ['sp', 'splatterCircular', 230, 350, { pattern: 'spike', count: 9, radius: 0.36, size: 0.13, width: 0.4, sizeRand: 0.55, angJitter: 0.3, seed: 11 }],
        ['mx1', 'blend', 420, 220, { mode: 'max' }],
        ['sc', 'histogramScan', 610, 220, { pos: 0.42, contrast: 0.7 }],
        ['dot', 'shape', 610, 440, { type: 'gauss', size: 0.3 }],
        ['mx2', 'blend', 800, 300, { mode: 'max' }],
        ['lv', 'levels', 990, 300, { outHi: 0.8 }],
        ['grad', 'gradientMap', 1180, 300, { preset: 'gold', steps: 4 }],
        ['glow', 'glow', 1370, 300, { threshold: 0.55, radius: 5, intensity: 1.4 }],
        ['out', 'output', 1560, 300],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['sp', 'mx1', 0], ['wp', 'mx1', 1],
        ['mx1', 'sc'],
        ['dot', 'mx2', 0], ['sc', 'mx2', 1],
        ['mx2', 'lv'], ['lv', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.3, targets: [['sp', 'count', 6, 16]] },
        { label: '環扭曲', def: 0.4, targets: [['wp', 'intensity', 0.5, 3]] },
        { label: '環厚度', def: 0.43, targets: [['ring', 'width', 0.08, 0.22]] },
        { label: '中心光核', def: 0.43, targets: [['dot', 'size', 0.15, 0.5]] },
        { label: '光暈強度', def: 0.33, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 🌋 地面斬擊:長刀身(三角拉伸)→ 低頻柏林大彎 → Crystal 雜訊二次扭曲出鋸齒稜角(閃電技法)
    //            → 細胞裂縫 Subtract 切出碎裂縫 → 硬邊 → 頂端 Ramp 淡出 → 餘燼漸層 → 發光
    groundSlash: {
      nodes: [
        ['tri', 'shape', 40, 40, { type: 'poly', sides: 3, size: 0.9, soft: 0.01, rot: -90 }],
        ['t1', 'transform', 230, 40, { sx: 0.42, sy: 1.35, tiling: false }],
        ['nz', 'perlin', 230, 260, { scale: 3, octaves: 2, seed: 44 }],
        ['wp1', 'warp', 420, 130, { mode: 'grad', intensity: 3 }],
        ['cr', 'cells', 420, 350, { mode: 'crystal', scale: 7, seed: 13 }],
        ['wp2', 'warp', 610, 220, { mode: 'grad', intensity: 2 }],
        ['ck', 'cells', 610, 440, { mode: 'edge', scale: 9, contrast: 1.3, seed: 31 }],
        ['bsub', 'blend', 800, 220, { mode: 'sub', opacity: 0.55 }],
        ['sc', 'histogramScan', 990, 220, { pos: 0.38, contrast: 0.75 }],
        ['fade', 'ramp', 990, 440, { angle: 90, start: 0, end: 0.85, curve: 0.6 }],
        ['fm', 'blend', 1180, 300, { mode: 'mul' }],
        ['lv', 'levels', 1370, 300, { outHi: 0.78 }],
        ['grad', 'gradientMap', 1560, 300, { preset: 'ember', steps: 4 }],
        ['glow', 'glow', 1750, 300, { threshold: 0.45, radius: 5, intensity: 1.8 }],
        ['out', 'output', 1940, 300],
      ],
      links: [
        ['tri', 't1'],
        ['t1', 'wp1', 0], ['nz', 'wp1', 1],
        ['wp1', 'wp2', 0], ['cr', 'wp2', 1],
        ['ck', 'bsub', 0], ['wp2', 'bsub', 1],
        ['bsub', 'sc'],
        ['fade', 'fm', 0], ['sc', 'fm', 1],
        ['fm', 'lv'], ['lv', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '刀身長度', def: 0.44, targets: [['t1', 'sy', 1, 1.8]] },
        { label: '彎折強度', def: 0.43, targets: [['wp1', 'intensity', 1.5, 5]] },
        { label: '鋸齒稜角', def: 0.5, targets: [['wp2', 'intensity', 0.5, 3.5]] },
        { label: '碎裂程度', def: 0.55, targets: [['bsub', 'opacity', 0, 1]] },
        { label: '光暈強度', def: 0.45, targets: [['glow', 'intensity', 0.8, 3]] },
      ],
    },

    // 🔥⚽ 火球:柔邊圓 → 山脊柏林梯度扭曲(火舌邊緣)→ 漩渦攪動 → 直方圖掃描 → 火焰漸層 → 發光
    fireball: {
      nodes: [
        ['base', 'shape', 40, 40, { type: 'blob', size: 0.85, falloff: 1 }],
        ['nz', 'perlin', 40, 260, { scale: 4, octaves: 2, seed: 23 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 5 }],
        ['sw', 'swirl', 420, 130, { amount: 40, radius: 1 }],
        ['sc', 'histogramScan', 610, 130, { pos: 0.42, contrast: 0.92 }],
        ['iv1', 'invert', 800, 130, {}],
        ['dst', 'distance', 990, 130, { dist: 0.16, curve: 1 }],
        ['iv2', 'invert', 1180, 130, {}],
        ['po', 'posterize', 1370, 130, { levels: 4, soft: 0 }],
        ['grad', 'gradientMap', 1560, 130, { preset: 'fire', steps: 4 }],
        ['out', 'output', 1750, 130],
      ],
      links: [
        ['base', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sw'], ['sw', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['iv2', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '火舌擾動', def: 0.5, targets: [['wp', 'intensity', 1.5, 8]] },
        { label: '攪動旋轉', def: 0.33, targets: [['sw', 'amount', 0, 120]] },
        { label: '核心大小', def: 0.5, targets: [['dst', 'dist', 0.07, 0.26]] },
        { label: '色帶層數', def: 0.33, targets: [['po', 'levels', 2, 8]] },
        { label: '輪廓緊實', def: 0.87, targets: [['sc', 'contrast', 0.5, 0.98]] },
      ],
    },

    // 🎇 火花碎片(1MaFX Part3 隨機形狀產生器):
    // Disk 接 Tile Sampler 的 Pattern Input,6×6、大幅放大、位置隨機 →
    // 另一顆 Disk 接 Mask Input(閾值+反轉)裁掉部分實例 → 重疊圓的聯集出現不規則缺口 = 風格化碎片
    sparks: {
      nodes: [
        ['pat', 'shape', 40, 40, { type: 'disc', size: 0.5, soft: 0.02 }],
        ['msk', 'shape', 40, 260, { type: 'disc', size: 0.9, soft: 0.03 }],
        ['ts', 'tileSampler', 230, 130, { count: 6, size: 2.6, posRand: 1.2, sizeRand: 0.5, briRand: 0, maskThreshold: 0.5, maskInvert: false, seed: 7 }],
        ['nz', 'perlin', 230, 390, { scale: 6, octaves: 3, seed: 15 }],
        ['sb', 'slopeBlur', 420, 220, { mode: 'max', intensity: 2, samples: 1 }], // 取樣數 1 = 不規則跳躍邊緣
        ['sc', 'histogramScan', 610, 220, { pos: 0.42, contrast: 0.55 }],
        ['out', 'output', 800, 220],
      ],
      links: [
        ['pat', 'ts', 0], ['msk', 'ts', 1],
        ['ts', 'sb', 0], ['nz', 'sb', 1],
        ['sb', 'sc'], ['sc', 'out'],
      ],
      macros: [
        { label: '碎片大小', def: 0.55, targets: [['ts', 'size', 1.5, 3.5]] },
        { label: '散佈範圍', def: 0.43, targets: [['ts', 'posRand', 0.6, 2]] },
        { label: '邊緣破碎', def: 0.43, targets: [['sb', 'intensity', 0.5, 4]] },
        { label: '遮罩範圍', def: 0.5, targets: [['msk', 'size', 0.5, 1.3]] },
      ],
    },

    // 🎞 碎片四格圖(2×2 Flipbook):
    // 4 組不同種子的火花碎片 → 各自 Transform(縮 0.5、位移 ±0.25)到四個象限 → Add 合併
    // 遊戲引擎中以 2×2 flipbook 取樣,每個粒子隨機抽一格
    flipbook: {
      nodes: [
        ['pat', 'shape', 40, 40, { type: 'disc', size: 0.5, soft: 0.02 }],
        ['msk', 'shape', 40, 260, { type: 'disc', size: 0.9, soft: 0.03 }],
        ['ts1', 'tileSampler', 230, 40, { count: 6, size: 2.6, posRand: 1.2, sizeRand: 0.5, briRand: 0, seed: 7 }],
        ['ts2', 'tileSampler', 230, 300, { count: 6, size: 2.6, posRand: 1.2, sizeRand: 0.5, briRand: 0, seed: 23 }],
        ['ts3', 'tileSampler', 230, 560, { count: 6, size: 2.6, posRand: 1.2, sizeRand: 0.5, briRand: 0, seed: 61 }],
        ['ts4', 'tileSampler', 230, 820, { count: 6, size: 2.6, posRand: 1.2, sizeRand: 0.5, briRand: 0, seed: 88 }],
        ['tf1', 'transform', 420, 40, { sx: 0.5, sy: 0.5, ox: -0.25, oy: -0.25, tiling: false }],
        ['tf2', 'transform', 420, 300, { sx: 0.5, sy: 0.5, ox: 0.25, oy: -0.25, tiling: false }],
        ['tf3', 'transform', 420, 560, { sx: 0.5, sy: 0.5, ox: -0.25, oy: 0.25, tiling: false }],
        ['tf4', 'transform', 420, 820, { sx: 0.5, sy: 0.5, ox: 0.25, oy: 0.25, tiling: false }],
        ['a1', 'blend', 610, 170, { mode: 'add' }],
        ['a2', 'blend', 800, 300, { mode: 'add' }],
        ['a3', 'blend', 990, 430, { mode: 'add' }],
        ['nz', 'perlin', 990, 650, { scale: 8, octaves: 3, seed: 15 }],
        ['sb', 'slopeBlur', 1180, 500, { mode: 'max', intensity: 1, samples: 1 }],
        ['out', 'output', 1370, 500],
      ],
      links: [
        ['pat', 'ts1', 0], ['msk', 'ts1', 1],
        ['pat', 'ts2', 0], ['msk', 'ts2', 1],
        ['pat', 'ts3', 0], ['msk', 'ts3', 1],
        ['pat', 'ts4', 0], ['msk', 'ts4', 1],
        ['ts1', 'tf1'], ['ts2', 'tf2'], ['ts3', 'tf3'], ['ts4', 'tf4'],
        ['tf2', 'a1', 0], ['tf1', 'a1', 1],
        ['tf3', 'a2', 0], ['a1', 'a2', 1],
        ['tf4', 'a3', 0], ['a2', 'a3', 1],
        ['a3', 'sb', 0], ['nz', 'sb', 1],
        ['sb', 'out'],
      ],
      macros: [
        { label: '碎片大小', def: 0.55, targets: [['ts1', 'size', 1.5, 3.5], ['ts2', 'size', 1.5, 3.5], ['ts3', 'size', 1.5, 3.5], ['ts4', 'size', 1.5, 3.5]] },
        { label: '散佈範圍', def: 0.43, targets: [['ts1', 'posRand', 0.6, 2], ['ts2', 'posRand', 0.6, 2], ['ts3', 'posRand', 0.6, 2], ['ts4', 'posRand', 0.6, 2]] },
        { label: '邊緣破碎', def: 0.14, targets: [['sb', 'intensity', 0.5, 4]] },
        { label: '遮罩範圍', def: 0.5, targets: [['msk', 'size', 0.5, 1.3]] },
      ],
    },

    // ☁ 卡通煙團:球體聯集高度場 → 卡通打光硬切終端線 → 外描邊 → 平塗色階
    //   (勝過單一寫死的產生器之處:每一步都是可換可調的節點,還能加描邊與多階調)
    celSmoke: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 10, size: 0.8, spread: 0.45, taper: 0.55, fuse: 0.3, wobble: 0.3, seed: 5 }],
        ['cel', 'celShade', 250, 40, { tones: 2, terminator: 0.55, lightAngle: -115, relief: 0.6, shadowTone: 0.62, litTone: 0.95, edge: 0.03 }],
        ['line', 'outline', 460, 260, { width: 0.01, side: 'inner', threshold: 0.1 }],
        ['mx', 'blend', 660, 130, { mode: 'sub', opacity: 0.5 }],
        ['grad', 'gradientMap', 860, 130, { preset: 'smoke', steps: 0 }],
        ['out', 'output', 1060, 130],
      ],
      links: [
        ['blobs', 'cel'], ['cel', 'line'],
        ['line', 'mx', 0], ['cel', 'mx', 1],
        ['mx', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '團塊數量', def: 0.5, targets: [['blobs', 'count', 4, 14]] },
        { label: '團塊大小', def: 0.5, targets: [['blobs', 'size', 0.5, 1.2]] },
        { label: '手繪抖動', def: 0.4, targets: [['blobs', 'wobble', 0, 1]] },
        { label: '陰影範圍', def: 0.5, targets: [['cel', 'terminator', 0.25, 0.85]] },
        { label: '描邊粗細', def: 0.25, targets: [['line', 'width', 0.002, 0.04]] },
      ],
    },

    // 🪨 地裂(1MaFX Ground Cracks 工作流):
    // ① Cells 邊緣裂縫 → Slope Blur(驅動=軟邊圓,Max)讓裂縫向外擴張生長 → Multiply 集中於圓心
    // ② 隨機破壞:軟圓被 Perlin 重度扭曲 → 放射模糊(符合圓形結構)→ Subtract 去除均勻感
    // ③ SDF 風格化:Distance 把硬邊裂縫轉成連續漸層帶
    //    (教學的 Invert→Distance→Invert 三連;我們的 Distance 直接輸出「近亮遠暗」,等效免反相)
    // ④ 細節:低強度 Perlin Warp 微調邊緣 + 模糊後的 Cells 二次 Warp 破碎邊緣
    // ⑤ 紅橙黃白漸層 = 岩漿裂地
    groundCrack: {
      nodes: [
        ['cr', 'cells', 40, 40, { mode: 'edge', scale: 7, contrast: 2.2, seed: 24 }],
        ['sc', 'shape', 40, 260, { type: 'blob', size: 1.1, falloff: 1.4 }],
        ['iv0', 'invert', 40, 480, {}], // 反相軟圓 → 梯度朝外,裂縫向外放射生長
        ['sb', 'slopeBlur', 230, 130, { mode: 'max', intensity: 1, samples: 12 }],
        ['mm', 'blend', 420, 130, { mode: 'mul' }],
        // ── 隨機破壞 ──
        ['rs', 'shape', 230, 350, { type: 'blob', size: 0.7, falloff: 1.2 }],
        ['rn', 'perlin', 230, 570, { scale: 4, octaves: 3, seed: 31 }],
        ['rw', 'warp', 420, 460, { mode: 'grad', intensity: 8 }],
        ['rl', 'levels', 610, 460, { inLo: 0.5, inHi: 0.9 }],
        ['rb', 'blur', 800, 460, { mode: 'zoom', amount: 4 }],
        ['sub', 'blend', 610, 130, { mode: 'sub', opacity: 0.5 }],
        // ── SDF 風格化 ──
        ['sc2', 'histogramScan', 800, 130, { pos: 0.34, contrast: 0.5 }],
        ['dst', 'distance', 990, 130, { dist: 0.05, curve: 1.2 }],
        // ── 細節扭曲 ──
        ['wn', 'perlin', 990, 350, { scale: 3, octaves: 2, seed: 8 }],
        ['w1', 'warp', 1180, 130, { mode: 'grad', intensity: 1 }],
        ['c4', 'cells', 1180, 350, { mode: 'f1', scale: 12, seed: 5 }],
        ['c4b', 'blur', 1370, 350, { mode: 'gauss', amount: 1.5 }],
        ['w2', 'warp', 1560, 130, { mode: 'grad', intensity: 0.5 }],
        ['grad', 'gradientMap', 1750, 130, { preset: 'fire', steps: 4 }],
        ['glow', 'glow', 1940, 130, { threshold: 0.5, radius: 5, intensity: 1.2 }],
        ['out', 'output', 2130, 130],
      ],
      links: [
        ['cr', 'sb', 0], ['sc', 'iv0'], ['iv0', 'sb', 1],
        ['sb', 'mm', 0], ['sc', 'mm', 1],
        ['rs', 'rw', 0], ['rn', 'rw', 1],
        ['rw', 'rl'], ['rl', 'rb'],
        ['rb', 'sub', 0], ['mm', 'sub', 1],
        ['sub', 'sc2'], ['sc2', 'dst'],
        ['dst', 'w1', 0], ['wn', 'w1', 1],
        ['c4', 'c4b'],
        ['w1', 'w2', 0], ['c4b', 'w2', 1],
        ['w2', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '裂縫密度', def: 0.38, targets: [['cr', 'scale', 4, 12]] },
        { label: '生長距離', def: 0.37, targets: [['sb', 'intensity', 0.3, 2.2]] },
        { label: '破壞程度', def: 0.5, targets: [['sub', 'opacity', 0, 1]] },
        { label: '裂縫粗細', def: 0.3, targets: [['dst', 'dist', 0.02, 0.12]] },
        { label: '光暈強度', def: 0.38, targets: [['glow', 'intensity', 0.4, 2.5]] },
      ],
    },

    // 🔮 能量球:柔邊圓 → 雲絮柏林扭曲 → 漩渦攪動 → 硬邊 → 奧術漸層 → 發光
    plasma: {
      nodes: [
        ['base', 'shape', 40, 40, { type: 'gauss', size: 0.72 }],
        ['nz', 'perlin', 40, 260, { mode: 'billow', scale: 5, octaves: 4, seed: 12 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 3 }],
        ['sw', 'swirl', 420, 130, { amount: 90, radius: 1.1 }],
        ['sc', 'histogramScan', 610, 130, { pos: 0.4, contrast: 0.4 }],
        ['grad', 'gradientMap', 800, 130, { preset: 'arcane', steps: 4 }],
        ['glow', 'glow', 990, 130, { threshold: 0.4, radius: 6, intensity: 1.6 }],
        ['out', 'output', 1180, 130],
      ],
      links: [
        ['base', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sw'], ['sw', 'sc'], ['sc', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '能量翻騰', def: 0.42, targets: [['wp', 'intensity', 1.5, 6]] },
        { label: '旋轉動勢', def: 0.5, targets: [['sw', 'amount', 0, 180]] },
        { label: '湍流細節', def: 0.4, targets: [['nz', 'scale', 3, 8]] },
        { label: '光暈強度', def: 0.35, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // ✨ 星芒閃光:高斯光核橫向+縱向拉伸成十字星芒 + 中心光核 取亮 → 寒冰漸層 → 發光
    sparkle: {
      nodes: [
        ['g1', 'shape', 40, 40, { type: 'gauss', size: 0.9 }],
        ['hz', 'transform', 230, 40, { sx: 3.6, sy: 0.05, tiling: false }],
        ['vt', 'transform', 230, 260, { sx: 0.05, sy: 3.6, tiling: false }],
        ['core', 'shape', 40, 480, { type: 'gauss', size: 0.3 }],
        ['mx1', 'blend', 420, 130, { mode: 'max' }],
        ['mx2', 'blend', 610, 220, { mode: 'max' }],
        ['grad', 'gradientMap', 800, 220, { preset: 'ice', steps: 4 }],
        ['glow', 'glow', 990, 220, { threshold: 0.4, radius: 6, intensity: 2 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['g1', 'hz'], ['g1', 'vt'],
        ['hz', 'mx1', 0], ['vt', 'mx1', 1],
        ['core', 'mx2', 0], ['mx1', 'mx2', 1],
        ['mx2', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '星芒長度', def: 0.45, targets: [['hz', 'sx', 2.5, 4.6], ['vt', 'sy', 2.5, 4.6]] },
        { label: '十字粗細', def: 0.2, targets: [['hz', 'sy', 0.03, 0.14], ['vt', 'sx', 0.03, 0.14]] },
        { label: '光核大小', def: 0.4, targets: [['core', 'size', 0.2, 0.5]] },
        { label: '光暈強度', def: 0.5, targets: [['glow', 'intensity', 0.8, 3.5]] },
      ],
    },

    // 🌀 傳送門:柏林雜訊被強漩渦攪成螺旋 → 圓環遮罩限制成環狀 → 硬邊 → 奧術漸層 → 發光
    portal: {
      nodes: [
        ['nz', 'perlin', 40, 40, { mode: 'fbm', scale: 3, octaves: 4, seed: 29 }],
        ['sw', 'swirl', 230, 40, { amount: 480, radius: 1.2 }],
        ['ring', 'shape', 40, 260, { type: 'ring', size: 1, width: 0.55, soft: 0.15 }],
        ['mm', 'blend', 420, 130, { mode: 'mul' }],
        ['sc', 'histogramScan', 610, 130, { pos: 0.45, contrast: 0.4 }],
        ['grad', 'gradientMap', 800, 130, { preset: 'arcane', steps: 4 }],
        ['glow', 'glow', 990, 130, { threshold: 0.35, radius: 5, intensity: 1.8 }],
        ['out', 'output', 1180, 130],
      ],
      links: [
        ['nz', 'sw'],
        ['sw', 'mm', 0], ['ring', 'mm', 1],
        ['mm', 'sc'], ['sc', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '漩渦強度', def: 0.43, targets: [['sw', 'amount', 180, 720]] },
        { label: '環厚度', def: 0.5, targets: [['ring', 'width', 0.3, 0.8]] },
        { label: '紊亂細節', def: 0.25, targets: [['nz', 'scale', 2, 6]] },
        { label: '光暈強度', def: 0.4, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 💧 水花:中央高斯水核 + 環狀噴濺水滴 取亮 → 寒冰漸層 → 發光
    water: {
      nodes: [
        ['drops', 'splatterCircular', 40, 40, { pattern: 'blob', count: 12, radius: 0.28, size: 0.17, width: 0.5, sizeRand: 0.5, radJitter: 0.35, angJitter: 0.5, seed: 6 }],
        ['core', 'shape', 40, 260, { type: 'gauss', size: 0.52 }],
        ['mx', 'blend', 230, 130, { mode: 'max' }],
        ['grad', 'gradientMap', 420, 130, { preset: 'ice', steps: 4 }],
        ['glow', 'glow', 610, 130, { threshold: 0.45, radius: 4, intensity: 1.2 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['drops', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '水滴數量', def: 0.4, targets: [['drops', 'count', 6, 24]] },
        { label: '噴濺半徑', def: 0.5, targets: [['drops', 'radius', 0.15, 0.45]] },
        { label: '水滴大小', def: 0.43, targets: [['drops', 'size', 0.06, 0.2]] },
        { label: '中心大小', def: 0.5, targets: [['core', 'size', 0.2, 0.6]] },
      ],
    },

    // ❄ 冰晶:晶格細胞雜訊 → 柔邊圓遮罩增值 → 硬邊提取晶面 → 寒冰漸層 → 發光
    frost: {
      nodes: [
        ['cr', 'cells', 40, 40, { mode: 'crystal', scale: 6, contrast: 1.3, seed: 18 }],
        ['mask', 'shape', 40, 260, { type: 'blob', size: 1.15, falloff: 0.9 }],
        ['mm', 'blend', 230, 130, { mode: 'mul' }],
        ['sc', 'histogramScan', 420, 130, { pos: 0.32, contrast: 0.55 }],
        ['grad', 'gradientMap', 610, 130, { preset: 'ice', steps: 4 }],
        ['glow', 'glow', 800, 130, { threshold: 0.45, radius: 4, intensity: 1.8 }],
        ['out', 'output', 990, 130],
      ],
      links: [
        ['cr', 'mm', 0], ['mask', 'mm', 1],
        ['mm', 'sc'], ['sc', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '晶格密度', def: 0.3, targets: [['cr', 'scale', 4, 14]] },
        { label: '晶面銳利', def: 0.5, targets: [['sc', 'contrast', 0.3, 0.9]] },
        { label: '範圍大小', def: 0.57, targets: [['mask', 'size', 0.7, 1.4]] },
        { label: '光暈強度', def: 0.42, targets: [['glow', 'intensity', 0.6, 2.5]] },
      ],
    },

    // ☣ 毒液氣泡:網格散佈高斯氣泡(大小/亮度隨機)→ 柔邊圓遮罩增值 → 劇毒漸層 → 發光
    toxic: {
      nodes: [
        ['bub', 'tileSampler', 40, 40, { pattern: 'gauss', count: 6, size: 1.3, sizeRand: 0.6, posRand: 0.6, briRand: 0.4, seed: 3 }],
        ['mask', 'shape', 40, 260, { type: 'blob', size: 1.1, falloff: 1 }],
        ['mm', 'blend', 230, 130, { mode: 'mul' }],
        ['grad', 'gradientMap', 420, 130, { preset: 'toxic', steps: 4 }],
        ['glow', 'glow', 610, 130, { threshold: 0.45, radius: 5, intensity: 1.3 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['bub', 'mm', 0], ['mask', 'mm', 1],
        ['mm', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '氣泡密度', def: 0.33, targets: [['bub', 'count', 3, 12]] },
        { label: '氣泡大小', def: 0.42, targets: [['bub', 'size', 0.8, 2]] },
        { label: '大小隨機', def: 0.6, targets: [['bub', 'sizeRand', 0, 1]] },
        { label: '範圍大小', def: 0.57, targets: [['mask', 'size', 0.7, 1.4]] },
      ],
    },

    // 🟡 光塵散景:網格散佈高斯光點(高亮度隨機、部分覆蓋)→ 散焦模糊 → 聖金漸層 → 發光
    bokeh: {
      nodes: [
        ['dots', 'tileSampler', 40, 40, { pattern: 'gauss', count: 7, size: 1.5, sizeRand: 0.4, posRand: 0.8, briRand: 0.4, coverage: 0.85, seed: 5 }],
        ['bl', 'blur', 230, 40, { mode: 'gauss', amount: 2.5 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'gold', steps: 4 }],
        ['glow', 'glow', 610, 40, { threshold: 0.35, radius: 5, intensity: 1.5 }],
        ['out', 'output', 800, 40],
      ],
      links: [
        ['dots', 'bl'], ['bl', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '粒子密度', def: 0.4, targets: [['dots', 'count', 4, 14]] },
        { label: '粒子大小', def: 0.4, targets: [['dots', 'size', 0.5, 1.8]] },
        { label: '散焦模糊', def: 0.5, targets: [['bl', 'amount', 0, 6]] },
        { label: '亮度隨機', def: 0.6, targets: [['dots', 'briRand', 0, 1]] },
      ],
    },

    // 🎆 煙花綻放:中心放射細光條(streak)+ 高斯光核 取亮 → 聖金漸層 → 發光
    firework: {
      nodes: [
        ['rays', 'splatterCircular', 40, 40, { pattern: 'streak', count: 22, radius: 0.03, size: 0.46, width: 0.09, sizeRand: 0.5, angJitter: 0.15, seed: 8 }],
        ['core', 'shape', 40, 260, { type: 'gauss', size: 0.28 }],
        ['mx', 'blend', 230, 130, { mode: 'max' }],
        ['grad', 'gradientMap', 420, 130, { preset: 'gold', steps: 4 }],
        ['glow', 'glow', 610, 130, { threshold: 0.4, radius: 6, intensity: 1.6 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['rays', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'grad'], ['grad', 'glow'], ['glow', 'out'],
      ],
      macros: [
        { label: '光條數量', def: 0.4, targets: [['rays', 'count', 12, 32]] },
        { label: '綻放長度', def: 0.53, targets: [['rays', 'size', 0.3, 0.6]] },
        { label: '長度隨機', def: 0.5, targets: [['rays', 'sizeRand', 0, 0.8]] },
        { label: '光暈強度', def: 0.35, targets: [['glow', 'intensity', 0.6, 3]] },
      ],
    },

    // 🌫 煙霧:雲絮雜訊自我扭曲 → 柔邊圓遮罩增值 → 色階 → 煙灰漸層
    smoke: {
      nodes: [
        ['noise', 'perlin', 40, 40, { mode: 'fbm', scale: 3, octaves: 5, seed: 17 }],
        ['warp', 'warp', 250, 40, { mode: 'grad', intensity: 5 }],
        ['mask', 'shape', 250, 260, { type: 'blob', size: 1.05, falloff: 0.85 }],
        ['mix', 'blend', 460, 130, { mode: 'mul' }],
        ['lv', 'levels', 670, 130, { inLo: 0.04, inHi: 0.44, gamma: 1 }],
        ['grad', 'gradientMap', 880, 130, { preset: 'smoke', steps: 4 }],
        ['out', 'output', 1090, 130],
      ],
      links: [
        ['noise', 'warp', 0],
        ['warp', 'mix', 0], ['mask', 'mix', 1],
        ['mix', 'lv'], ['lv', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '湍流強度', def: 0.29, targets: [['warp', 'intensity', 1, 8]] },
        { label: '細節層次', def: 0.5, targets: [['noise', 'octaves', 3, 7]] },
        { label: '濃度', def: 0.64, targets: [['lv', 'inHi', 0.9, 0.4]] },
        { label: '範圍大小', def: 0.5, targets: [['mask', 'size', 0.6, 1.3]] },
      ],
    },
  };

  // 範本牆中繼資料:分類順序 + 每個範本的顯示資訊
  const CATS = [
    ['hit', '打擊 / 衝擊'],
    ['trail', '拖尾 / 揮砍'],
    ['energy', '火焰 / 能量'],
    ['light', '電光 / 鏡頭'],
    ['ringcat', '環形 / 圖騰'],
    ['element', '元素 / 自然'],
    ['surface', '表面 / 氛圍'],
  ];
  const META = {
    impact:        { emoji: '💢', name: '碎裂衝擊', en: 'Impact', cat: 'hit' },
    circleImpact:  { emoji: '🎯', name: '圓形撞擊', en: 'Circle Impact', cat: 'hit' },
    burst:         { emoji: '💥', name: '打擊爆閃', en: 'Hit Burst', cat: 'hit' },
    ring:          { emoji: '⭕', name: '環狀衝擊波', en: 'Shockwave', cat: 'hit' },
    trail:         { emoji: '➰', name: '一般拖尾', en: 'Trail', cat: 'trail' },
    stylizedTrail: { emoji: '🎗', name: '風格化拖尾', en: 'Stylized', cat: 'trail' },
    slash:         { emoji: '⚔', name: '近戰揮砍', en: 'Melee Slash', cat: 'trail' },
    groundSlash:   { emoji: '🌋', name: '地面斬擊', en: 'Ground Slash', cat: 'trail' },
    fire:          { emoji: '🔥', name: '火焰', en: 'Flame', cat: 'energy' },
    fireball:      { emoji: '☄', name: '火球', en: 'Fireball', cat: 'energy' },
    projectile:    { emoji: '🚀', name: '投射物', en: 'Projectile', cat: 'energy' },
    muzzle:        { emoji: '🔫', name: '槍口火光', en: 'Muzzle Flash', cat: 'energy' },
    sparks:        { emoji: '🎇', name: '火花碎片', en: 'Sparks', cat: 'energy' },
    flipbook:      { emoji: '🎞', name: '碎片四格圖', en: '2×2 Flipbook', cat: 'energy' },
    lightning:     { emoji: '⚡', name: '閃電', en: 'Lightning', cat: 'light' },
    lens:          { emoji: '🔆', name: '鏡頭光暈', en: 'Lens Flare', cat: 'light' },
    sparkle:       { emoji: '✨', name: '星芒閃光', en: 'Sparkle', cat: 'light' },
    bokeh:         { emoji: '🟡', name: '光塵散景', en: 'Bokeh', cat: 'light' },
    plasma:        { emoji: '🔮', name: '能量球', en: 'Plasma Orb', cat: 'energy' },
    firework:      { emoji: '🎆', name: '煙花綻放', en: 'Firework', cat: 'hit' },
    portal:        { emoji: '🌀', name: '傳送門', en: 'Portal', cat: 'ringcat' },
    water:         { emoji: '💧', name: '水花', en: 'Water Splash', cat: 'element' },
    frost:         { emoji: '❄', name: '冰晶', en: 'Frost', cat: 'element' },
    toxic:         { emoji: '☣', name: '毒液氣泡', en: 'Toxic Bubbles', cat: 'element' },
    magic:         { emoji: '🪄', name: '魔法陣', en: 'Magic Circle', cat: 'ringcat' },
    pattern:       { emoji: '🔳', name: '規則圖騰', en: 'Pattern', cat: 'ringcat' },
    celSmoke:      { emoji: '☁', name: '卡通煙團', en: 'Cel Smoke', cat: 'surface' },
    cracks:        { emoji: '🕸', name: '裂縫', en: 'Cracks', cat: 'surface' },
    groundCrack:   { emoji: '🪨', name: '地裂', en: 'Ground Cracks', cat: 'surface' },
    smoke:         { emoji: '🌫', name: '煙霧', en: 'Smoke', cat: 'surface' },
  };

  return {
    names: Object.keys(SPECS),
    get(name) { const g = SPECS[name] ? build(SPECS[name]) : null; if (g) g._presetName = name; return g; },
    meta: META,
    cats: CATS,
  };
})();
