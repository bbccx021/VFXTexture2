'use strict';
/* ============================================================
   i18n.js — 中英雙語:zh 為原文(寫死於程式),en 查表翻譯
   window.APP_LANG: 'zh' | 'en';tr(s) 於渲染時查表
   ============================================================ */

window.APP_LANG = (() => {
  try { return localStorage.getItem('texforge_lang') === 'en' ? 'en' : 'zh'; } catch (e) { return 'zh'; }
})();

const I18N_EN = {
  /* ---- 頂列 / 靜態 UI ---- */
  '遊戲特效貼圖產生器': 'Game VFX Texture Generator',
  '🖼 範本牆': '🖼 Gallery',
  '🔧 進階': '🔧 Advanced',
  '🎛 精簡': '🎛 Simple',
  '清空': 'Clear',
  '存檔': 'Save',
  '讀檔': 'Load',
  '預覽': 'Preview',
  '輸出': 'Export',
  '⎘ 配方': '⎘ Recipe',
  '⭳ 匯出 PNG': '⭳ Export PNG',
  '節點庫': 'Node Library',
  '參數': 'Params',
  '背景': 'BG',
  '黑色': 'Black',
  '棋盤格': 'Checker',
  '深灰': 'Dark Gray',
  '2×2 無縫': '2×2 Tiled',
  '範本牆': 'Template Gallery',
  '點選縮圖載入完整節點鏈,可自由拆解修改 · Esc 關閉': 'Click a thumbnail to load its full node chain · Esc to close',
  '點選節點以編輯參數': 'Select a node to edit parameters',
  '此節點沒有參數': 'This node has no parameters',
  '✨ 模板控制': '✨ Template Controls',
  '特效種類': 'Effect Type',
  '🎨 配色': '🎨 Colors',
  '🎨 配色 COLOR RAMP': '🎨 COLOR RAMP',
  '以特效語言調整整條節點鏈;點任何節點可進入進階參數。': 'Tune the whole chain with effect-language sliders; click any node for advanced params.',
  '工作階段': 'Session', '全部': 'All', '範本膠卷': 'Template Reel',
  '色帶編輯器': 'Ramp Editor', '新增自訂色帶': 'New Custom Ramp', '色標': 'Stop', '儲存': 'Save',
  '上次的工作': 'Last Session',
  '空白畫布': 'Blank Canvas',
  '🔍 搜尋節點…': '🔍 Search nodes…',
  '🔍 新增節點於此…': '🔍 Add node here…',
  '🔍 新增並自動連接…': '🔍 Add & auto-connect…',
  '📄 複製節點': '📄 Duplicate',
  '✂ 斷開所有連線': '✂ Disconnect all',
  '🗑 刪除節點': '🗑 Delete',
  'Ctrl+Z 復原 · Space 新增節點 · 框選多選 · 中鍵/Shift 平移 · Ctrl+C/V 複製貼上 · F 全覽 · Delete 刪除':
    'Ctrl+Z Undo · Space Add Node · Marquee Select · Middle/Shift Pan · Ctrl+C/V Copy-Paste · F Fit · Delete',
  '此節點圖沒有模板滑桿。': 'This graph has no template sliders.',
  '🖼 範本牆按鈕': 'Gallery',
  '🔧 進階編輯': 'Advanced Edit',
  /* ---- 主題 ---- */
  '熔光琥珀': 'Forge Amber', '寒鐵靛青': 'Cold Iron', '皇家藍': 'Royal Blue', '翡翠爐': 'Jade Furnace',
  '血月紅': 'Blood Moon', '紫電': 'Volt Violet', '月銀': 'Moon Silver',
  /* ---- 節點分類 ---- */
  '基礎圖形': 'Basic Shapes', '特效生成': 'FX Generators', '雜訊': 'Noise', '變形扭曲': 'Distort', '混合': 'Blend',
  '調整': 'Adjust', '風格化': 'Stylize', '輸出': 'Output', '上色後製': 'Color',
  /* ---- 節點中文名(EN 模式下作為副標隱藏,備查)---- */
  /* ---- 範本分類 ---- */
  '打擊 / 衝擊': 'Impact / Hit', '拖尾 / 揮砍': 'Trail / Slash', '火焰 / 能量': 'Fire / Energy',
  '電光 / 鏡頭': 'Electric / Lens', '環形 / 圖騰': 'Ring / Sigil', '元素 / 自然': 'Element / Nature',
  '表面 / 氛圍': 'Surface / Ambient',
  /* ---- 色帶名稱 ---- */
  '火焰 紅橙黃': 'Fire', '寒冰 青藍': 'Ice', '閃電 藍白': 'Lightning', '劇毒 綠': 'Toxic',
  '奧術 紫紅': 'Arcane', '聖金 黃': 'Gold', '煙霧 灰階': 'Smoke', '餘燼 暗紅': 'Ember',
  '風格化 火': 'Cel Fire', '風格化 冰': 'Cel Ice', '風格化 魔法': 'Cel Magic', '風格化 劇毒': 'Cel Toxic',
  '風格化 聖金': 'Cel Gold', '風格化 煙': 'Cel Smoke', '風格化 血': 'Cel Blood', '風格化 水': 'Cel Water',
  /* ---- 節點說明(節點庫 tooltip)---- */
  '產生圓、多邊形、環、尖刺等基礎圖形': 'Basic shapes: disc, polygon, ring, spike…',
  '線性漸層 — 拖尾淡出、方向遮罩必備': 'Linear ramp — trail fades & directional masks',
  '網格陣列散佈圖案,大小/位置可隨機': 'Grid scatter with size/position randomness',
  '沿圓環散佈圖案,可接自訂圖案輸入': 'Scatter instances along a circle; custom pattern input',
  '把輸入圖案繞成環形陣列(魔法陣)': 'Wrap input pattern into a ring array (magic circle)',
  '弧月斬擊 — 帶拖絲的弧形刀光': 'Crescent slash arc with streaks',
  '拖尾絲束 — 多股擺動衰減的彗尾': 'Multi-strand decaying comet trail',
  '閃電束 — 碎形折線主幹加分支': 'Fractal lightning bolt with branches',
  '環形電圈 — 閉合碎形電環加放電火花': 'Closed fractal electric ring with sparks',
  '魔法陣 — 環、刻度、六芒星與咒文符文': 'Magic circle: rings, ticks, hexagram, runes',
  '自然平滑的分形雜訊,扭曲的標準驅動源': 'Smooth fractal noise — the standard warp driver',
  'Voronoi 細胞雜訊 — 晶格、裂縫、色塊': 'Voronoi cells — crystals, cracks, blocks',
  '用強度圖梯度推擠影像(火焰/閃電核心)': 'Push pixels along slope-map gradient',
  '沿斜率圖梯度反覆位移取樣 — 裂縫擴張、侵蝕、融化': 'Iterative slope displacement — grow, erode, melt',
  '多向扭曲 — Max 拉出飄絮拖絲、Min 收邊,風格化煙霧核心': 'Multi-dir warp — Max pulls wisps, Min eats edges',
  '自動色階 — 把實際動態範圍拉滿,救回流失的對比': 'Auto levels — stretch used range to full',
  '非均勻模糊 — 由半徑圖控制各處模糊量': 'Blur with per-pixel radius from a map',
  '以中心為軸螺旋扭曲(火舌、氣流)': 'Spiral twist around center',
  '從灰階提取等高線亮帶(閃電/拖尾)': 'Extract iso-line bands from grayscale',
  '剖面圖 — 掃描線亮度化為輪廓;實心/漸層/鏡像/線條四種樣式': 'Cross-section profile; solid/gradient/mirrored/line styles',
  '縮放/旋轉/平移,可關閉拼貼': 'Scale / rotate / offset; tiling optional',
  '雙圖混合 — 減去挖空、取亮疊加、增值遮罩': 'Two-input blend — subtract, max, multiply…',
  '把柔和漸層掃成高對比硬邊輪廓': 'Scan soft gradients into hard silhouettes',
  '色階 — 黑白點與 Gamma 重新映射': 'Levels — black/white points and gamma',
  '閾值 — 硬切黑白,分離溫度層/精準遮罩(對比拉滿的掃描)': 'Threshold — hard black/white cut for temperature tiers & masks',
  '亮度對比 — 最直接的明暗與反差控制': 'Brightness / contrast with pivot',
  '色調曲線 — 五點控制暗部/中間調/亮部,做 S 曲線或反差': 'Five-point tone curve — S-curves & contrast',
  '範圍裁切 — 只保留某段灰階並拉伸回滿幅,挑亮度層做遮罩': 'Clamp a gray range and restretch — isolate bands',
  '色彩調整 — 上色後修色相/飽和/亮度/對比/透明度': 'Hue / saturation / brightness / contrast / alpha',
  '反轉灰階': 'Invert grayscale',
  '高斯/方向/放射/旋轉模糊': 'Gaussian / directional / zoom / spin blur',
  '高斯模糊 — X/Y 各軸倍率,可做方向性拉絲': 'Gaussian blur with per-axis X/Y — directional smears',
  '橫向 ×': 'X ×', '縱向 ×': 'Y ×',
  '為扁平圖形加內斜角假厚度': 'Fake bevel thickness for flat shapes',
  '距離場 — 搭配掃描把尖角變圓潤': 'Distance field — round off sharp corners',
  '球體聯集高度場 — 卡通煙團/雲朵的骨架': 'Blob-union heightfield — cartoon smoke skeleton',
  '卡通打光 — 高度場硬切成 2~4 階平塗(終端線)': 'Cel shading — hard 2–4 tone terminator',
  '色調分離 — 量化成 N 階平塗,卡通化任何素材': 'Posterize — quantize to N flat tones',
  '描邊 — 距離場取環帶,做卡通輪廓線': 'Outline — ring band from distance field',
  '灰階對應色帶上色(火/電/毒…)': 'Map grayscale through a color ramp',
  '模擬遊戲引擎 Bloom 發光': 'Game-engine style bloom glow',
  '最終輸出節點,匯出以此為準': 'Final output node for export',
  /* ---- 參數標籤 ---- */
  'Alpha=亮度': 'Alpha = Luma', '上方收窄': 'Top Taper', '上限': 'High', '下限': 'Low',
  '不透明度': 'Opacity', '中間 (0.50)': 'Mid (0.50)', '亮度': 'Brightness',
  '亮度衰減(首→尾)': 'Bright Fade (seq)', '亮度隨機': 'Bright Rand', '亮部 (0.75)': 'Light (0.75)',
  '亮面亮度': 'Lit Tone', '位移 X': 'Offset X', '位移 Y': 'Offset Y', '位置': 'Position',
  '位置隨機': 'Pos Rand', '保留填色': 'Keep Fill', '光暈半徑': 'Glow Radius',
  '光源前傾': 'Light Pitch', '光源角度°': 'Light Angle°', '內半徑': 'Inner R', '六芒星': 'Hexagram',
  '分支數': 'Branches', '切片方向': 'Slice Axis', '刻度數': 'Ticks', '半徑': 'Radius',
  '半徑偏移': 'Radius Bias', '半徑抖動': 'Radius Jitter', '半徑螺旋(首→尾)': 'Radius Spiral (seq)',
  '反轉結果': 'Invert Out', '反轉輸入': 'Invert In', '反轉遮罩': 'Invert Mask',
  '取樣數(1=不規則)': 'Samples (1=rough)', '取樣線位置': 'Sample Line', '合成方式': 'Combine',
  '咒文符文': 'Runes', '圖形': 'Shape', '圖案(無輸入時)': 'Pattern (fallback)',
  '團塊大小': 'Blob Size', '團塊數': 'Blob Count', '型態': 'Type', '填色亮度': 'Fill Tone',
  '外半徑': 'Outer R', '大小': 'Size', '大小漸變(首→尾)': 'Size Fade (seq)', '大小隨機': 'Size Rand',
  '套用程度': 'Amount', '寬度': 'Width', '寬度比': 'Width Ratio', '對比': 'Contrast',
  '對比軸心': 'Pivot', '尖刺銳度': 'Spike Sharp', '尾端粗細': 'Tail Width', '弧半徑': 'Arc Radius',
  '弧寬': 'Arc Width', '弧長°': 'Arc Span°', '弧長範圍°': 'Arc Range°', '強度': 'Intensity',
  '強度(負=反向)': 'Intensity (±)', '形狀門檻': 'Shape Cutoff', '影響半徑': 'Radius',
  '徑向翻轉': 'Radial Flip', '手繪抖動': 'Wobble', '拉伸回滿幅': 'Restretch',
  '拖絲強度': 'Streaks', '拼貼 Tiling': 'Tiling', '擷取位置': 'Pick Pos', '擺動': 'Sway',
  '收細距離': 'Taper Dist', '放電火花': 'Sparks', '散開幅度': 'Spread', '整體旋轉°': 'Rotate All°',
  '數量': 'Count', '方向°': 'Angle°', '方向數': 'Directions', '旋轉°': 'Rotation°',
  '旋轉量°': 'Twist°', '旋轉隨機': 'Rot Rand', '暗部 (0.25)': 'Dark (0.25)', '暗面亮度': 'Shadow Tone',
  '曲率': 'Curvature', '曲線': 'Curve', '曲線硬度': 'Hardness', '最大半徑': 'Max Radius',
  '最大距離': 'Max Distance', '末端光球': 'End Glow', '柔光強度': 'Soft Glow', '柔暈比重': 'Halo Mix',
  '格數': 'Grid', '模式': 'Mode', '環半徑': 'Ring Radius', '環數': 'Loops', '疊代層數': 'Octaves',
  '發光門檻': 'Glow Cutoff', '白點 (1.00)': 'White (1.00)', '白點位置': 'White Point',
  '相位旋轉°': 'Phase°', '種子': 'Seed', '立體強度': 'Relief', '粗細隨機': 'Width Rand',
  '細節強度': 'Detail', '終端線位置': 'Terminator', '終端線柔度': 'Term Soft', '絲密度': 'Streak Freq',
  '絲束數': 'Strands', '絲紋強度': 'Streak Amt', '線寬': 'Line Width', '線條粗細': 'Line Width',
  '線條粗細(px)': 'Line Width (px)', '縮放 X': 'Scale X', '縮放 Y': 'Scale Y', '縮放(格)': 'Scale (cells)',
  '繪製樣式': 'Draw Style', '翻轉方向': 'Flip', '聚集範圍': 'Cluster', '色帶': 'Ramp',
  '色相偏移°': 'Hue Shift°', '色階數(0=平滑)': 'Steps (0=smooth)', '融合圓滑': 'Fuse Smooth',
  '衰減': 'Decay', '衰減曲線': 'Falloff', '覆蓋率': 'Coverage', '角度抖動': 'Angle Jitter',
  '起始角°': 'Start Angle°', '輪廓銳利度': 'Edge Sharp', '輸入白點': 'In White', '輸入黑點': 'In Black',
  '輸出白點': 'Out White', '輸出黑點': 'Out Black', '透明度倍率': 'Alpha Gain', '遮罩閾值': 'Mask Thresh',
  '邊數': 'Sides', '邊緣柔化': 'Edge Soft', '邊緣柔度(px)': 'Edge Soft (px)', '重複數': 'Repeat',
  '重複次數': 'Repeats', '鋸齒程度': 'Jaggedness', '鏡像(兩端暗)': 'Mirror', '長度': 'Length',
  '長度隨機': 'Length Rand', '陣形半徑': 'Circle Scale', '階梯柔度': 'Step Soft', '階調偏移': 'Level Bias',
  '階調數': 'Levels', '頭端粗細': 'Head Width', '頭部亮核': 'Head Glow', '飽和度': 'Saturation',
  '高度位移': 'Height Offset', '高度縮放': 'Height Scale', '黑白反轉': 'Invert', '黑點 (0.00)': 'Black (0.00)',
  '黑點位置': 'Black Point',
  '節點': 'nodes',
  '🌐 語言': '🌐 Language', '🎨 主題': '🎨 Theme',
  '點擊直接輸入數值': 'Click to type a value', '點擊直接輸入 0~100': 'Click to type 0-100',
  '收合節點庫': 'Collapse node library', '展開節點庫': 'Expand node library',
  '收合預覽面板': 'Collapse preview panel', '展開預覽面板': 'Expand preview panel',
  /* ---- 巨集滑桿標籤 ---- */
  '中心光核': 'Core Glow', '中心大小': 'Center Size', '中心空洞': 'Center Hole', '亮核大小': 'Core Size',
  '亮核粗細': 'Core Width', '亮框粗細': 'Frame Width', '亮邊粗細': 'Rim Width', '光暈強度': 'Glow Amount',
  '光暈範圍': 'Glow Range', '光核大小': 'Core Size', '光條數量': 'Ray Count', '內圈亮度': 'Inner Bright',
  '內圈大小': 'Inner Size', '內環大小': 'Inner Ring', '內部流動': 'Inner Flow', '冰刺數量': 'Shard Count',
  '冰刺長度': 'Shard Length', '刀身長度': 'Blade Length', '分支密度': 'Branch Density', '分支強度': 'Branch Amount',
  '分支數量': 'Branch Count', '刻度密度': 'Tick Density', '動勢拉伸': 'Motion Stretch', '十字粗細': 'Cross Width',
  '受光強度': 'Light Amount', '噴濺半徑': 'Splash Radius', '圓點大小': 'Dot Size', '圓點密度': 'Dot Density',
  '團塊數量': 'Blob Count', '外圈光暈': 'Outer Glow', '外環大小': 'Outer Ring', '大小差異': 'Size Variance',
  '尖刺數量': 'Spike Count', '尖刺長度': 'Spike Length', '尾焰模糊': 'Tail Blur', '尾焰淡出': 'Tail Fade',
  '尾焰長度': 'Tail Length', '層次厚度': 'Layer Depth', '岩塊大小': 'Rock Size', '岩塊數量': 'Rock Count',
  '弧帶厚度': 'Arc Thickness', '弧長範圍': 'Arc Range', '彈頭大小': 'Head Size', '彎折強度': 'Bend Amount',
  '扭折強度': 'Kink Amount', '扭曲強度': 'Warp Amount', '扭曲拉絲': 'Warp Streaks', '拉絲雜訊': 'Streak Noise',
  '拖尾粗細': 'Trail Width', '拖尾衰減': 'Trail Decay', '拖尾長度': 'Trail Length', '描邊粗細': 'Outline Width',
  '擴散範圍': 'Spread Range', '擺動幅度': 'Sway Amount', '攪動旋轉': 'Stir Twist', '放射光條': 'Radial Rays',
  '散佈範圍': 'Scatter Range', '散焦模糊': 'Defocus', '散開範圍': 'Spread', '整體高度': 'Overall Height',
  '斬擊寬度': 'Slash Width', '旋轉傾斜': 'Tilt', '旋轉動勢': 'Spin Motion', '星星大小': 'Star Size',
  '星星密度': 'Star Density', '星芒數量': 'Ray Count', '星芒長度': 'Ray Length', '晶格密度': 'Cell Density',
  '晶格質感': 'Crystal Facets', '晶面銳利': 'Facet Sharp', '暗袋濃度': 'Dark Pockets', '有機扭曲': 'Organic Warp',
  '核心大小': 'Core Size', '條紋數量': 'Stripe Count', '條紋混合': 'Stripe Mix', '氣泡大小': 'Bubble Size',
  '氣泡密度': 'Bubble Density', '氣流條紋': 'Flow Streaks', '水冠寬度': 'Crown Width', '水晶寬度': 'Crystal Width',
  '水晶高度': 'Crystal Height', '水滴大小': 'Drop Size', '水滴數量': 'Drop Count', '泡泡大小': 'Bubble Size',
  '泡泡數量': 'Bubble Count', '波動強度': 'Wave Amount', '淡出位置': 'Fade Position', '湍流細節': 'Turbulence',
  '漏斗寬度': 'Funnel Width', '漩渦強度': 'Swirl Amount', '火焰高度': 'Flame Height', '火舌擾動': 'Tongue Warp',
  '火雲團數': 'Cloud Count', '煙團大小': 'Puff Size', '煙團數量': 'Puff Count', '煙形擴散': 'Smoke Spread',
  '爆炸範圍': 'Blast Range', '環厚度': 'Ring Thickness', '環扭曲': 'Ring Warp', '生長距離': 'Grow Distance',
  '破壞程度': 'Damage', '破碎程度': 'Breakage', '碎片大小': 'Debris Size', '碎片數量': 'Debris Count',
  '碎片長度': 'Debris Length', '碎裂程度': 'Fracture', '稜角分明': 'Angularity', '稜面強度': 'Facet Amount',
  '符文數量': 'Rune Count', '範圍大小': 'Range Size', '粒子大小': 'Particle Size', '粒子密度': 'Particle Density',
  '紊亂細節': 'Chaos Detail', '絲束數量': 'Strand Count', '綻放長度': 'Bloom Length', '翻騰感': 'Billow',
  '聚集程度': 'Clustering', '能量翻騰': 'Energy Roll', '色帶層數': 'Band Count', '芒刺纖細': 'Ray Thinness',
  '表面凹凸': 'Surface Bump', '裂縫密度': 'Crack Density', '裂縫粗細': 'Crack Width', '護盾大小': 'Shield Size',
  '輪廓緊實': 'Silhouette Tight', '遮罩範圍': 'Mask Range', '邊緣圓潤': 'Edge Round', '邊緣擾動': 'Edge Warp',
  '邊緣收吃': 'Edge Erode', '邊緣破碎': 'Edge Break', '邊緣粗糙': 'Edge Rough', '邊緣糊化': 'Edge Smear',
  '鋸齒稜角': 'Jagged Edges', '閃電粗細': 'Bolt Width', '陰影範圍': 'Shadow Range', '雲柱粗細': 'Column Width',
  '雲蓋寬度': 'Cap Width', '雷束粗細': 'Bolt Width', '電圈半徑': 'Ring Radius', '霧團大小': 'Fog Size',
  '霧團數量': 'Fog Count', '頂端碎裂': 'Top Break', '飄絮拉伸': 'Wisp Stretch', '飛濺高度': 'Splash Height',
  '高光位置': 'Highlight Pos',
};

window.tr = s => (window.APP_LANG === 'en' && I18N_EN[s]) || s;

// 靜態 DOM 翻譯(EN 模式;預設 HTML 即中文)
window.applyStaticLang = function () {
  if (window.APP_LANG !== 'en') return;
  const setTxt = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
  setTxt('#btn-gallery', tr('🖼 範本牆'));
  setTxt('#btn-clear', tr('清空')); setTxt('#btn-save', tr('存檔')); setTxt('#btn-load', tr('讀檔'));
  setTxt('#btn-recipe', tr('⎘ 配方')); setTxt('#btn-export', tr('⭳ 匯出 PNG'));
  setTxt('.lib-title', tr('節點庫'));
  setTxt('#hint', tr('Ctrl+Z 復原 · Space 新增節點 · 框選多選 · 中鍵/Shift 平移 · Ctrl+C/V 複製貼上 · F 全覽 · Delete 刪除'));
  setTxt('.g-title', tr('範本牆')); setTxt('.g-sub', tr('點選縮圖載入完整節點鏈,可自由拆解修改 · Esc 關閉'));
  const bs = document.querySelector('.brand-sub');
  if (bs) bs.textContent = tr('遊戲特效貼圖產生器');
  // 頂列 label(預覽/輸出)與預覽區 label(背景)
  document.querySelectorAll('#topbar label').forEach(l => { l.textContent = tr(l.textContent.trim()); });
  document.querySelectorAll('.preview-ctl label:not(.chk)').forEach(l => { l.textContent = tr(l.textContent.trim()); });
  const chk = document.querySelector('.preview-ctl .chk');
  if (chk) { const t = [...chk.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (t) t.textContent = ' ' + tr('2×2 無縫'); }
  // 預覽背景選項
  document.querySelectorAll('#preview-bg option').forEach(o => { o.textContent = tr(o.textContent.trim()); });
  // 主題選項
  document.querySelectorAll('#theme-select option').forEach(o => {
    o.textContent = tr(o.textContent.trim());
  });
  // 區塊標題(預覽/參數 — sec-title 的第一個文字節點)
  document.querySelectorAll('.sec-title').forEach(el => {
    const t = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (t) t.textContent = tr(t.textContent.trim());
  });
  [['#lib-collapse','收合節點庫'],['#lib-expand','展開節點庫'],['#insp-collapse','收合預覽面板'],['#insp-expand','展開預覽面板']]
    .forEach(([sel, zh]) => { const el = document.querySelector(sel); if (el) el.title = tr(zh); });
  document.querySelectorAll('#settings-menu .sm-label').forEach(l => { l.textContent = tr(l.textContent.trim()); });
  const pe = document.querySelector('.params-empty');
  if (pe) pe.textContent = tr('點選節點以編輯參數');
};
