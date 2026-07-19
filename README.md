# VFXGEN — 遊戲特效貼圖產生器 (Game VFX Texture Generator)

仿 Substance Designer 節點式工作流的輕量化遊戲特效貼圖生成工具。
純前端、零依賴、所有濾鏡演算法手工實作,現代風格化(卡通)遊戲特效貼圖。
平鋪類特效(雜訊、圖騰、裂縫、細胞)輸出**無縫可平鋪**;方向性精靈圖(拖尾、投射物、揮砍)依設計不平鋪。

## 啟動方式

需要一個靜態伺服器(瀏覽器對 `file://` 的 canvas 操作有安全限制):

```powershell
cd VFXTexture
python -m http.server 8321
# 瀏覽器開啟 http://localhost:8321
```

## 操作

| 操作 | 方式 |
|---|---|
| 載入範本 | 啟動時的**範本縮圖牆**點卡片即套用;頂列「🖼 範本牆」隨時重開(Esc 關閉) |
| 復原 / 重做 | `Ctrl+Z` / `Ctrl+Y`(60 步;含連線、刪除、參數、移動、載入範本) |
| 複製節點 | `Ctrl+D` 或右鍵選單,含參數完整複製 |
| 自動存檔 | 每次變更後自動存到瀏覽器 localStorage;重開頁面自動恢復,範本牆也有「⏪ 上次的工作」卡 |
| 縮放至全圖 | `F` 鍵,載入範本/讀檔時也會自動適配 |
| 右鍵選單 | 空白處 → 搜尋+新增節點於游標;節點上 → 複製/斷線/刪除 |
| 斷開連線 | **雙擊連線**直接斷開(hover 會亮青色),或點選後 Delete |
| 預覽鎖定 | 預覽面板 📌 — 鎖定顯示 Output,調中間節點也能盯著最終結果 |
| 一鍵變體 | 頂列「🎲 變體」隨機化圖中所有種子 |
| 介面主題 | 頂列「🎨」下拉切換 7 種配色(深海青/皇家藍/翡翠綠/電馭紫/暗血紅/烈焰洋紅/熔爐橘),即時套用並記憶 |
| 新增節點 | 左側節點庫:**點擊**加到畫布中央,**拖曳**放到指定位置;每個節點都有演算法即時渲染的縮圖 |
| 節點庫導覽 | 頂端搜尋(中英皆可)、分類標題可摺疊、hover 顯示節點說明於狀態列 |
| 連線 | 從連接埠(圓點)拖曳到另一個埠 |
| 刪除節點/連線 | 點選後按 `Delete` |
| 平移 / 縮放 | 拖曳空白處 / 滾輪 |
| 預覽任意節點 | 點選該節點(未選取時顯示 Output) |
| **精簡 / 進階模式** | 預設**精簡模式**:只有大預覽 + 模板滑桿,節點編輯器完全隱藏;頂列「🔧 進階」展開底層節點圖,「🎛 精簡」收回。模式會記憶 |
| **模板控制** | 精簡模式下右側直接顯示 3–5 個以特效語言命名的巨集滑桿(火舌強度、破碎程度…),寫穿到底層節點;30 個範本全部備有 |
| 調參數(進階) | 進階模式點選節點進入該節點完整參數;只露出關鍵參數,其餘收在「進階參數」摺疊內 |
| 無縫檢查 | 預覽面板勾選「2×2 無縫」(此時暫停動畫,靜態平鋪) |
| 匯出 | 右上「匯出 PNG」(256/512/1024) |
| 存/讀節點圖 | 頂列「存檔 / 讀檔」(JSON) |

> 改動 js/css 後瀏覽器吃到舊快取時,把 index.html 內的 `?v=N` 版本號加一即可。

**手機支援**:≤700px 自動切換直向排版 —— 精簡模式為預覽在上、模板滑桿在下(隨螢幕寬度縮放、觸控放大);範本牆改 2 欄;進階模式節點庫變橫向捲動條、畫布與檢視器上下堆疊。

## 節點總覽(29 種)

- **基礎圖形**:Shape(圓/柔邊圓/高斯/多邊形/環/方/尖刺)、Ramp(線性漸層)、**Blob Field(團塊高度場 — 卡通煙團骨架)**、Tile Sampler(Pattern + Mask 輸入)、Splatter Circular(Pattern 輸入)、Shape Mapper
- **雜訊**:Perlin Noise(fBm/Billow/Ridged)、Cells/Crystal(Voronoi F1/F2−F1/裂縫/色塊)
- **變形扭曲**:Warp(梯度/方向)、**Multi-Dir Warp(多向扭曲 — Max 拉飄絮/Min 收邊)**、Slope Blur(斜率模糊 — 裂縫擴張/侵蝕/融化)、Swirl、Cross Section(等高線提取)、Transform 2D
- **混合**:Blend(Normal/Add/Subtract/Multiply/Max/Min/Screen/Difference)
- **調整**:Histogram Scan、Levels、Invert、Blur(高斯/方向/放射/旋轉)、Bevel、Distance(距離場)、**Cel Shade(卡通打光 — 硬切終端線)**、**Posterize(色調分離)**、**Outline(描邊)**、**Auto Levels(自動色階)**、**Non-Uniform Blur(非均勻模糊)**
- **上色後製**:Gradient Map(16 種色帶:8 組風格化色相位移 + 8 組原始漸層;含色階量化與輪廓銳利度)、Glow、Output

## 內建範本(43 種,覆蓋 1MaFX 常見特效貼圖分類)

| 分類 | 範本 |
|---|---|
| 打擊 / 衝擊 | 🧨 卡通爆炸 Cel Explosion · 🍄 卡通蘑菇雲 Cel Mushroom · 🧊 卡通冰爆 Cel Ice Burst · ⚡ 卡通落雷 Cel Thunder · 💢 碎裂衝擊 Impact · 🎯 圓形撞擊 Circle Impact · 💥 打擊爆閃 Hit Burst · ⭕ 環狀衝擊波 Shockwave |
| 拖尾 / 揮砍 | ➰ 一般拖尾 Trail · 🎗 風格化拖尾 Stylized Trail · ⚔ 近戰揮砍 Melee Slash · 🌋 地面斬擊 Ground Slash |
| 火焰 / 能量 | 🔥 火焰 Flame · ☄ 火球 Fireball · 🚀 投射物 Projectile · 🔫 槍口火光 Muzzle Flash · 🎇 火花碎片 Sparks · 🎞 碎片四格圖 2×2 Flipbook |
| 電光 / 鏡頭 | ⚡ 閃電 Lightning · 🔆 鏡頭光暈 Lens Flare |
| 環形 / 圖騰 | 🛡 卡通護盾 Cel Shield · 🪄 魔法陣 Magic Circle · 🔳 規則圖騰 Pattern |
| 元素 / 自然 | 💦 卡通水花 Cel Splash · 🫧 卡通泡泡 Cel Bubble · 💠 卡通水晶 Cel Crystal · 🌟 卡通星塵 Cel Stardust · 🌪 卡通龍捲風 Cel Tornado · 🔮 能量球 Plasma · ✨ 星芒閃光 Sparkle · 🟡 光塵散景 Bokeh · 🎆 煙花綻放 Firework · 🌀 傳送門 Portal · 💧 水花 Water · ❄ 冰晶 Frost · ☣ 毒液氣泡 Toxic |
| 表面 / 氛圍 | 🌬 飄絮煙霧 Wispy Smoke · 🪨 卡通岩石 Cel Rock · ☠ 卡通毒霧 Cel Poison · 🕸 裂縫 Cracks · 🪨 地裂 Ground Cracks · 🌫 煙霧 Smoke |

每個範本都是完整節點鏈,可直接拆解學習參數。灰階輸出的範本(拖尾/衝擊波/圖騰)刻意不上色,方便在引擎粒子系統內染色。

### 💢 碎裂衝擊(1MaFX Impact 工作流)

依「建構基礎 → 陣列排列 → 局部相減(破壞)→ 疊加細節 → 柔化收尾」五階段串接:

1. **雕刻尖刺**:Polygon 三角形 → Transform(No Tiling)拉長 → 兩顆圓形透過 Blend Subtract 削出弧形刀鋒
2. **環狀陣列**:尖刺接進 Splatter Circular 的「圖案輸入」×5、加大小/半徑隨機 → 圓形 Subtract 挖空中心
3. **雜訊打碎**:Cells → Histogram Scan 拉到高對比碎塊 → 圓形 Multiply 限制範圍 → Subtract 從尖刺上打洞
4. **內部波紋**:圓形被 Perlin 驅動的 Warp 扭曲 → 減去小圓 → 不規則圓環 → Max 疊回主圖
5. **柔化收尾**:Blur 作為引擎 Bloom 基礎
6. **替代分支**(懸掛在圖下方,點選即可預覽):主圖 → **Distance → Histogram Scan → Blur**,瞬間把銳利尖刺變成水滴般圓潤的柔軟版本

### 🎇 火花碎片 & 🎞 2×2 Flipbook(1MaFX Part 3 隨機形狀產生器)

1. **碎片生成**:Disk 接 **Tile Sampler 的 Pattern Input**,6×6、Scale 大幅調高(重疊)、Position Random 拉高
2. **遮罩裁切**:另一顆 Disk 接 **Mask Input**,調整遮罩閾值 — 被剔除的實例在重疊聯集上留下不規則缺口 = 風格化碎片
3. **邊緣打碎**:Slope Blur **取樣數設 1**(不規則跳躍)+ Perlin 驅動 → 自然破碎邊緣
4. **Flipbook 組裝**:4 組不同種子的碎片 → 各自 Transform(縮 0.5、位移 ±0.25)到四象限 → **Add** 合併;引擎內每個粒子隨機取一格,瞬間消除重複感

### 🪨 地裂(1MaFX Ground Cracks 工作流)

1. **基礎裂縫**:Cells(裂縫模式、高對比)產生細裂縫網
2. **擴張生長**:**Slope Blur**(驅動 = 反相軟邊圓、Max 模式)讓裂縫沿半徑向外生長 → Multiply 軟圓集中於圓心
3. **隨機破壞**:軟圓 → Perlin 重度 Warp → Levels 切出不規則塊 → 放射模糊 → Subtract 消除均勻感
4. **SDF 風格化**:Histogram Scan 重新提亮 → **Distance** 把硬邊裂縫轉成連續發光漸層帶(教學的 Invert→Distance→Invert;我們的 Distance 輸出「近亮遠暗」,等效免反相)
5. **細節與上色**:低強度 Perlin Warp 微調 + 模糊後 Cells 二次 Warp 破碎邊緣 → 火焰漸層 + Glow = 岩漿地裂

## 核心演算法備忘(js/filters.js)

- **週期性 Perlin**:格點梯度雜訊,梯度角度以 `hash(mod(x, period))` 取得 → 任何 octave 都無縫;fBm 疊加 lacunarity=2 / gain 可調
- **Voronoi (Cells)**:3×3 鄰域特徵點,回傳 F1 / F2;`F2−F1` 即晶格 (Crystal),反轉即裂縫
- **Warp(梯度扭曲)**:對強度圖取中央差分梯度,位移 `px = ∇s × intensity × W²/1000`(與解析度無關)
- **Cross Section**:`1 − |v − pos| / (width/2)` 提取雜訊等高線 → 平滑波浪線(閃電/拖尾核心)
- **Histogram Scan**:`clamp((v − (pos − w/2)) / w)`,w = 1−contrast → 柔和漸層轉高對比輪廓
- **高斯模糊**:可分離兩趟卷積 + wrap;σ>8 時金字塔降採樣遞迴加速(≈25×)
- **Slope Blur**:預計算斜率圖梯度場,每像素沿梯度連續位移取樣 N 次,以 Max(擴張)/ Min(侵蝕)/ 平均(融化)合成;位移 = 梯度 × intensity × W²/(88×samples)
- **Bevel**:模糊後 `(b−0.5)×2` 重映射作為假距離場,與原圖取 min → 內縮厚度
- **Distance**:兩趟 3-4 倒角距離變換(近似歐氏距離,O(N)),`1 − d/maxDist` 輸出;搭配 Histogram Scan 對距離場取等值線 = 形態學圓角化,尖角瞬間變圓潤
- **Glow**:亮度門檻擷取 → 高斯模糊 → Add 疊回(模擬引擎 Bloom)

## 檔案結構

```
index.html          介面骨架
css/style.css       深色主題(7 種可切換配色)+ 玻璃質感面板
js/filters.js       演算法核心(純函式,無 DOM 依賴,可在 Node 直接跑)
js/nodes.js         29 種節點定義(參數 + eval)
js/graph.js         DAG 模型、拓撲評估、快取、防迴圈、序列化
js/editor.js        節點圖編輯器(拖曳/連線/平移縮放)
js/presets.js       內建範本
js/ui.js            參數面板/預覽/匯出
js/main.js          啟動
```
