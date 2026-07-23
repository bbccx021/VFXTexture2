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
        // ── 1. 剪影:多向扭曲舔出火舌(RTVFX 分解稱「一半的魔法在這一步」)──
        ['base', 'shape', 40, 40, { type: 'spike', size: 0.84, width: 1.02, falloff: 0.45, soft: 0.06 }],
        ['str', 'transform', 230, 40, { sx: 1.05, sy: 0.92, oy: 0.07, tiling: false }],
        ['nz', 'perlin', 230, 300, { scale: 3, octaves: 2, seed: 11 }],   // 低頻控制圖
        ['mw', 'multiWarp', 420, 40, { mode: 'max', dirs: 5, intensity: 1.1, angle: 20 }],
        ['wp', 'warp', 610, 40, { mode: 'grad', intensity: 5 }],          // 吃縱向條紋雜訊,咬出上下走向的火舌
        ['tr', 'ramp', 610, 480, { angle: -90, start: 0.12, end: 0.92, curve: 0.9 }],
        ['tn', 'perlin', 610, 620, { mode: 'billow', scale: 7, octaves: 3, seed: 5 }],
        ['tb', 'blur', 760, 620, { mode: 'dir', amount: 3, angle: 90 }],
        ['tm', 'blend', 910, 550, { mode: 'mul' }],                   // 侵蝕遮罩:只在上半部有力道
        ['er', 'blend', 800, 40, { mode: 'sub', opacity: 0.85 }],     // 啃出火舌缺口與分離火屑
        ['sc', 'histogramScan', 950, 40, { pos: 0.42, contrast: 0.9 }],   // 硬邊剪影

        // ── 2. 核心:內距離場(中心亮)──
        ['iv1', 'invert', 990, 40, {}],
        ['dst', 'distance', 1180, 40, { dist: 0.13, curve: 0.85 }],
        ['iv2', 'invert', 1370, 40, {}],

        // ── 3. 立體感關鍵:用向上拉伸的雜訊把等高帶扭成火舌 ──
        //    原本等高線完全平行於輪廓 → 讀起來像地形圖(扁平)。
        //    扭曲後band會擠壓、分岔、上竄,才有火在燒的體積感。
        ['fn', 'perlin', 990, 300, { mode: 'billow', scale: 4, octaves: 3, seed: 61 }],
        ['fb', 'blur', 1180, 300, { mode: 'dir', amount: 3.5, angle: 90 }],  // 縱向拉成火流
        ['fw', 'warp', 1560, 130, { mode: 'grad', intensity: 3 }],

        // ── 4. 內部暗斑 + 裁回剪影 ──
        ['dtl', 'perlin', 1560, 380, { scale: 6, octaves: 2, seed: 61 }],
        ['dm', 'blend', 1750, 240, { mode: 'mul', opacity: 0.3 }],
        ['msk', 'blend', 1940, 130, { mode: 'mul' }],                     // 扭曲不外溢,輪廓保持銳利
        // 分離火屑:用上亮漸層當遮罩,只在火焰上半部撒出小火舌
        ['hr', 'ramp', 1940, 560, { angle: 0, start: 0.1, end: 0.9, curve: 1, mirror: true }],
        ['tm2', 'blend', 2040, 480, { mode: 'mul' }],                 // 上方 x 中央 = 火屑只在火焰正上方
        ['em', 'tileSampler', 2130, 420, { pattern: 'spike', count: 6, size: 0.62, sizeRand: 0.55, posRand: 0.8, briRand: 0.25, coverage: 0.55, maskThreshold: 0.4, seed: 9 }],
        ['es', 'histogramScan', 2130, 330, { pos: 0.35, contrast: 0.7 }],   // 壓實但留窄漸層,讓色帶畫出暗鑲邊
        ['emb', 'blend', 2130, 240, { mode: 'max', opacity: 0.8 }],
        ['po', 'posterize', 2130, 130, { levels: 9, soft: 0.22 }],
        ['grad', 'gradientMap', 2320, 130, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2510, 130],
      ],
      links: [
        ['base', 'str'],
        ['str', 'mw', 0], ['nz', 'mw', 1],
        ['mw', 'wp', 0], ['fb', 'wp', 1],
        ['tr', 'tm', 0], ['tb', 'tm', 1], ['tn', 'tb'],
        ['tm', 'er', 0], ['wp', 'er', 1], ['er', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['fn', 'fb'],
        ['iv2', 'fw', 0], ['fb', 'fw', 1],
        ['dtl', 'dm', 0], ['fw', 'dm', 1],
        ['sc', 'msk', 0], ['dm', 'msk', 1],
        ['tr', 'tm2', 0], ['hr', 'tm2', 1], ['tm2', 'em', 1], ['em', 'es'], ['es', 'emb', 0], ['msk', 'emb', 1], ['emb', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '火舌擾動', def: 0.45, targets: [['mw', 'intensity', 0.2, 2.0], ['wp', 'intensity', 2, 8]] },
        { label: '火焰高度', def: 0.35, targets: [['str', 'sy', 0.8, 1.15]] },
        { label: '頂端碎裂', def: 0.5, targets: [['er', 'opacity', 0.3, 1], ['em', 'coverage', 0, 0.8]] },
        { label: '內部流動', def: 0.5, targets: [['fw', 'intensity', 0, 6]] },
        { label: '亮核大小', def: 0.5, targets: [['dst', 'dist', 0.2, 0.045]] },
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
        ['grad', 'gradientMap', 1220, 170, { preset: 'celIce', steps: 0, alphaGain: 4 }],
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
        ['spikes', 'splatterCircular', 40, 40, { pattern: 'spike', count: 10, radius: 0.2, size: 0.44, width: 0.42, sizeRand: 0.35, seed: 4 }],
        ['core', 'shape', 40, 260, { type: 'disc', size: 0.34, soft: 0.02 }],
        ['mix', 'blend', 250, 130, { mode: 'max' }],
        ['sc', 'histogramScan', 440, 130, { pos: 0.35, contrast: 0.9 }],   // 厚實硬邊星芒
        ['iv1', 'invert', 630, 130, {}],
        ['dst', 'distance', 820, 130, { dist: 0.1, curve: 1 }],
        ['iv2', 'invert', 1010, 130, {}],
        ['po', 'posterize', 1200, 130, { levels: 10, soft: 0.5 }],
        ['dtl', 'perlin', 1200, 360, { scale: 8, octaves: 3, seed: 44 }],
        ['dm', 'blend', 1200, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1390, 130, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1580, 130],
      ],
      links: [
        ['core', 'mix', 0], ['spikes', 'mix', 1],
        ['mix', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['iv2', 'po'], ['po', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.3, targets: [['spikes', 'count', 5, 20]] },
        { label: '尖刺長度', def: 0.5, targets: [['spikes', 'size', 0.25, 0.65]] },
        { label: '光核大小', def: 0.35, targets: [['core', 'size', 0.15, 0.7]] },
        { label: '邊緣圓潤', def: 0.4, targets: [['dst', 'dist', 0.03, 0.2]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
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
        ['grad', 'gradientMap', 880, 200, { preset: 'celMagic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1300, 200],
      ],
      links: [
        ['ring1', 'mix1', 0], ['pat', 'mapper'], ['mapper', 'mix1', 1],
        ['ring2', 'mix2', 0], ['mix1', 'mix2', 1],
        ['mix2', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '符文數量', def: 0.33, targets: [['mapper', 'count', 6, 24]] },
        { label: '外環大小', def: 0.78, targets: [['ring1', 'size', 0.9, 1.35]] },
        { label: '內環大小', def: 0.49, targets: [['ring2', 'size', 0.4, 0.85]] },
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
        // ── 第五階段:卡通化收尾(中空星環不適用內距離場,改直接平塗階調)──
        ['csc', 'histogramScan', 1560, 130, { pos: 0.28, contrast: 0.6 }],
        ['po', 'posterize', 1750, 130, { levels: 10, soft: 0.5 }],
        ['dtl', 'perlin', 1750, 360, { scale: 8, octaves: 3, seed: 58 }],
        ['dm', 'blend', 1750, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1940, 130, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2130, 130],
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
        ['merge', 'csc'], ['csc', 'po'], ['po', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
        ['merge', 'sdist'], ['sdist', 'sscan'], ['sscan', 'sblur'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.33, targets: [['splat', 'count', 3, 9]] },
        { label: '尖刺長度', def: 0.5, targets: [['splat', 'size', 0.18, 0.42]] },
        { label: '中心空洞', def: 0.47, targets: [['hole', 'size', 0.15, 0.6]] },
        { label: '破碎程度', def: 1, targets: [['bsub', 'opacity', 0, 1]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
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
        ['dtl', 'perlin', 800, 450, { scale: 8, octaves: 3, seed: 72 }],
        ['dm', 'blend', 800, 330, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 990, 220, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['band', 'bandT'], ['nz', 'nstr'],
        ['bandT', 'wp', 0], ['nstr', 'wp', 1],
        ['fade', 'fm', 0], ['wp', 'fm', 1],
        ['fm', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
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
        ['halo', 'shape', 800, 480, { type: 'ring', size: 1.35, width: 0.16, soft: 0.1 }],
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
        ['dtl', 'perlin', 610, 450, { scale: 8, octaves: 3, seed: 106 }],
        ['dm', 'blend', 610, 330, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 800, 220, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['cr', 'wp', 0], ['nz', 'wp', 1],
        ['mask', 'mm', 0], ['wp', 'mm', 1],
        ['mm', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '裂縫密度', def: 0.3, targets: [['cr', 'scale', 4, 14]] },
        { label: '有機扭曲', def: 0.38, targets: [['wp', 'intensity', 0.4, 2.5]] },
        { label: '範圍大小', def: 0.56, targets: [['mask', 'size', 0.8, 1.6]] },
        { label: '輪廓緊實', def: 0.66, targets: [['sc', 'contrast', 0.3, 0.9]] },
      ],
    },

    // ⭕ 環狀衝擊波:圓環被柏林扭曲(波動)→ 放射模糊 → 疊內圈餘波 → 灰階輸出(引擎內染色)
    ring: {
      nodes: [
        ['ring', 'shape', 40, 40, { type: 'ring', size: 1, width: 0.15, soft: 0.05 }],
        ['nz', 'perlin', 40, 260, { scale: 5, octaves: 2, seed: 19 }],
        ['wp', 'warp', 230, 130, { mode: 'grad', intensity: 1.5 }],
        ['sc', 'histogramScan', 420, 130, { pos: 0.4, contrast: 0.9 }],       // 硬邊主環
        ['ring2', 'shape', 420, 350, { type: 'ring', size: 0.58, width: 0.05, soft: 0.05 }],
        ['sc2', 'histogramScan', 610, 350, { pos: 0.4, contrast: 0.9 }],      // 硬邊內圈
        ['lv2', 'levels', 800, 350, { outHi: 0.55 }],                          // 內圈壓成中階
        ['mx', 'blend', 800, 200, { mode: 'max' }],
        ['out', 'output', 990, 200],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sc'],
        ['ring2', 'sc2'], ['sc2', 'lv2'],
        ['lv2', 'mx', 0], ['sc', 'mx', 1],
        ['mx', 'out'],
      ],
      macros: [
        { label: '波動強度', def: 0.36, targets: [['wp', 'intensity', 0.5, 3]] },
        { label: '環厚度', def: 0.47, targets: [['ring', 'width', 0.06, 0.25]] },
        { label: '內圈大小', def: 0.5, targets: [['ring2', 'size', 0.35, 0.8]] },
        { label: '內圈亮度', def: 0.55, targets: [['lv2', 'outHi', 0.2, 0.85]] },
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
        ['dtl', 'perlin', 990, 360, { scale: 8, octaves: 3, seed: 100 }],
        ['dm', 'blend', 990, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1180, 130, { preset: 'celToxic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1560, 130],
      ],
      links: [
        ['head', 'hoff'], ['head', 'tail'],
        ['tail', 'tb'],
        ['fade', 'fm', 0], ['tb', 'fm', 1],
        ['fm', 'mx', 0], ['hoff', 'mx', 1],
        ['mx', 'lv'], ['lv', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '彈頭大小', def: 0.4, targets: [['head', 'size', 0.4, 0.9]] },
        { label: '尾焰長度', def: 0.44, targets: [['tail', 'sx', 1.4, 3.2]] },
        { label: '尾焰模糊', def: 0.45, targets: [['tb', 'amount', 3, 14]] },
        { label: '尾焰淡出', def: 0.67, targets: [['fade', 'end', 0.7, 1]] },
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
        ['dtl', 'perlin', 610, 450, { scale: 8, octaves: 3, seed: 114 }],
        ['dm', 'blend', 610, 330, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 800, 220, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['sp', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '星芒數量', def: 0.1, targets: [['sp', 'count', 4, 12]] },
        { label: '星芒長度', def: 0.4, targets: [['sp', 'size', 0.3, 0.8]] },
        { label: '光核大小', def: 0.43, targets: [['core', 'size', 0.25, 0.6]] },
        { label: '邊緣擾動', def: 0.41, targets: [['wp', 'intensity', 0.3, 2]] },
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
        ['po', 'posterize', 1560, 300, { levels: 10, soft: 0.5 }],       // 平塗刀光階調
        ['dtl', 'perlin', 1560, 530, { scale: 8, octaves: 3, seed: 128 }],
        ['dm', 'blend', 1560, 410, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1750, 300, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1940, 300],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'spin'],
        ['vmask', 'fm1', 0], ['spin', 'fm1', 1],
        ['fm1', 'recen'], ['recen', 'sc'],
        ['lead', 'fm2', 0], ['sc', 'fm2', 1],
        ['fm2', 'lv'], ['lv', 'po'], ['po', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '弧帶厚度', def: 0.47, targets: [['ring', 'width', 0.1, 0.4]] },
        { label: '動勢拉伸', def: 0.33, targets: [['spin', 'amount', 0, 6]] },
        { label: '邊緣粗糙', def: 0.3, targets: [['wp', 'intensity', 0, 2]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
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
        ['po', 'posterize', 1180, 300, { levels: 10, soft: 0.5 }],
        ['dtl', 'perlin', 1180, 530, { scale: 8, octaves: 3, seed: 135 }],
        ['dm', 'blend', 1180, 410, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1370, 300, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1560, 300],
      ],
      links: [
        ['ring', 'wp', 0], ['nz', 'wp', 1],
        ['sp', 'mx1', 0], ['wp', 'mx1', 1],
        ['mx1', 'sc'],
        ['dot', 'mx2', 0], ['sc', 'mx2', 1],
        ['mx2', 'lv'], ['lv', 'po'], ['po', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '尖刺數量', def: 0.3, targets: [['sp', 'count', 6, 16]] },
        { label: '環扭曲', def: 0.4, targets: [['wp', 'intensity', 0.5, 3]] },
        { label: '環厚度', def: 0.43, targets: [['ring', 'width', 0.08, 0.22]] },
        { label: '中心光核', def: 0.43, targets: [['dot', 'size', 0.15, 0.5]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
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
        ['sc', 'histogramScan', 990, 220, { pos: 0.38, contrast: 0.9 }],   // 硬邊刀身
        ['iv1', 'invert', 1180, 220, {}],
        ['dst', 'distance', 1370, 220, { dist: 0.07, curve: 1 }],
        ['iv2', 'invert', 1560, 220, {}],                                  // 內距離場
        ['po', 'posterize', 1750, 220, { levels: 10, soft: 0.5 }],            // 同心熔岩色帶
        ['dtl', 'perlin', 1750, 450, { scale: 8, octaves: 3, seed: 155 }],
        ['dm', 'blend', 1750, 330, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1940, 220, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2130, 220],
      ],
      links: [
        ['tri', 't1'],
        ['t1', 'wp1', 0], ['nz', 'wp1', 1],
        ['wp1', 'wp2', 0], ['cr', 'wp2', 1],
        ['ck', 'bsub', 0], ['wp2', 'bsub', 1],
        ['bsub', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['iv2', 'po'], ['po', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '刀身長度', def: 0.44, targets: [['t1', 'sy', 1, 1.8]] },
        { label: '彎折強度', def: 0.43, targets: [['wp1', 'intensity', 1.5, 5]] },
        { label: '鋸齒稜角', def: 0.5, targets: [['wp2', 'intensity', 0.5, 3.5]] },
        { label: '碎裂程度', def: 0.55, targets: [['bsub', 'opacity', 0, 1]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
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
        ['dtl', 'perlin', 1180, 350, { scale: 8, octaves: 3, seed: 47 }],   // 內部細節雜訊
        ['dm', 'blend', 1370, 220, { mode: 'mul', opacity: 0.4 }],
        ['po', 'posterize', 1560, 220, { levels: 10, soft: 0.5 }],
        ['grad', 'gradientMap', 1750, 220, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1940, 220],
      ],
      links: [
        ['base', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sw'], ['sw', 'sc'], ['sc', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['dtl', 'dm', 0], ['iv2', 'dm', 1],
        ['dm', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '火舌擾動', def: 0.5, targets: [['wp', 'intensity', 1.5, 8]] },
        { label: '攪動旋轉', def: 0.33, targets: [['sw', 'amount', 0, 120]] },
        { label: '核心大小', def: 0.5, targets: [['dst', 'dist', 0.07, 0.26]] },
        { label: '色帶層數', def: 0.5, targets: [['po', 'levels', 4, 16]] },
        { label: '細節強度', def: 0.44, targets: [['dm', 'opacity', 0, 0.8]] },
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

    // 💥 卡通爆炸:團塊高度場堆出蓬鬆火雲 → 卡通打光給體積 → 放射碎片 → 內描邊 → 火焰色帶
    celExplosion: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 12, size: 0.72, spread: 0.85, taper: 0.2, fuse: 0.3, wobble: 0.35, seed: 9 }],
        ['cel', 'celShade', 250, 40, { tones: 3, terminator: 0.5, lightAngle: -115, relief: 0.6, shadowTone: 0.32, litTone: 0.95, edge: 0.035 }],
        ['spk', 'splatterCircular', 250, 300, { pattern: 'spike', count: 9, radius: 0.3, size: 0.3, width: 0.3, sizeRand: 0.5, angJitter: 0.35, seed: 4 }],
        ['spkl', 'levels', 440, 300, { outHi: 0.7 }],           // 碎片略暗於雲亮面,才有前後層次
        ['mx', 'blend', 640, 150, { mode: 'max' }],
        ['line', 'outline', 840, 350, { width: 0.01, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 1040, 200, { mode: 'sub', opacity: 0.45 }],
        ['grad', 'gradientMap', 1240, 200, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1440, 200],
      ],
      links: [
        ['blobs', 'cel'],
        ['spk', 'spkl'],
        ['spkl', 'mx', 0], ['cel', 'mx', 1],
        ['mx', 'line'],
        ['line', 'sub', 0], ['mx', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '爆炸範圍', def: 0.55, targets: [['blobs', 'spread', 0.3, 1.2]] },
        { label: '火雲團數', def: 0.62, targets: [['blobs', 'count', 5, 14]] },
        { label: '碎片數量', def: 0.4, targets: [['spk', 'count', 4, 16]] },
        { label: '碎片長度', def: 0.42, targets: [['spk', 'size', 0.15, 0.5]] },
        { label: '陰影範圍', def: 0.42, targets: [['cel', 'terminator', 0.25, 0.85]] },
      ],
    },

    // 🍄 卡通蘑菇雲:寬扁雲蓋(上移壓扁)+ 窄柱雲柱(下移縮窄)→ 聯集成高度場 → 卡通打光
    celMushroom: {
      nodes: [
        ['cap', 'blobField', 40, 40, { count: 12, size: 0.82, spread: 0.42, taper: 0.35, fuse: 0.65, wobble: 0.4, seed: 21 }],
        ['capT', 'transform', 240, 40, { sx: 1.45, sy: 0.85, oy: -0.16, tiling: false }],
        ['stem', 'shape', 40, 300, { type: 'blob', size: 0.55, falloff: 1.1 }],              // 柱體用單一柔邊圓拉長,高度剖面才圓潤
        ['stemT', 'transform', 240, 300, { sx: 0.3, sy: 1, oy: 0.22, tiling: false }],
        ['un', 'blend', 440, 150, { mode: 'max' }],
        ['cel', 'celShade', 640, 150, { tones: 3, terminator: 0.5, lightAngle: -115, relief: 0.55, shadowTone: 0.36, litTone: 0.95, edge: 0.035 }],
        ['line', 'outline', 840, 360, { width: 0.009, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 1040, 200, { mode: 'sub', opacity: 0.45 }],
        ['grad', 'gradientMap', 1240, 200, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1440, 200],
      ],
      links: [
        ['cap', 'capT'], ['stem', 'stemT'],
        ['capT', 'un', 0], ['stemT', 'un', 1],
        ['un', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '雲蓋寬度', def: 0.5, targets: [['capT', 'sx', 0.8, 1.6]] },
        { label: '雲柱粗細', def: 0.35, targets: [['stemT', 'sx', 0.2, 0.85]] },
        { label: '整體高度', def: 0.5, targets: [['capT', 'oy', -0.05, -0.35]] },
        { label: '團塊數量', def: 0.55, targets: [['cap', 'count', 5, 14]] },
        { label: '陰影範圍', def: 0.42, targets: [['cel', 'terminator', 0.25, 0.85]] },
      ],
    },

    // 💦 卡通水花:低矮水冠 + 上方飛濺水滴,一起送進高度場打光 → 清水色帶
    celSplash: {
      nodes: [
        ['crown', 'blobField', 40, 40, { count: 7, size: 0.62, spread: 0.55, taper: 0.65, fuse: 0.4, wobble: 0.35, seed: 33 }],
        ['crownT', 'transform', 240, 40, { sx: 1.4, sy: 0.72, oy: 0.2, tiling: false }],
        ['drops', 'splatterCircular', 40, 300, { pattern: 'blob', count: 9, radius: 0.36, size: 0.1, width: 0.8, sizeRand: 0.55, angJitter: 0.45, radJitter: 0.35, seed: 12 }],
        ['dmask', 'ramp', 40, 520, { angle: -90, start: 0.35, end: 0.52, curve: 1 }],  // 硬切:下半部歸零,水滴只留上方
        ['dmul', 'blend', 240, 400, { mode: 'mul' }],                                   // 只保留向上飛濺的水滴
        ['dropT', 'transform', 440, 400, { sy: 0.85, oy: -0.12, tiling: false }],
        ['un', 'blend', 440, 150, { mode: 'max' }],
        ['cel', 'celShade', 640, 150, { tones: 3, terminator: 0.48, lightAngle: -100, relief: 0.6, shadowTone: 0.34, litTone: 0.96, edge: 0.03 }],
        ['line', 'outline', 840, 360, { width: 0.008, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 1040, 200, { mode: 'sub', opacity: 0.4 }],
        ['grad', 'gradientMap', 1240, 200, { preset: 'celWater', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1440, 200],
      ],
      links: [
        ['crown', 'crownT'],
        ['dmask', 'dmul', 0], ['drops', 'dmul', 1], ['dmul', 'dropT'],
        ['dropT', 'un', 0], ['crownT', 'un', 1],
        ['un', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '水冠寬度', def: 0.5, targets: [['crownT', 'sx', 0.8, 1.8]] },
        { label: '水滴數量', def: 0.44, targets: [['drops', 'count', 4, 18]] },
        { label: '水滴大小', def: 0.4, targets: [['drops', 'size', 0.06, 0.24]] },
        { label: '飛濺高度', def: 0.5, targets: [['dropT', 'oy', 0.02, -0.28]] },
        { label: '陰影範圍', def: 0.38, targets: [['cel', 'terminator', 0.25, 0.85]] },
      ],
    },

    // 🧊 卡通冰爆:圓核 + 銳利冰刺放射,高相對立體感做出稜面 → 冰色帶
    celIceBurst: {
      nodes: [
        ['core', 'blobField', 40, 40, { count: 5, size: 0.56, spread: 0.3, taper: 0.2, fuse: 0.5, wobble: 0.25, seed: 17 }],
        ['shard', 'splatterCircular', 40, 300, { pattern: 'spike', count: 9, radius: 0.22, size: 0.26, width: 0.55, sizeRand: 0.4, angJitter: 0.25, seed: 6 }],
        ['un', 'blend', 240, 150, { mode: 'max' }],
        ['xtal', 'cells', 240, 400, { mode: 'crystal', scale: 5, contrast: 1.5, seed: 9 }],
        ['xlv', 'levels', 340, 400, { outLo: 0.55 }],                // 晶格重映射到 0.55~1:只刻淺槽,不整體壓暗
        ['xm', 'blend', 440, 300, { mode: 'mul', opacity: 0.75 }],   // 晶格刻進高度場 → 打光切出稜面
        ['cel', 'celShade', 440, 150, { tones: 4, terminator: 0.44, lightAngle: -125, relief: 0.9, shadowTone: 0.42, litTone: 0.97, edge: 0.02 }],
        ['line', 'outline', 640, 360, { width: 0.008, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 840, 200, { mode: 'sub', opacity: 0.45 }],
        ['grad', 'gradientMap', 1040, 200, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1240, 200],
      ],
      links: [
        ['shard', 'un', 0], ['core', 'un', 1],
        ['xtal', 'xlv'], ['xlv', 'xm', 0], ['un', 'xm', 1], ['xm', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '冰刺數量', def: 0.4, targets: [['shard', 'count', 5, 20]] },
        { label: '冰刺長度', def: 0.5, targets: [['shard', 'size', 0.2, 0.65]] },
        { label: '晶格質感', def: 0.75, targets: [['xm', 'opacity', 0, 1]] },
        { label: '核心大小', def: 0.45, targets: [['core', 'size', 0.3, 0.9]] },
        { label: '稜面強度', def: 0.45, targets: [['cel', 'relief', 0.3, 1.8]] },
      ],
    },

    // 🪨 卡通岩石:分離團塊(低融合)+ 強立體打光 → 平塗稜面 → 灰岩色帶
    celRock: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 6, size: 0.8, spread: 0.38, taper: 0.3, fuse: 0.12, wobble: 0.45, seed: 27 }],
        ['cel', 'celShade', 240, 40, { tones: 3, terminator: 0.52, lightAngle: -120, relief: 0.85, shadowTone: 0.34, litTone: 0.92, edge: 0.02 }],
        ['line', 'outline', 440, 260, { width: 0.011, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 640, 130, { mode: 'sub', opacity: 0.5 }],
        ['grad', 'gradientMap', 840, 130, { preset: 'celSmoke', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1040, 130],
      ],
      links: [
        ['blobs', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '岩塊數量', def: 0.38, targets: [['blobs', 'count', 3, 11]] },
        { label: '岩塊大小', def: 0.5, targets: [['blobs', 'size', 0.5, 1.2]] },
        { label: '稜角分明', def: 0.12, targets: [['blobs', 'fuse', 0, 0.8]] },
        { label: '表面凹凸', def: 0.45, targets: [['blobs', 'wobble', 0, 1]] },
        { label: '受光強度', def: 0.37, targets: [['cel', 'relief', 0.3, 1.8]] },
      ],
    },

    // 🫧 卡通泡泡:幾乎不融合的獨立球體 + 球面打光 → 清水色帶
    celBubble: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 7, size: 0.5, spread: 0.85, taper: 0.1, fuse: 0.02, wobble: 0.08, seed: 41 }],
        ['cel', 'celShade', 240, 40, { tones: 3, terminator: 0.62, lightAngle: -135, relief: 0.7, shadowTone: 0.4, litTone: 0.98, edge: 0.025 }],
        ['line', 'outline', 440, 260, { width: 0.007, side: 'inner', threshold: 0.1 }],
        ['mx', 'blend', 640, 130, { mode: 'max' }],
        ['grad', 'gradientMap', 840, 130, { preset: 'celWater', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1040, 130],
      ],
      links: [
        ['blobs', 'cel'], ['cel', 'line'],
        ['line', 'mx', 0], ['cel', 'mx', 1],
        ['mx', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '泡泡數量', def: 0.4, targets: [['blobs', 'count', 3, 13]] },
        { label: '泡泡大小', def: 0.4, targets: [['blobs', 'size', 0.28, 0.85]] },
        { label: '散開範圍', def: 0.7, targets: [['blobs', 'spread', 0.3, 1.2]] },
        { label: '高光位置', def: 0.5, targets: [['cel', 'lightAngle', -180, 0]] },
        { label: '亮邊粗細', def: 0.25, targets: [['line', 'width', 0.003, 0.02]] },
      ],
    },

    // ☠ 卡通毒霧:蓬鬆霧團 + 卡通打光 → 劇毒色帶
    celPoison: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 10, size: 0.85, spread: 0.6, taper: 0.5, fuse: 0.35, wobble: 0.45, seed: 55 }],
        ['cel', 'celShade', 240, 40, { tones: 3, terminator: 0.55, lightAngle: -110, relief: 0.5, shadowTone: 0.35, litTone: 0.93, edge: 0.05 }],
        ['line', 'outline', 440, 260, { width: 0.009, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 640, 130, { mode: 'sub', opacity: 0.42 }],
        ['grad', 'gradientMap', 840, 130, { preset: 'celToxic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1040, 130],
      ],
      links: [
        ['blobs', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '霧團數量', def: 0.5, targets: [['blobs', 'count', 5, 15]] },
        { label: '霧團大小', def: 0.55, targets: [['blobs', 'size', 0.5, 1.25]] },
        { label: '擴散範圍', def: 0.4, targets: [['blobs', 'spread', 0.25, 1.1]] },
        { label: '翻騰感', def: 0.45, targets: [['blobs', 'wobble', 0, 1]] },
        { label: '陰影範圍', def: 0.5, targets: [['cel', 'terminator', 0.25, 0.85]] },
      ],
    },

    // 🌬 飄絮煙霧(參考 Real Time VFX 的風格化煙霧拆解):
    //   ① 細胞雜訊當底 → 反覆「多向扭曲」拉出飄絮 → 乘柏林做暗袋 → 自動色階
    //   ② 煙形:柔邊圓被多向扭曲成不規則輪廓 → 斜率模糊軟化邊緣
    //   ③ 兩者相乘,再用非均勻模糊讓濃處實、淡處糊
    wispySmoke: {
      nodes: [
        // ① 飄絮底
        ['cell', 'cells', 40, 40, { mode: 'f1', scale: 5, contrast: 1, seed: 3 }],
        ['civ', 'invert', 220, 40, {}],
        ['clv', 'levels', 400, 40, { inLo: 0.12, inHi: 0.78 }],
        ['n1', 'perlin', 40, 260, { scale: 4, octaves: 3, seed: 11 }],
        ['n1b', 'blur', 220, 260, { mode: 'gauss', amount: 2 }],
        ['mw1', 'multiWarp', 600, 40, { mode: 'max', dirs: 4, intensity: 3, angle: 0 }],
        ['mw2', 'multiWarp', 780, 40, { mode: 'min', dirs: 4, intensity: 2, angle: 45 }],
        ['cell2', 'cells', 400, 260, { mode: 'f1', scale: 11, seed: 7 }],
        ['c2b', 'blur', 580, 260, { mode: 'gauss', amount: 1.5 }],
        ['wp', 'warp', 960, 40, { mode: 'grad', intensity: 2 }],
        ['n2', 'perlin', 780, 260, { scale: 3, octaves: 3, seed: 21 }],
        ['mul', 'blend', 1140, 40, { mode: 'mul', opacity: 0.42 }],       // 暗袋
        ['al', 'autoLevels', 1320, 40, { amount: 1 }],
        // ② 煙形
        ['sh', 'shape', 40, 500, { type: 'blob', size: 0.82, falloff: 1.3 }],
        ['mw3', 'multiWarp', 260, 500, { mode: 'max', dirs: 4, intensity: 3.5, angle: 20 }],
        ['shb', 'blur', 460, 620, { mode: 'gauss', amount: 4 }],
        ['sb', 'slopeBlur', 660, 500, { mode: 'max', intensity: 1.5, samples: 7 }],
        // ③ 合併
        ['comb', 'blend', 1500, 260, { mode: 'mul' }],
        ['nub', 'nonUniformBlur', 1680, 260, { amount: 2.5, bias: 0 }],
        ['al2', 'autoLevels', 1860, 260, { amount: 1 }],
        ['grad', 'gradientMap', 2040, 260, { preset: 'celSmoke', steps: 0, alphaGain: 4.5 }],
        ['out', 'output', 2220, 260],
      ],
      links: [
        ['cell', 'civ'], ['civ', 'clv'], ['n1', 'n1b'],
        ['clv', 'mw1', 0], ['n1b', 'mw1', 1],
        ['mw1', 'mw2', 0], ['n1b', 'mw2', 1],
        ['cell2', 'c2b'],
        ['mw2', 'wp', 0], ['c2b', 'wp', 1],
        ['n2', 'mul', 0], ['wp', 'mul', 1],
        ['mul', 'al'],
        ['sh', 'mw3', 0], ['n2', 'mw3', 1],
        ['mw3', 'shb'],
        ['mw3', 'sb', 0], ['shb', 'sb', 1],
        ['sb', 'comb', 0], ['al', 'comb', 1],
        ['comb', 'nub', 0], ['n2', 'nub', 1],
        ['nub', 'al2'], ['al2', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '飄絮拉伸', def: 0.25, targets: [['mw1', 'intensity', 0, 12]] },
        { label: '邊緣收吃', def: 0.17, targets: [['mw2', 'intensity', 0, 12]] },
        { label: '煙形擴散', def: 0.29, targets: [['mw3', 'intensity', 0, 12]] },
        { label: '暗袋濃度', def: 0.55, targets: [['mul', 'opacity', 0, 1]] },
        { label: '邊緣糊化', def: 0.12, targets: [['nub', 'amount', 0, 20]] },
      ],
    },

    // 🛡 卡通護盾:六邊形 → 內距離場切同心層 → 內描邊亮框
    celShield: {
      nodes: [
        ['hex', 'shape', 40, 40, { type: 'poly', sides: 6, size: 0.88, soft: 0.02 }],
        ['iv1', 'invert', 240, 40, {}],
        ['dst', 'distance', 440, 40, { dist: 0.11, curve: 1 }],
        ['iv2', 'invert', 640, 40, {}],
        ['po', 'posterize', 840, 40, { levels: 4, soft: 0 }],
        ['line', 'outline', 840, 260, { width: 0.014, side: 'inner', threshold: 0.1 }],
        ['mx', 'blend', 1040, 130, { mode: 'max' }],
        ['grad', 'gradientMap', 1240, 130, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1440, 130],
      ],
      links: [
        ['hex', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'], ['iv2', 'po'],
        ['po', 'line'], ['line', 'mx', 0], ['po', 'mx', 1],
        ['mx', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '護盾大小', def: 0.6, targets: [['hex', 'size', 0.5, 1.15]] },
        { label: '邊數', def: 0.33, targets: [['hex', 'sides', 3, 12]] },
        { label: '層次厚度', def: 0.5, targets: [['dst', 'dist', 0.04, 0.2]] },
        { label: '色帶層數', def: 0.17, targets: [['po', 'levels', 2, 8]] },
        { label: '亮框粗細', def: 0.4, targets: [['line', 'width', 0.004, 0.03]] },
      ],
    },

    // ⚡ 卡通落雷:垂直錐體被晶格雜訊折成雷柱 + 壓扁的地面衝擊環,雙層(藍身白核)
    celThunder: {
      nodes: [
        // 使用者調校配方 v2(2026-07-20):細膩短收細 + 低光暈
        ['bolt', 'boltGen', 40, 40, { jag: 0.45, branches: 3, width: 0.95, headW: 0.31, tailW: 0.4, taperLen: 0.16, glow: 0.55, endGlow: 0.25, seed: 1367 }],
        ['bT', 'transform', 240, 40, { sy: 0.85, oy: -0.06, tiling: false }],
        ['po', 'posterize', 440, 40, { levels: 10, soft: 0.47 }],
        ['grad', 'gradientMap', 640, 40, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 840, 40],
      ],
      links: [
        ['bolt', 'bT'], ['bT', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '鋸齒程度', def: 0.42, targets: [['bolt', 'jag', 0.2, 0.8]] },
        { label: '分支數量', def: 0.5, targets: [['bolt', 'branches', 0, 6]] },
        { label: '雷束粗細', def: 0.3, targets: [['bolt', 'width', 0.5, 2]] },
        { label: '收細距離', def: 0.24, targets: [['bolt', 'taperLen', 0.05, 0.5]] },
        { label: '色帶層數', def: 0.54, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    // 🌪 卡通龍捲風:上寬下窄的錐體被強力漩渦攪成螺旋 → 同心色帶
    celTornado: {
      nodes: [
        ['cone', 'shape', 40, 40, { type: 'spike', size: 0.95, width: 0.8, falloff: 0.7, soft: 0.07, rot: 180 }],
        ['nz', 'perlin', 40, 260, { scale: 4, octaves: 2, seed: 19 }],
        ['wp', 'warp', 240, 130, { mode: 'grad', intensity: 0.8 }],           // 輕擾動,保住漏斗外形
        ['sc', 'histogramScan', 440, 130, { pos: 0.42, contrast: 0.88 }],     // 漏斗剪影
        ['vr', 'ramp', 240, 380, { angle: 90, start: 0, end: 1, curve: 1 }],
        ['bands', 'crossSection', 440, 380, { pos: 0.5, width: 0.45, repeat: 7, curve: 1 }],  // 水平氣流條紋
        ['bl', 'levels', 640, 380, { outLo: 0.5, outHi: 1 }],                 // 條紋只當明暗,不挖空
        ['mm', 'blend', 840, 200, { mode: 'mul' }],
        ['sw', 'swirl', 1040, 200, { amount: 22, radius: 1.3 }],              // 只微傾斜條紋,過強會把漏斗扭成 S 形捲動
        ['po', 'posterize', 1240, 200, { levels: 4, soft: 0 }],
        ['grad', 'gradientMap', 1440, 200, { preset: 'celSmoke', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1640, 200],
      ],
      links: [
        ['cone', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sc'],
        ['vr', 'bands'], ['bands', 'bl'],
        ['bl', 'mm', 0], ['sc', 'mm', 1],
        ['mm', 'sw'], ['sw', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '漏斗寬度', def: 0.5, targets: [['cone', 'width', 0.5, 1.5]] },
        { label: '氣流條紋', def: 0.4, targets: [['bands', 'repeat', 3, 14]] },
        { label: '旋轉傾斜', def: 0.12, targets: [['sw', 'amount', 0, 180]] },
        { label: '邊緣擾動', def: 0.31, targets: [['wp', 'intensity', 0.3, 4]] },
        { label: '色帶層數', def: 0.29, targets: [['po', 'levels', 2, 8]] },
      ],
    },

    // 💠 卡通水晶:六邊形拉長 → 內距離場當錐面高度 → 卡通打光切出稜面
    celCrystal: {
      nodes: [
        ['gem', 'shape', 40, 40, { type: 'poly', sides: 6, size: 0.72, soft: 0.015 }],
        ['gemT', 'transform', 240, 40, { sx: 0.72, sy: 1.18, tiling: false }],
        ['iv1', 'invert', 440, 40, {}],
        ['dst', 'distance', 640, 40, { dist: 0.16, curve: 1 }],
        ['iv2', 'invert', 840, 40, {}],                                        // 內距離場 = 錐狀高度
        ['sm', 'blur', 940, 40, { mode: 'gauss', amount: 0.7 }],               // 抹平距離場的階梯,避免打光放大成條紋
        ['cel', 'celShade', 1040, 40, { tones: 4, terminator: 0.5, lightAngle: -125, relief: 0.8, shadowTone: 0.34, litTone: 0.97, edge: 0.02 }],
        ['line', 'outline', 1040, 260, { width: 0.01, side: 'inner', threshold: 0.1 }],
        ['sub', 'blend', 1240, 130, { mode: 'sub', opacity: 0.4 }],
        ['grad', 'gradientMap', 1440, 130, { preset: 'celMagic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1640, 130],
      ],
      links: [
        ['gem', 'gemT'], ['gemT', 'iv1'], ['iv1', 'dst'], ['dst', 'iv2'],
        ['iv2', 'sm'], ['sm', 'cel'], ['cel', 'line'],
        ['line', 'sub', 0], ['cel', 'sub', 1],
        ['sub', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '水晶高度', def: 0.4, targets: [['gemT', 'sy', 0.8, 1.8]] },
        { label: '水晶寬度', def: 0.4, targets: [['gemT', 'sx', 0.4, 1.2]] },
        { label: '邊數', def: 0.33, targets: [['gem', 'sides', 3, 12]] },
        { label: '稜面強度', def: 0.37, targets: [['cel', 'relief', 0.3, 1.8]] },
        { label: '階調數', def: 0.67, targets: [['cel', 'tones', 2, 4]] },
      ],
    },

    // 🌟 卡通星塵:四芒星當圖案餵進網格散佈 → 大小/亮度隨機 → 金色
    celStardust: {
      nodes: [
        // 四芒星 = 兩支互相垂直的細長柔邊「針」取亮,兩端自然收尖(比尖刺基部相疊更像閃光)
        ['nd', 'shape', 40, 40, { type: 'blob', size: 1.05, falloff: 1.5 }],
        ['ndV', 'transform', 200, 40, { sx: 0.09, sy: 1, tiling: false }],
        ['ndH', 'transform', 200, 220, { sx: 1, sy: 0.09, tiling: false }],
        ['star', 'blend', 360, 130, { mode: 'max' }],
        ['ts', 'tileSampler', 520, 130, { count: 5, size: 1.7, sizeRand: 0.6, posRand: 0.9, briRand: 0.25, coverage: 0.75, seed: 14 }],
        ['msk', 'shape', 240, 300, { type: 'blob', size: 1.15, falloff: 0.9 }],
        ['mm', 'blend', 440, 130, { mode: 'mul' }],                            // 中央密、邊緣疏
        ['grad', 'gradientMap', 640, 130, { preset: 'celGold', steps: 0, alphaGain: 7 }],
        ['out', 'output', 840, 130],
      ],
      links: [
        ['nd', 'ndV'], ['nd', 'ndH'],
        ['ndV', 'star', 0], ['ndH', 'star', 1],
        ['star', 'ts', 0],
        ['ts', 'mm', 0], ['msk', 'mm', 1],
        ['mm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '星星密度', def: 0.33, targets: [['ts', 'count', 3, 9]] },
        { label: '星星大小', def: 0.4, targets: [['ts', 'size', 0.6, 2.6]] },
        { label: '芒刺纖細', def: 0.3, targets: [['ndV', 'sx', 0.03, 0.25], ['ndH', 'sy', 0.03, 0.25]] },
        { label: '大小差異', def: 0.65, targets: [['ts', 'sizeRand', 0, 1]] },
        { label: '聚集程度', def: 0.5, targets: [['msk', 'size', 0.7, 1.6]] },
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
        ['grad', 'gradientMap', 860, 130, { preset: 'celSmoke', steps: 0, alphaGain: 4 }],
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
        // 這裡原本接 Distance 做 SDF 帶,但那是為了餵給 Glow;卡通化移除 Glow 後
        // 它只會把細裂紋撐成團塊並帶進階梯鋸齒,故拿掉。保留柔邊讓色帶在線寬上做漸層。
        ['sc2', 'histogramScan', 800, 130, { pos: 0.4, contrast: 0.62 }],
        // ── 細節扭曲 ──
        ['wn', 'perlin', 990, 350, { scale: 3, octaves: 2, seed: 8 }],
        ['w1', 'warp', 1180, 130, { mode: 'grad', intensity: 1 }],
        ['c4', 'cells', 1180, 350, { mode: 'f1', scale: 12, seed: 5 }],
        ['c4b', 'blur', 1370, 350, { mode: 'gauss', amount: 1.5 }],
        ['w2', 'warp', 1560, 130, { mode: 'grad', intensity: 0.5 }],
        ['dtl', 'perlin', 1560, 360, { scale: 8, octaves: 3, seed: 177 }],
        ['dm', 'blend', 1560, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 1750, 130, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2130, 130],
      ],
      links: [
        ['cr', 'sb', 0], ['sc', 'iv0'], ['iv0', 'sb', 1],
        ['sb', 'mm', 0], ['sc', 'mm', 1],
        ['rs', 'rw', 0], ['rn', 'rw', 1],
        ['rw', 'rl'], ['rl', 'rb'],
        ['rb', 'sub', 0], ['mm', 'sub', 1],
        ['sub', 'sc2'],
        ['sc2', 'w1', 0], ['wn', 'w1', 1],
        ['c4', 'c4b'],
        ['w1', 'w2', 0], ['c4b', 'w2', 1],
        ['w2', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '裂縫密度', def: 0.38, targets: [['cr', 'scale', 4, 12]] },
        { label: '生長距離', def: 0.37, targets: [['sb', 'intensity', 0.3, 2.2]] },
        { label: '破壞程度', def: 0.5, targets: [['sub', 'opacity', 0, 1]] },
        { label: '裂縫粗細', def: 0.4, targets: [['sc2', 'pos', 0.62, 0.22]] },
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
        ['dtl', 'perlin', 610, 360, { scale: 8, octaves: 3, seed: 187 }],
        ['dm', 'blend', 610, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 800, 130, { preset: 'celMagic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 130],
      ],
      links: [
        ['base', 'wp', 0], ['nz', 'wp', 1],
        ['wp', 'sw'], ['sw', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '能量翻騰', def: 0.42, targets: [['wp', 'intensity', 1.5, 6]] },
        { label: '旋轉動勢', def: 0.5, targets: [['sw', 'amount', 0, 180]] },
        { label: '湍流細節', def: 0.4, targets: [['nz', 'scale', 3, 8]] },
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
        ['grad', 'gradientMap', 800, 220, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 220],
      ],
      links: [
        ['g1', 'hz'], ['g1', 'vt'],
        ['hz', 'mx1', 0], ['vt', 'mx1', 1],
        ['core', 'mx2', 0], ['mx1', 'mx2', 1],
        ['mx2', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '星芒長度', def: 0.45, targets: [['hz', 'sx', 2.5, 4.6], ['vt', 'sy', 2.5, 4.6]] },
        { label: '十字粗細', def: 0.2, targets: [['hz', 'sy', 0.03, 0.14], ['vt', 'sx', 0.03, 0.14]] },
        { label: '光核大小', def: 0.4, targets: [['core', 'size', 0.2, 0.5]] },
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
        ['dtl', 'perlin', 610, 360, { scale: 8, octaves: 3, seed: 205 }],
        ['dm', 'blend', 610, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 800, 130, { preset: 'celMagic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1180, 130],
      ],
      links: [
        ['nz', 'sw'],
        ['sw', 'mm', 0], ['ring', 'mm', 1],
        ['mm', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '漩渦強度', def: 0.43, targets: [['sw', 'amount', 180, 720]] },
        { label: '環厚度', def: 0.5, targets: [['ring', 'width', 0.3, 0.8]] },
        { label: '紊亂細節', def: 0.25, targets: [['nz', 'scale', 2, 6]] },
      ],
    },

    // 💧 水花:中央高斯水核 + 環狀噴濺水滴 取亮 → 寒冰漸層 → 發光
    water: {
      nodes: [
        ['drops', 'splatterCircular', 40, 40, { pattern: 'blob', count: 12, radius: 0.28, size: 0.17, width: 0.5, sizeRand: 0.5, radJitter: 0.35, angJitter: 0.5, seed: 6 }],
        ['core', 'shape', 40, 260, { type: 'gauss', size: 0.52 }],
        ['mx', 'blend', 230, 130, { mode: 'max' }],
        ['dtl', 'perlin', 230, 360, { scale: 8, octaves: 3, seed: 212 }],
        ['dm', 'blend', 230, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 420, 130, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['drops', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
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
        ['dtl', 'perlin', 420, 360, { scale: 8, octaves: 3, seed: 215 }],
        ['dm', 'blend', 420, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 610, 130, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 990, 130],
      ],
      links: [
        ['cr', 'mm', 0], ['mask', 'mm', 1],
        ['mm', 'sc'], ['sc', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '晶格密度', def: 0.3, targets: [['cr', 'scale', 4, 14]] },
        { label: '晶面銳利', def: 0.5, targets: [['sc', 'contrast', 0.3, 0.9]] },
        { label: '範圍大小', def: 0.57, targets: [['mask', 'size', 0.7, 1.4]] },
      ],
    },

    // ☣ 毒液氣泡:網格散佈高斯氣泡(大小/亮度隨機)→ 柔邊圓遮罩增值 → 劇毒漸層 → 發光
    toxic: {
      nodes: [
        ['bub', 'tileSampler', 40, 40, { pattern: 'gauss', count: 6, size: 1.3, sizeRand: 0.6, posRand: 0.6, briRand: 0.4, seed: 3 }],
        ['mask', 'shape', 40, 260, { type: 'blob', size: 1.1, falloff: 1 }],
        ['mm', 'blend', 230, 130, { mode: 'mul' }],
        ['dtl', 'perlin', 230, 360, { scale: 8, octaves: 3, seed: 232 }],
        ['dm', 'blend', 230, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 420, 130, { preset: 'celToxic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['bub', 'mm', 0], ['mask', 'mm', 1],
        ['mm', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
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
        ['dtl', 'perlin', 230, 360, { scale: 8, octaves: 3, seed: 246 }],
        ['dm', 'blend', 230, 240, { mode: 'mul', opacity: 0.35 }],
        ['grad', 'gradientMap', 420, 130, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 800, 130],
      ],
      links: [
        ['rays', 'mx', 0], ['core', 'mx', 1],
        ['mx', 'dm', 1], ['dtl', 'dm', 0], ['dm', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '光條數量', def: 0.4, targets: [['rays', 'count', 12, 32]] },
        { label: '綻放長度', def: 0.53, targets: [['rays', 'size', 0.3, 0.6]] },
        { label: '長度隨機', def: 0.5, targets: [['rays', 'sizeRand', 0, 0.8]] },
      ],
    },

    // 🌫 煙霧:雲絮雜訊自我扭曲 → 柔邊圓遮罩增值 → 色階 → 煙灰漸層
    smoke: {
      nodes: [
        ['blobs', 'blobField', 40, 40, { count: 8, size: 0.95, spread: 0.62, taper: 0.45, fuse: 0.4, wobble: 0.35, seed: 17 }],
        ['cel', 'celShade', 250, 40, { tones: 3, terminator: 0.55, lightAngle: -115, relief: 0.55, shadowTone: 0.55, litTone: 0.95, edge: 0.04 }],
        ['line', 'outline', 460, 260, { width: 0.009, side: 'inner', threshold: 0.1 }],
        ['mx', 'blend', 660, 130, { mode: 'sub', opacity: 0.4 }],
        ['grad', 'gradientMap', 860, 130, { preset: 'celSmoke', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1060, 130],
      ],
      links: [
        ['blobs', 'cel'], ['cel', 'line'],
        ['line', 'mx', 0], ['cel', 'mx', 1],
        ['mx', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '煙團數量', def: 0.4, targets: [['blobs', 'count', 4, 14]] },
        { label: '煙團大小', def: 0.55, targets: [['blobs', 'size', 0.5, 1.3]] },
        { label: '擴散範圍', def: 0.52, targets: [['blobs', 'spread', 0.2, 1]] },
        { label: '手繪抖動', def: 0.35, targets: [['blobs', 'wobble', 0, 1]] },
        { label: '陰影範圍', def: 0.5, targets: [['cel', 'terminator', 0.25, 0.85]] },
      ],
    },

    /* ==== SD 教學串法:能量環(圓環相減 → 斜率模糊漸層 → 環形雜訊多向扭曲 → 中心柔化)==== */
    energyRing: {
      nodes: [
        // 一、基礎環:大圓 − 小圓
        ['big', 'shape', 40, 40, { type: 'disc', size: 0.9, soft: 0.02 }],
        ['sml', 'shape', 40, 240, { type: 'disc', size: 0.78, soft: 0.02 }],
        ['ring', 'blend', 240, 130, { mode: 'sub' }],
        // 二、邊緣漸層:柔圓當斜率圖,外圈保持亮、往中心平滑衰減
        ['soft1', 'shape', 240, 380, { type: 'blob', size: 1.05, falloff: 1.6 }],
        ['sb1', 'slopeBlur', 440, 130, { mode: 'blur', intensity: 4.5, samples: 28 }],
        // 三、扭曲:雜訊經環形映射 → 模糊 → 多向扭曲(不規則邊緣細節)
        ['nz', 'perlin', 440, 380, { scale: 7, octaves: 3, seed: 13 }],
        ['smb', 'blur', 620, 380, { mode: 'gauss', amount: 0.8 }],
                ['mw', 'warp', 340, 130, { mode: 'grad', intensity: 1.4 }],
        // 四、細節層:負強度 Max 斜率模糊往外擴展,再 Max 疊回
        ['soft2', 'shape', 840, 380, { type: 'blob', size: 0.85, falloff: 2 }],
        ['sb2', 'slopeBlur', 840, 130, { mode: 'max', intensity: -2, samples: 16 }],
        ['db', 'blur', 1000, 130, { mode: 'gauss', amount: 0.6 }],
        ['mx', 'blend', 1160, 200, { mode: 'max', opacity: 0.55 }],
        ['core', 'blend', 1160, 60, { mode: 'max', opacity: 0.6 }],
        // 五、中心局部扭曲:雜訊 × 柔圓遮罩,只擾動中心區
        ['cn', 'perlin', 1000, 430, { scale: 4, octaves: 2, seed: 31 }],
        ['cmask', 'shape', 1000, 570, { type: 'blob', size: 1.1, falloff: 1.4 }],
        ['cmul', 'blend', 1160, 500, { mode: 'mul' }],
        ['cmb', 'blur', 1300, 500, { mode: 'gauss', amount: 1.5 }],
        ['cw', 'warp', 1320, 200, { mode: 'grad', intensity: 1.2 }],
        // 六、中心漸層修飾:減去縮小柔圓再大幅模糊 → 黑到灰的平滑過渡
        ['soft3', 'shape', 1320, 640, { type: 'blob', size: 0.55, falloff: 2.4 }],
        ['s3b', 'blur', 1460, 640, { mode: 'gauss', amount: 8 }],
        ['csub', 'blend', 1480, 200, { mode: 'sub', opacity: 0.55 }],
        // 七、平衡與上色
        ['al', 'autoLevels', 1640, 200, { amount: 0.9 }],
        ['fin', 'blur', 1780, 200, { mode: 'gauss', amount: 0.5 }],
        ['grad', 'gradientMap', 1920, 200, { preset: 'celMagic', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2080, 200],
      ],
      links: [
        ['sml', 'ring', 0], ['big', 'ring', 1],
        ['mw', 'sb1', 0], ['soft1', 'sb1', 1],
        ['nz', 'smb'],
        ['ring', 'mw', 0], ['smb', 'mw', 1],
        ['sb1', 'sb2', 0], ['soft2', 'sb2', 1],
        ['sb2', 'db'],
        ['db', 'mx', 0], ['sb1', 'mx', 1],
        ['mw', 'core', 0], ['mx', 'core', 1],
        ['cn', 'cmul', 0], ['cmask', 'cmul', 1], ['cmul', 'cmb'],
        ['core', 'cw', 0], ['cmb', 'cw', 1],
        ['soft3', 's3b'],
        ['s3b', 'csub', 0], ['cw', 'csub', 1],
        ['csub', 'al'], ['al', 'fin'], ['fin', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '環厚度', def: 0.35, targets: [['sml', 'size', 0.84, 0.4]] },
        { label: '邊緣暈開', def: 0.3, targets: [['sb1', 'intensity', 0.5, 6]] },
        { label: '邊緣擾動', def: 0.35, targets: [['mw', 'intensity', 0, 4]] },
        { label: '有機擾動', def: 0.4, targets: [['cw', 'intensity', 0, 3]] },
        { label: '外圈亮線', def: 0.6, targets: [['core', 'opacity', 0, 1]] },
      ],
    },

    /* ==== SD 教學串法:波紋拖尾(Perlin → Cross Section 鏡像漸層 → 掃描取線 → Bevel → 扭曲 → 輝光)==== */
    waveTrail: {
      nodes: [
        // 一、Perlin → Cross Section 鏡像漸層:在畫面中央生成一條隨雜訊起伏的線
        //    scale 壓小以降低重複性,挑出最像單一拖尾的區塊
        ['nz', 'perlin', 40, 40, { scale: 2, octaves: 2, seed: 17 }],
        ['cs', 'crossProfile', 220, 40, { axis: 'h', style: 'line', lineW: 14, row: 0.5, scale: 0.42, base: 0.3, soft: 16 }],
        // 二、Histogram Scan:對比拉滿提取中心線,pos 控制線條粗細
        ['sc', 'histogramScan', 400, 40, { pos: 0.45, contrast: 0.9 }],
        // 三、Bevel:中心最亮、平滑向邊緣淡出的能量漸層
        ['bv', 'bevel', 580, 40, { radius: 1.1, curve: 1.3 }],
        // 四、扭曲:小尺度 Perlin 推出波紋/漩渦,再以多向扭曲柔化線條
        ['wn', 'perlin', 580, 280, { scale: 4, octaves: 3, gain: 0.62, seed: 41 }],
        ['wp', 'warp', 760, 40, { mode: 'grad', intensity: 1.6 }],
        ['mw', 'multiWarp', 940, 40, { mode: 'max', dirs: 4, intensity: 0.8, angle: 0 }],
        // 五、Blur + Blend(Max)產生光暈
        ['gb', 'blur', 1120, 200, { mode: 'gauss', amount: 3 }],
        ['gl', 'blend', 1300, 100, { mode: 'max', opacity: 0.6 }],
        ['grad', 'gradientMap', 1480, 100, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1660, 100],
      ],
      links: [
        ['nz', 'cs'], ['cs', 'sc'], ['sc', 'bv'],
        ['bv', 'wp', 0], ['wn', 'wp', 1],
        ['wp', 'mw', 0], ['wn', 'mw', 1],
        ['mw', 'gb'],
        ['gb', 'gl', 0], ['mw', 'gl', 1],
        ['gl', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '拖尾粗細', def: 0.5, targets: [['sc', 'pos', 0.68, 0.16]] },
        { label: '波紋起伏', def: 0.4, targets: [['nz', 'scale', 1, 6]] },
        { label: '扭曲強度', def: 0.32, targets: [['wp', 'intensity', 0, 5]] },
        { label: '線條圓潤', def: 0.32, targets: [['mw', 'intensity', 0, 2.5]] },
        { label: '光暈強度', def: 0.6, targets: [['gl', 'opacity', 0, 1]] },
      ],
    },

    /* ==== SD 教學串法:銳利電力拖尾(細線 → 方向性扭曲 → 多向扭曲 → 微調 → 標準化)==== */
    electricTrail: {
      nodes: [
        // 一、細線起手(同波紋拖尾,但 histogramScan 調得更細)
        ['nz', 'perlin', 40, 40, { scale: 2, octaves: 2, seed: 29 }],
        ['cs', 'crossProfile', 220, 40, { axis: 'h', style: 'line', lineW: 7, row: 0.5, scale: 0.4, base: 0.3, soft: 7 }],
        ['sc', 'histogramScan', 400, 40, { pos: 0.62, contrast: 0.97 }],
        // 二、方向性扭曲:高頻雜訊 + dir 模式拉出帶方向的長拖尾漸層
        ['dn', 'perlin', 400, 280, { scale: 7, octaves: 3, gain: 0.6, seed: 5 }],
        ['dw', 'warp', 580, 40, { mode: 'dir', intensity: 1.8, angle: 180 }],
        // 三、多向扭曲(min 收邊,增加銳利細節)
        ['mw', 'multiWarp', 760, 40, { mode: 'max', dirs: 3, intensity: 1, angle: 30 }],
        // 四、簡單 warp 微調形狀
        ['wn', 'perlin', 760, 280, { scale: 5, octaves: 2, seed: 61 }],
        ['fw', 'warp', 940, 40, { mode: 'grad', intensity: 1.4 }],
        // 五、標準化 + 上色(冷色調:深紫→亮藍)
        ['al', 'autoLevels', 1120, 40, { amount: 0.9 }],
        ['grad', 'gradientMap', 1300, 40, { preset: 'ice', steps: 0, alphaGain: 4 }],
        ['out', 'output', 1480, 40],
      ],
      links: [
        ['nz', 'cs'], ['cs', 'sc'],
        ['sc', 'dw', 0], ['dn', 'dw', 1],
        ['dw', 'mw', 0], ['dn', 'mw', 1],
        ['mw', 'fw', 0], ['wn', 'fw', 1],
        ['fw', 'al'], ['al', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '拖尾粗細', def: 0.5, targets: [['sc', 'pos', 0.78, 0.42]] },
        { label: '方向拉伸', def: 0.3, targets: [['dw', 'intensity', 0, 6]] },
        { label: '拖尾方向', def: 0.5, targets: [['dw', 'angle', -90, 90]] },
        { label: '銳利細節', def: 0.4, targets: [['mw', 'intensity', 0, 2.5]] },
        { label: '形狀微調', def: 0.35, targets: [['fw', 'intensity', 0, 4]] },
      ],
    },

    /* ==== SD 教學串法:放射裂紋(衝擊)(Cells → 圓形映射 → 多向扭曲 → 侵蝕 → 高光發光)==== */
    radialCrack: {
      nodes: [
        // 一、基礎放射線:裂縫雜訊 → 圓形映射(count 2 從中心放射)→ 反轉 → 乘柔圓去方框
        ['cl', 'cells', 40, 40, { mode: 'edge', scale: 6, contrast: 1.8, seed: 12 }],
        ['smap', 'shapeMapper', 220, 40, { count: 2, r0: 0.02, r1: 0.7 }],
        ['soft', 'shape', 220, 260, { type: 'blob', size: 1.1, falloff: 1.3 }],
        ['mul', 'blend', 560, 40, { mode: 'mul' }],
        ['msc', 'histogramScan', 660, 40, { pos: 0.5, contrast: 0.78 }],
        // 二、方向一致的扭曲:細裂縫經 count 6 圓形映射當強度圖 → 兩方向多向扭曲
        ['cl2', 'cells', 560, 260, { mode: 'edge', scale: 12, contrast: 1.4, seed: 7 }],
        ['smap2', 'shapeMapper', 740, 260, { count: 6, r0: 0.02, r1: 0.75 }],
        ['mw', 'multiWarp', 740, 40, { mode: 'avg', dirs: 2, intensity: 1.4, angle: 0 }],
        // 三、清中心:減去小圓
        ['cc', 'shape', 740, 460, { type: 'blob', size: 0.22, falloff: 2.4 }],
        ['csub', 'blend', 920, 40, { mode: 'sub', opacity: 0.6 }],
        // 四、隨機侵蝕:散佈圓點(中心遮罩反轉保護)→ 減去 → 裂紋隨機缺口
        ['dots', 'tileSampler', 920, 260, { pattern: 'disc', count: 10, size: 0.5, sizeRand: 0.6, posRand: 1, coverage: 0.5, maskInvert: true, maskThreshold: 0.4, seed: 3 }],
        ['esub', 'blend', 1100, 40, { mode: 'sub', opacity: 0.4 }],
        // 五、邊緣細化:模糊 + 距離場做細梯度
        ['bl', 'blur', 1280, 40, { mode: 'gauss', amount: 0.6 }],
        // 六、高光發光:碎塊高光 Add + 模糊光暈 Max
        ['pn', 'perlin', 1280, 260, { scale: 8, octaves: 3, seed: 51 }],
        ['ph', 'histogramScan', 1460, 260, { pos: 0.8, contrast: 0.85 }],
        ['pb', 'blur', 1640, 260, { mode: 'gauss', amount: 1 }],
        ['hadd', 'blend', 1640, 40, { mode: 'add', opacity: 0.18 }],
        ['gb', 'blur', 1820, 200, { mode: 'gauss', amount: 2.2 }],
        ['glow', 'blend', 2000, 40, { mode: 'max', opacity: 0.4 }],
        ['al', 'autoLevels', 2180, 40, { amount: 1 }],
        ['tf', 'transform', 2280, 40, { sx: 1.3, sy: 1.3, tiling: false }],
        // 七、上色(熔岩橘紅)
        ['grad', 'gradientMap', 2360, 40, { preset: 'fire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2540, 40],
      ],
      links: [
        ['cl', 'smap'], ['smap', 'iv'],
        ['smap', 'mul', 0], ['soft', 'mul', 1],
        ['cl2', 'smap2'],
        ['mul', 'msc'], ['msc', 'mw', 0], ['smap2', 'mw', 1],
        ['cc', 'csub', 0], ['mw', 'csub', 1],
        ['cc', 'dots', 1],
        ['dots', 'esub', 0], ['csub', 'esub', 1],
        ['esub', 'bl'],
        ['pn', 'ph'], ['ph', 'pb'],
        ['pb', 'hadd', 0], ['bl', 'hadd', 1],
        ['hadd', 'gb'],
        ['gb', 'glow', 0], ['hadd', 'glow', 1],
        ['glow', 'al'], ['al', 'tf'], ['tf', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '裂紋密度', def: 0.4, targets: [['cl', 'scale', 3, 12]] },
        { label: '裂紋粗細', def: 0.5, targets: [['cl', 'contrast', 2.6, 1.1]] },
        { label: '扭曲不規則', def: 0.3, targets: [['mw', 'intensity', 0.3, 4]] },
        { label: '隨機侵蝕', def: 0.4, targets: [['esub', 'opacity', 0, 0.9]] },
        { label: '高光發光', def: 0.4, targets: [['glow', 'opacity', 0, 1]] },
      ],
    },

    /* ==== SD 教學串法:熾熱地裂(Cells 環狀網 → 中心扭曲挖空 → 破碎扭曲 → 隨機侵蝕 → 雙層發光)==== */
    groundFissure: {
      nodes: [
        // 一、環狀裂紋網:裂縫雜訊 → 圓形映射(count 3 放射)→ 乘柔圓 → 提對比
        ['cl', 'cells', 40, 40, { mode: 'edge', scale: 6, contrast: 1.6, seed: 22 }],
        ['smap', 'shapeMapper', 220, 40, { count: 3, r0: 0.03, r1: 0.75 }],
        ['soft', 'shape', 220, 260, { type: 'blob', size: 1.15, falloff: 1.2 }],
        ['mul', 'blend', 400, 40, { mode: 'mul' }],
        ['msc', 'histogramScan', 560, 40, { pos: 0.42, contrast: 0.72 }],
        // 二、破碎扭曲:銳化 Perlin 當強度圖 → 多向扭曲鋸齒破碎
        ['wn', 'perlin', 560, 260, { scale: 7, octaves: 4, gain: 0.66, seed: 31 }],
        ['mw', 'multiWarp', 740, 40, { mode: 'avg', dirs: 3, intensity: 1.4, angle: 0 }],
        // 三、中心挖空:小圓經 Perlin 扭曲 → 減去
        ['cd', 'shape', 740, 260, { type: 'disc', size: 0.2, soft: 0.06 }],
        ['cn', 'perlin', 740, 440, { scale: 4, octaves: 2, seed: 9 }],
        ['cw', 'warp', 900, 260, { mode: 'grad', intensity: 3 }],
        ['csub', 'blend', 1060, 40, { mode: 'sub', opacity: 0.6 }],
        // 四、隨機侵蝕:散佈圓點(圓遮罩)→ 大模糊 → 減去(平滑漸層缺口)
        ['dots', 'tileSampler', 1060, 260, { pattern: 'disc', count: 7, size: 0.5, sizeRand: 0.6, posRand: 1, coverage: 0.4, maskInvert: true, maskThreshold: 0.4, seed: 6 }],
        ['db', 'blur', 1240, 260, { mode: 'gauss', amount: 4 }],
        ['esub', 'blend', 1240, 40, { mode: 'sub', opacity: 0.3 }],
        // 五、發光:輕模糊 + 雙層 blur Max 熱力擴散
        ['bl', 'blur', 1420, 40, { mode: 'gauss', amount: 0.8 }],
        ['g1', 'blur', 1600, 180, { mode: 'gauss', amount: 2 }],
        ['g2', 'blur', 1600, 340, { mode: 'gauss', amount: 5 }],
        ['gm', 'blend', 1780, 240, { mode: 'max', opacity: 0.5 }],
        ['glow', 'blend', 1780, 40, { mode: 'max', opacity: 0.45 }],
        // 六、高光碎塊 Add
        ['pn', 'perlin', 1780, 440, { scale: 9, octaves: 3, seed: 71 }],
        ['ph', 'histogramScan', 1960, 440, { pos: 0.78, contrast: 0.85 }],
        ['hb', 'blur', 2140, 440, { mode: 'gauss', amount: 1.2 }],
        ['hadd', 'blend', 1960, 40, { mode: 'add', opacity: 0.12 }],
        // 七、標準化 + 上色(黑紅橘 餘燼)
        ['al', 'autoLevels', 2140, 40, { amount: 1 }],
        ['grad', 'gradientMap', 2320, 40, { preset: 'ember', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2500, 40],
      ],
      links: [
        ['cl', 'smap'],
        ['smap', 'mul', 0], ['soft', 'mul', 1], ['mul', 'msc'],
        ['msc', 'mw', 0], ['wn', 'mw', 1],
        ['cd', 'cw', 0], ['cn', 'cw', 1],
        ['cw', 'csub', 0], ['mw', 'csub', 1],
        ['cw', 'dots', 1], ['dots', 'db'],
        ['db', 'esub', 0], ['csub', 'esub', 1],
        ['esub', 'bl'],
        ['bl', 'g1'], ['bl', 'g2'],
        ['g1', 'gm', 0], ['g2', 'gm', 1],
        ['gm', 'glow', 0], ['bl', 'glow', 1],
        ['pn', 'ph'], ['ph', 'hb'],
        ['hb', 'hadd', 0], ['glow', 'hadd', 1],
        ['hadd', 'al'], ['al', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '裂紋密度', def: 0.4, targets: [['cl', 'scale', 3, 11]] },
        { label: '裂紋粗細', def: 0.5, targets: [['cl', 'contrast', 2.4, 1.1]] },
        { label: '破碎程度', def: 0.35, targets: [['mw', 'intensity', 0.3, 4]] },
        { label: '隨機侵蝕', def: 0.35, targets: [['esub', 'opacity', 0, 0.8]] },
        { label: '熱力發光', def: 0.45, targets: [['glow', 'opacity', 0, 1]] },
      ],
    },

    /* ==== SD 教學串法:風格化閃電(Stripe 碎裂 → 多向扭曲 → 剖面分支 → 雙層模糊輝光)==== */
    stylizedLightning: {
      nodes: [
        // 一、主體:長條 - 圓點散佈 = 碎裂邊緣
        ['st', 'shape', 40, 40, { type: 'square', size: 1.15, soft: 0.03 }],
        ['stT', 'transform', 220, 40, { sx: 0.055, sy: 1.2, tiling: false }],
        ['ts', 'tileSampler', 40, 260, { pattern: 'disc', count: 11, size: 0.4, sizeRand: 0.5, posRand: 1.2, coverage: 0.55, seed: 5 }],
        ['sub', 'blend', 400, 130, { mode: 'sub', opacity: 0.7 }],
        // 二、主閃電扭曲 + 銳利化
        ['cl1', 'cells', 400, 330, { mode: 'crystal', scale: 6, seed: 9 }],
        ['mw1', 'warp', 580, 130, { mode: 'grad', intensity: 4.5 }],
        ['sc1', 'histogramScan', 760, 130, { pos: 0.55, contrast: 0.9 }],
        // 三、細節分支:塊狀雜訊 → 垂直剖面(鏡像漸層)→ 扭曲 → 清理
        ['pn', 'perlin', 580, 460, { scale: 5, octaves: 2, seed: 21 }],
        ['cp', 'crossProfile', 760, 460, { axis: 'v', style: 'line', lineW: 2.5, row: 0.5, scale: 0.5, base: 0.25, soft: 5 }],
        ['mw2', 'warp', 940, 460, { mode: 'grad', intensity: 2.5 }],
        ['sc2', 'histogramScan', 1120, 460, { pos: 0.5, contrast: 0.78 }],
        ['add', 'blend', 1120, 260, { mode: 'add', opacity: 0.75 }],
        // 四、二次扭曲 + 雙層模糊 Max 輝光
        ['mw3', 'warp', 1300, 260, { mode: 'grad', intensity: 1.2 }],
        ['b1', 'blur', 1480, 180, { mode: 'gauss', amount: 0.4 }],
        ['b2', 'blur', 1480, 380, { mode: 'gauss', amount: 3.2 }],
        ['mx', 'blend', 1660, 260, { mode: 'max', opacity: 0.55 }],
        // 五、上色輸出
        ['po', 'posterize', 1840, 260, { levels: 12, soft: 0.55 }],
        ['grad', 'gradientMap', 2020, 260, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 2200, 260],
      ],
      links: [
        ['st', 'stT'],
        ['stT', 'ts', 1],                     // 長條當 Mask,圓點只落在長條上
        ['ts', 'sub', 0], ['stT', 'sub', 1],
        ['sub', 'mw1', 0], ['cl1', 'mw1', 1],
        ['mw1', 'sc1'],
        ['pn', 'cp'], ['cp', 'mw2', 0], ['pn', 'mw2', 1], ['mw2', 'sc2'],
        ['sc2', 'add', 0], ['sc1', 'add', 1],
        ['add', 'mw3', 0], ['cl1', 'mw3', 1],
        ['mw3', 'b1'], ['mw3', 'b2'],
        ['b1', 'mx', 0], ['b2', 'mx', 1],
        ['mx', 'po'], ['po', 'grad'], ['grad', 'out'],
      ],
      macros: [
        { label: '碎裂程度', def: 0.62, targets: [['ts', 'coverage', 0, 1]] },
        { label: '扭曲強度', def: 0.5, targets: [['mw1', 'intensity', 1, 8], ['mw3', 'intensity', 0.3, 2.4]] },
        { label: '分支強度', def: 0.75, targets: [['add', 'opacity', 0, 1]] },
        { label: '光暈範圍', def: 0.3, targets: [['b2', 'amount', 1.5, 7]] },
        { label: '色帶層數', def: 0.69, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    /* ==== 移植自 NoiseGenerator 的五個特效(卡通化)==== */

    celSlash: {
      nodes: [
        ['gen', 'slashArc', 40, 40, { radius: 0.36, width: 0.22, span: 143, rot: 0, streak: 0.9, freq: 1, seed: 7 }],
        ['po', 'posterize', 230, 40, { levels: 6, soft: 0.25 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 610, 40],
      ],
      links: [['gen', 'po'], ['po', 'grad'], ['grad', 'out']],
      macros: [
        { label: '弧長範圍', def: 0.74, targets: [['gen', 'span', 60, 180]] },
        { label: '斬擊寬度', def: 0.5, targets: [['gen', 'width', 0.08, 0.36]] },
        { label: '拖絲強度', def: 0.6, targets: [['gen', 'streak', 0, 1.5]] },
        { label: '色帶層數', def: 0.23, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    celTrail: {
      nodes: [
        ['gen', 'trailStrands', 40, 40, { strands: 5, spread: 0.3, decay: 0.85, sway: 1, head: 0.9, streak: 0.6, seed: 12 }],
        ['al', 'autoLevels', 160, 40, { amount: 0.85 }],
        ['po', 'posterize', 300, 40, { levels: 7, soft: 0.25 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'celFire', steps: 0, alphaGain: 4 }],
        ['out', 'output', 610, 40],
      ],
      links: [['gen', 'al'], ['al', 'po'], ['po', 'grad'], ['grad', 'out']],
      macros: [
        { label: '絲束數量', def: 0.33, targets: [['gen', 'strands', 2, 8]] },
        { label: '擺動幅度', def: 0.33, targets: [['gen', 'sway', 0, 3]] },
        { label: '拖尾衰減', def: 0.29, targets: [['gen', 'decay', 0.5, 2.2]] },
        { label: '色帶層數', def: 0.31, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    celBolt: {
      nodes: [
        ['gen', 'boltGen', 40, 40, { jag: 0.34, branches: 3, width: 1.15, headW: 0.25, tailW: 0.2, taperLen: 0.32, glow: 1, endGlow: 0.55, seed: 12 }],
        ['po', 'posterize', 230, 40, { levels: 5, soft: 0.18 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'celGold', steps: 0, alphaGain: 4 }],
        ['out', 'output', 610, 40],
      ],
      links: [['gen', 'po'], ['po', 'grad'], ['grad', 'out']],
      macros: [
        { label: '鋸齒程度', def: 0.35, targets: [['gen', 'jag', 0.15, 0.7]] },
        { label: '分支數量', def: 0.5, targets: [['gen', 'branches', 0, 6]] },
        { label: '光暈強度', def: 0.44, targets: [['gen', 'glow', 0.2, 2]] },
        { label: '收細距離', def: 0.6, targets: [['gen', 'taperLen', 0.05, 0.5]] },
        { label: '色帶層數', def: 0.15, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    celRingBolt: {
      nodes: [
        ['gen', 'ringBolt', 40, 40, { radius: 0.32, loops: 2, jag: 0.32, sparks: 5, width: 1, glow: 1, seed: 5 }],
        ['po', 'posterize', 230, 40, { levels: 5, soft: 0.18 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'celIce', steps: 0, alphaGain: 4 }],
        ['out', 'output', 610, 40],
      ],
      links: [['gen', 'po'], ['po', 'grad'], ['grad', 'out']],
      macros: [
        { label: '電圈半徑', def: 0.58, targets: [['gen', 'radius', 0.18, 0.42]] },
        { label: '鋸齒程度', def: 0.6, targets: [['gen', 'jag', 0.05, 0.5]] },
        { label: '放電火花', def: 0.62, targets: [['gen', 'sparks', 0, 8]] },
        { label: '色帶層數', def: 0.15, targets: [['po', 'levels', 3, 16]] },
      ],
    },

    celMagicCircle: {
      nodes: [
        ['gen', 'magicCircle', 40, 40, { scale: 1, ticks: 30, star: true, runes: true, lineW: 1, glow: 0.13, seed: 4 }],
        ['po', 'posterize', 230, 40, { levels: 6, soft: 0.2 }],
        ['grad', 'gradientMap', 420, 40, { preset: 'celGold', steps: 0, alphaGain: 3.5 }],
        ['out', 'output', 610, 40],
      ],
      links: [['gen', 'po'], ['po', 'grad'], ['grad', 'out']],
      macros: [
        { label: '陣形半徑', def: 0.69, targets: [['gen', 'scale', 0.6, 1.2]] },
        { label: '線條粗細', def: 0.21, targets: [['gen', 'lineW', 0.6, 2.5]] },
        { label: '柔光強度', def: 0.33, targets: [['gen', 'glow', 0, 0.4]] },
        { label: '刻度密度', def: 0.5, targets: [['gen', 'ticks', 12, 48]] },
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
    celExplosion:  { emoji: '🧨', name: '卡通爆炸', en: 'Cel Explosion', cat: 'hit' },
    celMushroom:   { emoji: '🍄', name: '卡通蘑菇雲', en: 'Cel Mushroom', cat: 'hit' },
    celIceBurst:   { emoji: '🧊', name: '卡通冰爆', en: 'Cel Ice Burst', cat: 'hit' },
    celThunder:    { emoji: '⚡', name: '卡通落雷', en: 'Cel Thunder', cat: 'hit' },
    ring:          { emoji: '⭕', name: '環狀衝擊波', en: 'Shockwave', cat: 'hit' },
    trail:         { emoji: '➰', name: '一般拖尾', en: 'Trail', cat: 'trail' },
    stylizedTrail: { emoji: '🎗', name: '風格化拖尾', en: 'Stylized', cat: 'trail' },
    slash:         { emoji: '⚔', name: '近戰揮砍', en: 'Melee Slash', cat: 'trail' },
    groundSlash:   { emoji: '🌋', name: '地面斬擊', en: 'Ground Slash', cat: 'trail' },
    stylizedLightning: { emoji: '⛈', name: '風格化閃電', en: 'Stylized Lightning', cat: 'light' },
    energyRing:    { emoji: '🌀', name: '能量環', en: 'Energy Ring', cat: 'ringcat' },
    waveTrail:     { emoji: '〰', name: '波紋拖尾', en: 'Wave Trail', cat: 'trail' },
    electricTrail: { emoji: '⚡', name: '電力拖尾', en: 'Electric Trail', cat: 'trail' },
    radialCrack:   { emoji: '☄', name: '放射裂紋', en: 'Radial Crack', cat: 'hit' },
    celSlash:      { emoji: '🌙', name: '卡通斬月', en: 'Cel Slash', cat: 'trail' },
    celTrail:      { emoji: '☄', name: '卡通拖尾', en: 'Cel Trail', cat: 'trail' },
    celBolt:       { emoji: '🌩', name: '卡通閃電束', en: 'Cel Bolt', cat: 'light' },
    celRingBolt:   { emoji: '💫', name: '卡通電圈', en: 'Cel Ring Bolt', cat: 'ringcat' },
    celMagicCircle:{ emoji: '🔯', name: '卡通魔法陣', en: 'Cel Magic Circle', cat: 'ringcat' },
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
    celShield:     { emoji: '🛡', name: '卡通護盾', en: 'Cel Shield', cat: 'ringcat' },
    magic:         { emoji: '🪄', name: '魔法陣', en: 'Magic Circle', cat: 'ringcat' },
    pattern:       { emoji: '🔳', name: '規則圖騰', en: 'Pattern', cat: 'ringcat' },
    celSmoke:      { emoji: '☁', name: '卡通煙團', en: 'Cel Smoke', cat: 'surface' },
    groundFissure: { emoji: '🌋', name: '熾熱地裂', en: 'Ground Fissure', cat: 'surface' },
    wispySmoke:    { emoji: '🌬', name: '飄絮煙霧', en: 'Wispy Smoke', cat: 'surface' },
    celRock:       { emoji: '🪨', name: '卡通岩石', en: 'Cel Rock', cat: 'surface' },
    celPoison:     { emoji: '☠', name: '卡通毒霧', en: 'Cel Poison', cat: 'surface' },
    celSplash:     { emoji: '💦', name: '卡通水花', en: 'Cel Splash', cat: 'element' },
    celBubble:     { emoji: '🫧', name: '卡通泡泡', en: 'Cel Bubble', cat: 'element' },
    celCrystal:    { emoji: '💠', name: '卡通水晶', en: 'Cel Crystal', cat: 'element' },
    celStardust:   { emoji: '🌟', name: '卡通星塵', en: 'Cel Stardust', cat: 'element' },
    celTornado:    { emoji: '🌪', name: '卡通龍捲風', en: 'Cel Tornado', cat: 'element' },
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
