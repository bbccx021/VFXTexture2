'use strict';
/* ============================================================
   editor.js — 節點圖視覺編輯器
   平移 / 縮放 / 節點拖曳 / 連線 / 選取 / 刪除
   ============================================================ */

const Editor = (() => {
  let clipNode = null;                  // Ctrl+C 複製的節點(型別+參數)
  let lastMouse = { x: 260, y: 200 };   // 畫布世界座標,Ctrl+V 貼上位置
  const NODE_W = 150;
  const PORT_Y0 = 46, PORT_DY = 22;

  let vp, world, svg, layer;
  const view = { x: 70, y: 40, z: 1 };
  let sel = null;          // { kind:'node', id } | { kind:'link', link }
  let temp = null;         // 連線拖曳中 { nodeId, out, portIdx, x, y }

  const catColor = cat => (NodeCats[cat] || {}).color || '#888';

  function init() {
    vp = document.getElementById('viewport');
    world = document.getElementById('world');
    svg = document.getElementById('wires');
    layer = document.getElementById('nodes-layer');
    applyView();

    // ---- 平移 ----
    vp.addEventListener('pointerdown', e => {
      if (e.target !== vp && e.target !== world && e.target !== svg && e.target !== layer) return;
      const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y;
      let moved = false;
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        view.x = ox + dx; view.y = oy + dy; applyView();
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        if (!moved) select(null);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });

    // ---- 縮放 ----
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nz = Filters.clamp(view.z * k, 0.25, 2.5);
      const f = nz / view.z;
      view.x = cx - (cx - view.x) * f;
      view.y = cy - (cy - view.y) * f;
      view.z = nz;
      applyView();
    }, { passive: false });

    vp.addEventListener('mousemove', e => {
      const w = toWorld(e.clientX, e.clientY);
      lastMouse = { x: w.x - 70, y: w.y - 30 };   // 讓節點中心落在游標處
    });

    // ---- 鍵盤快捷鍵 ----
    window.addEventListener('keydown', e => {
      const typing = document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === 'z' && !e.shiftKey) {
        if (!typing) { e.preventDefault(); App.history.undo(); }
        return;
      }
      if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) {
        if (!typing) { e.preventDefault(); App.history.redo(); }
        return;
      }
      if (ctrl && k === 'd') {
        if (!typing && sel && sel.kind === 'node') { e.preventDefault(); duplicateNode(sel.id); }
        return;
      }
      if (ctrl && k === 'c') {
        if (!typing && sel && sel.kind === 'node') {
          const src = App.graph.nodes.get(sel.id);
          if (src) {
            clipNode = { type: src.type, params: JSON.parse(JSON.stringify(src.params)) };
            const h = document.getElementById('hint');
            if (h) h.textContent = '已複製節點:' + ((NodeDefs[src.type] && NodeDefs[src.type].zh) || src.type) + '(Ctrl+V 貼上)';
            e.preventDefault();
          }
        }
        return;
      }
      if (ctrl && k === 'v') {
        if (!typing && clipNode) {
          e.preventDefault();
          App.history.push();
          const n = App.graph.addNode(clipNode.type, lastMouse.x, lastMouse.y);
          Object.assign(n.params, JSON.parse(JSON.stringify(clipNode.params)));
          rebuild();
          select({ kind: 'node', id: n.id });
          App.onGraphChanged();
        }
        return;
      }
      if (k === 'f' && !ctrl && !typing) { fitView(); return; }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (typing || !sel) return;
      App.history.push();
      if (sel.kind === 'node') App.graph.removeNode(sel.id);
      else App.graph.removeLink(sel.link);
      select(null);
      rebuild();
      App.onGraphChanged();
    });

    // ---- 右鍵選單 ----
    vp.addEventListener('contextmenu', e => {
      e.preventDefault();
      const nodeEl = e.target.closest ? e.target.closest('.node') : null;
      if (nodeEl) {
        const id = +nodeEl.id.replace('node-', '');
        select({ kind: 'node', id });
        UI.showNodeMenu(id, e.clientX, e.clientY);
      } else {
        UI.showCanvasMenu(e.clientX, e.clientY);
      }
    });
  }

  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  }
  function toWorld(cx, cy) {
    const r = vp.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z };
  }

  function portPos(node, out, idx) {
    if (out) return { x: node.x + NODE_W, y: node.y + PORT_Y0 };
    return { x: node.x, y: node.y + PORT_Y0 + idx * PORT_DY };
  }

  // ---------- DOM 重建 ----------
  function rebuild() {
    layer.innerHTML = '';
    for (const node of App.graph.nodes.values()) buildNode(node);
    drawWires();
    highlight();
  }

  function buildNode(node) {
    const def = NodeDefs[node.type];
    const el = document.createElement('div');
    el.className = 'node';
    el.id = 'node-' + node.id;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.style.setProperty('--nc', catColor(def.cat));

    const head = document.createElement('div');
    head.className = 'n-head';
    head.innerHTML = `${def.title}<span class="zh">${def.zh}</span>`;
    el.appendChild(head);

    const body = document.createElement('div');
    body.className = 'n-body';
    const thumb = document.createElement('canvas');
    thumb.className = 'n-thumb';
    thumb.width = 96; thumb.height = 96;
    body.appendChild(thumb);
    el.appendChild(body);
    node._thumb = thumb;

    // 輸入埠
    def.inputs.forEach((inp, idx) => {
      const port = document.createElement('div');
      port.className = 'port in';
      port.style.top = (PORT_Y0 + idx * PORT_DY - 7) + 'px';
      port.style.setProperty('--pc', inp.t === 'c' ? 'var(--cat-color)' : '#8892a4');
      port.dataset.node = node.id; port.dataset.dir = 'in'; port.dataset.idx = idx;
      bindPort(port);
      el.appendChild(port);
      const lb = document.createElement('div');
      lb.className = 'port-label in';
      lb.style.top = (PORT_Y0 + idx * PORT_DY - 5) + 'px';
      lb.textContent = inp.n;
      el.appendChild(lb);
    });
    // 輸出埠
    if (def.out) {
      const port = document.createElement('div');
      port.className = 'port out';
      port.style.top = (PORT_Y0 - 7) + 'px';
      port.style.setProperty('--pc', def.out === 'c' ? 'var(--cat-color)' : '#8892a4');
      port.dataset.node = node.id; port.dataset.dir = 'out'; port.dataset.idx = 0;
      bindPort(port);
      el.appendChild(port);
    }

    // 節點拖曳 + 選取
    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('port')) return;
      e.stopPropagation();
      select({ kind: 'node', id: node.id });
      const start = toWorld(e.clientX, e.clientY);
      const ox = node.x, oy = node.y;
      let pushed = false;
      const mv = ev => {
        if (!pushed) { App.history.push(); pushed = true; } // 移動前存一次復原點
        const cur = toWorld(ev.clientX, ev.clientY);
        node.x = ox + cur.x - start.x;
        node.y = oy + cur.y - start.y;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        drawWires();
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });

    layer.appendChild(el);
  }

  // ---------- 連線拖曳 ----------
  function bindPort(port) {
    port.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      temp = {
        nodeId: +port.dataset.node,
        out: port.dataset.dir === 'out',
        portIdx: +port.dataset.idx,
        x: 0, y: 0,
      };
      const cur = toWorld(e.clientX, e.clientY);
      temp.x = cur.x; temp.y = cur.y;
      drawWires();
      const mv = ev => {
        const c = toWorld(ev.clientX, ev.clientY);
        temp.x = c.x; temp.y = c.y;
        drawWires();
      };
      const up = ev => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const tp = t && t.closest ? t.closest('.port') : null;
        if (tp) {
          const oNode = +tp.dataset.node, oOut = tp.dataset.dir === 'out', oIdx = +tp.dataset.idx;
          const snap = App.history.capture(); // 連線成功才寫入歷史
          let ok = false;
          if (temp.out && !oOut) ok = App.graph.addLink(temp.nodeId, oNode, oIdx);
          else if (!temp.out && oOut) ok = App.graph.addLink(oNode, temp.nodeId, temp.portIdx);
          if (ok) { App.history.commit(snap); App.onGraphChanged(); }
        }
        temp = null;
        drawWires();
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
  }

  // ---------- 連線繪製 ----------
  function wirePath(a, b) {
    const dx = Math.max(45, Math.abs(b.x - a.x) * 0.5);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  function drawWires() {
    let html = '';
    App.graph.links.forEach((l, i) => {
      const from = App.graph.nodes.get(l.from), to = App.graph.nodes.get(l.to);
      if (!from || !to) return;
      const p = wirePath(portPos(from, true, 0), portPos(to, false, l.toPort));
      const isSel = sel && sel.kind === 'link' && sel.link === l;
      html += `<path class="wire${isSel ? ' sel' : ''}" d="${p}"/>`;
      html += `<path class="wire-hit" data-link="${i}" d="${p}"/>`;
    });
    if (temp) {
      const node = App.graph.nodes.get(temp.nodeId);
      if (node) {
        const p0 = portPos(node, temp.out, temp.portIdx);
        const pt = { x: temp.x, y: temp.y };
        const path = temp.out ? wirePath(p0, pt) : wirePath(pt, p0);
        html += `<path class="temp" d="${path}"/>`;
      }
    }
    svg.innerHTML = html;
    svg.querySelectorAll('.wire-hit').forEach(el => {
      const visible = el.previousElementSibling;
      el.addEventListener('pointerdown', e => {
        e.stopPropagation();
        select({ kind: 'link', link: App.graph.links[+el.dataset.link] });
      });
      el.addEventListener('mouseenter', () => visible && visible.classList.add('hover'));
      el.addEventListener('mouseleave', () => visible && visible.classList.remove('hover'));
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        App.history.push();
        App.graph.removeLink(App.graph.links[+el.dataset.link]);
        select(null);
        App.onGraphChanged();
      });
    });
  }

  // ---------- 選取 ----------
  function select(s) {
    sel = s;
    highlight();
    drawWires();
    App.onSelect(sel && sel.kind === 'node' ? App.graph.nodes.get(sel.id) : null);
  }

  function highlight() {
    layer.querySelectorAll('.node').forEach(el => el.classList.remove('sel'));
    if (sel && sel.kind === 'node') {
      const el = document.getElementById('node-' + sel.id);
      if (el) el.classList.add('sel');
    }
  }

  function selectedNode() {
    return sel && sel.kind === 'node' ? App.graph.nodes.get(sel.id) : null;
  }

  function resetView() { view.x = 70; view.y = 40; view.z = 1; applyView(); }

  // 縮放至全圖可見(F 鍵)
  function fitView() {
    const nodes = [...App.graph.nodes.values()];
    if (!nodes.length) { resetView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + NODE_W); y1 = Math.max(y1, n.y + 150);
    }
    const r = vp.getBoundingClientRect(), m = 50;
    const z = Filters.clamp(Math.min((r.width - m * 2) / (x1 - x0), (r.height - m * 2) / (y1 - y0)), 0.2, 1.2);
    view.z = z;
    view.x = (r.width - (x1 - x0) * z) / 2 - x0 * z;
    view.y = (r.height - (y1 - y0) * z) / 2 - y0 * z;
    applyView();
  }

  // 複製節點(含參數)
  function duplicateNode(id) {
    const src = App.graph.nodes.get(id);
    if (!src) return;
    App.history.push();
    const clone = App.graph.addNode(src.type, src.x + 40, src.y + 40);
    Object.assign(clone.params, JSON.parse(JSON.stringify(src.params)));
    rebuild();
    select({ kind: 'node', id: clone.id });
    App.onGraphChanged();
  }

  // 斷開節點的所有連線
  function disconnectNode(id) {
    if (!App.graph.links.some(l => l.from === id || l.to === id)) return;
    App.history.push();
    App.graph.links = App.graph.links.filter(l => {
      if (l.from === id || l.to === id) { App.graph.markDirty(l.to); return false; }
      return true;
    });
    drawWires();
    App.onGraphChanged();
  }

  return { init, rebuild, drawWires, select, selectedNode, resetView, fitView, duplicateNode, disconnectNode, toWorld };
})();
