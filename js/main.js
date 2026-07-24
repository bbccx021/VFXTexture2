'use strict';
/* ============================================================
   main.js — 啟動:優先恢復自動存檔,否則載入火焰範本;
   底部範本膠卷作為首頁
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  Editor.init();
  UI.init();
  const saved = UI.loadAutosave();
  UI.setGraph(saved || Presets.get('fire'));
  Editor.fitView();
  // 首頁即工作區:底部範本膠卷取代自動彈出的範本牆(🖼 按鈕仍可開整面牆)
});
