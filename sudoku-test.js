// 数独生成器/规则回归测试（与 sudoku.html 内联脚本逻辑一致）
const assert = require("assert");
function shuffled(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const rowOf = i => (i / 9) | 0, colOf = i => i % 9;
const boxOf = i => (((i / 9) | 0) / 3 | 0) * 3 + ((i % 9) / 3 | 0);
function generateFull() {
  const g = new Int8Array(81);
  const rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
  (function bt(i) {
    if (i === 81) return true;
    const r = rowOf(i), c = colOf(i), b = boxOf(i);
    const used = rows[r] | cols[c] | boxes[b];
    for (const v of shuffled([1,2,3,4,5,6,7,8,9])) {
      const m = 1 << v;
      if (used & m) continue;
      g[i] = v; rows[r] |= m; cols[c] |= m; boxes[b] |= m;
      if (bt(i + 1)) return true;
      g[i] = 0; rows[r] &= ~m; cols[c] &= ~m; boxes[b] &= ~m;
    }
    return false;
  })(0);
  return g;
}
function countSolutions(grid, limit) {
  const g = Int8Array.from(grid);
  const rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
  for (let i = 0; i < 81; i++) { const v = g[i]; if (!v) continue; const m = 1 << v;
    rows[rowOf(i)] |= m; cols[colOf(i)] |= m; boxes[boxOf(i)] |= m; }
  let count = 0;
  (function bt() {
    let best = -1, bestUsed = 0, bestCnt = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const used = rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)];
      let cnt = 0;
      for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) cnt++;
      if (cnt < bestCnt) { bestCnt = cnt; best = i; bestUsed = used; if (cnt === 0) break; }
    }
    if (best === -1) { count++; return count >= limit; }
    if (bestCnt === 0) return false;
    const r = rowOf(best), c = colOf(best), b = boxOf(best);
    for (let v = 1; v <= 9; v++) {
      const m = 1 << v;
      if (bestUsed & m) continue;
      g[best] = v; rows[r] |= m; cols[c] |= m; boxes[b] |= m;
      const done = bt();
      g[best] = 0; rows[r] &= ~m; cols[c] &= ~m; boxes[b] &= ~m;
      if (done) return true;
    }
    return false;
  })();
  return count;
}
function makePuzzle(givens) {
  const sol = generateFull();
  const puz = Int8Array.from(sol);
  let left = 81;
  for (const i of shuffled([...Array(81).keys()])) {
    if (left <= givens) break;
    const bak = puz[i];
    puz[i] = 0;
    if (countSolutions(puz, 2) === 1) left--;
    else puz[i] = bak;
  }
  return { puzzle: puz, solution: sol };
}
const DIFFS = { trainee: { givens: 44 }, agent: { givens: 34 }, angel: { givens: 27 } };

let pass = 0, fail = 0;
function T(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("✗ " + n + " :: " + e.message); } }

T("完整盘面合法（每行每列每宫 1-9 各一次）", () => {
  for (let t = 0; t < 20; t++) {
    const g = generateFull();
    for (let r = 0; r < 9; r++) assert.deepStrictEqual(new Set([...Array(9).keys()].map(c => g[r * 9 + c])).size, 9, "row " + r);
    for (let c = 0; c < 9; c++) assert.deepStrictEqual(new Set([...Array(9).keys()].map(r => g[r * 9 + c])).size, 9, "col " + c);
    const u = new Set([...Array(81).keys()].map(i => boxOf(i) * 10 + g[i]));
    assert.strictEqual(u.size, 81, "box");
  }
});
for (const [k, d] of Object.entries(DIFFS)) {
  T(k + " 挖洞后提示格数达标且唯一解", () => {
    const t0 = Date.now();
    const { puzzle, solution } = makePuzzle(d.givens);
    const ms = Date.now() - t0;
    let g = 0;
    for (let i = 0; i < 81; i++) if (puzzle[i]) g++;
    assert.ok(g >= d.givens, "givens " + g + " < " + d.givens);
    assert.strictEqual(countSolutions(puzzle, 2), 1, "解不唯一");
    for (let i = 0; i < 81; i++) if (puzzle[i]) assert.strictEqual(puzzle[i], solution[i], "题面与解矛盾 @" + i);
    assert.ok(ms < 8000, "生成过慢 " + ms + "ms");
    console.log(`  ${k}: givens=${g}/${d.givens} 唯一解 ✓ ${ms}ms`);
  });
}
T("已知唯一解盘面的解校验", () => {
  const known = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  const grid = Int8Array.from(known.split("").map(Number));
  assert.strictEqual(countSolutions(grid, 2), 1, "经典盘面应唯一解");
});
console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
