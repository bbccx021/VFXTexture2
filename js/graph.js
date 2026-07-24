'use strict';
/* ============================================================
   graph.js — 節點圖資料模型與評估引擎
   節點:{ id, type, x, y, params, _dirty, _cache:{res, buf} }
   連線:{ from, to, toPort }(輸出埠固定只有一個)
   ============================================================ */

class NodeGraph {
  constructor() {
    this.nodes = new Map();
    this.links = [];
    this.nextId = 1;
  }

  addNode(type, x, y) {
    const def = NodeDefs[type];
    if (!def) return null;
    const params = {};
    for (const p of def.params) params[p.k] = p.def;
    const node = { id: this.nextId++, type, x, y, params, _dirty: true, _cache: null };
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(id) {
    this.links = this.links.filter(l => {
      if (l.from === id || l.to === id) { this.markDirty(l.to); return false; }
      return true;
    });
    this.nodes.delete(id);
  }

  // 是否從 a 沿連線可到達 b(防止迴圈)
  reaches(a, b) {
    if (a === b) return true;
    const stack = [a], seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      for (const l of this.links) {
        if (l.from === cur && !seen.has(l.to)) {
          if (l.to === b) return true;
          seen.add(l.to); stack.push(l.to);
        }
      }
    }
    return false;
  }

  addLink(from, to, toPort) {
    if (from === to) return false;
    if (this.reaches(to, from)) return false; // 會形成迴圈
    this.links = this.links.filter(l => !(l.to === to && l.toPort === toPort));
    this.links.push({ from, to, toPort });
    this.markDirty(to);
    return true;
  }

  removeLink(link) {
    const i = this.links.indexOf(link);
    if (i >= 0) { this.links.splice(i, 1); this.markDirty(link.to); }
  }

  // 髒標記向下游傳播
  markDirty(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    node._dirty = true;
    for (const l of this.links) {
      if (l.from === id) this.markDirty(l.to);
    }
  }

  markAllDirty() { for (const n of this.nodes.values()) n._dirty = true; }

  // 評估節點(遞迴 + 快取)
  evaluate(id, W) {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (!node._dirty && node._cache && node._cache.res === W) return node._cache.buf;
    const def = NodeDefs[node.type];
    const ctx = { W, H: W };
    const ins = def.inputs.map((inp, idx) => {
      const l = this.links.find(l => l.to === id && l.toPort === idx);
      if (!l) return null;
      const buf = this.evaluate(l.from, W);
      return bufConvert(buf, inp.t, ctx);
    });
    let buf;
    try { buf = def.eval(node.params, ins, ctx); }
    catch (err) {
      console.error(`節點 ${node.type}#${node.id} 評估失敗:`, err);
      buf = { t: 'g', d: new Float32Array(W * W) };
    }
    node._cache = { res: W, buf };
    node._dirty = false;
    return buf;
  }

  findByType(type) {
    for (const n of this.nodes.values()) if (n.type === type) return n;
    return null;
  }

  serialize() {
    const o = {
      app: 'TexForge', version: 1,
      nodes: [...this.nodes.values()].map(n => ({ id: n.id, type: n.type, x: Math.round(n.x), y: Math.round(n.y), params: { ...n.params } })),
      links: this.links.map(l => ({ ...l })),
    };
    if (this._macros) o.macros = this._macros; // 模板滑桿隨圖保存(精簡模式所需)
    if (this._presetName) o.presetName = this._presetName; // 記住來自哪個範本(下拉選單所需)
    return o;
  }

  static deserialize(json) {
    const g = new NodeGraph();
    for (const n of json.nodes || []) {
      const type = (typeof NODE_ALIASES !== 'undefined' && NODE_ALIASES[n.type]) || n.type;  // 舊代號自動遷移
      n.type = type;
      if (!NodeDefs[n.type]) continue;
      const def = NodeDefs[n.type];
      const params = {};
      for (const p of def.params) params[p.k] = (n.params && n.params[p.k] !== undefined) ? n.params[p.k] : p.def;
      g.nodes.set(n.id, { id: n.id, type: n.type, x: n.x, y: n.y, params, _dirty: true, _cache: null });
      g.nextId = Math.max(g.nextId, n.id + 1);
    }
    for (const l of json.links || []) {
      if (g.nodes.has(l.from) && g.nodes.has(l.to)) g.links.push({ from: l.from, to: l.to, toPort: l.toPort | 0 });
    }
    // 還原模板滑桿,並剔除指向已不存在節點的目標
    if (Array.isArray(json.macros)) {
      const valid = json.macros
        .map(m => ({ label: m.label, value: m.value, targets: (m.targets || []).filter(t => g.nodes.has(t.id)) }))
        .filter(m => m.targets.length);
      if (valid.length) g._macros = valid;
    }
    if (json.presetName) g._presetName = json.presetName;
    return g;
  }
}
