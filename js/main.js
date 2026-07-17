'use strict';
/* ============================================================
   main.js — 啟動:優先恢復自動存檔,否則載入火焰範本;
   開啟範本牆作為首頁
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  Editor.init();
  UI.init();
  const saved = UI.loadAutosave();
  UI.setGraph(saved || Presets.get('fire'));
  Editor.fitView();
  UI.openGallery(); // 範本縮圖牆 = 首頁(Esc 直接繼續上次的工作)
});
