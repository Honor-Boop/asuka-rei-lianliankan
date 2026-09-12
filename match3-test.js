// 三消规则回归测试（与 match3.html 内联脚本逻辑一致）
const assert = require("assert");

const KINDS_MAX = 6;

function findMatches(g, N) {
  const seen = new Map();
  const collect = (fixed, isRow, len, end) => {
    for (let k = end - len; k < end; k++) {
      const r = isRow ? fixed : k, c = isRow ? k : fixed;
      seen.set(r + "," + c, [r, c]);
    }
  };
  for (let r = 0; r < N; r++) {
    let run = 1;
    for (let c = 1; c <= N; c++) {
      if (c < N && g[r][c] === g[r][c - 1] && g[r][c] >= 0) run++;
      else { if (run >= 3) collect(r, true, run, c); run = 1; }
    }
  }
  for (let c = 0; c < N; c++) {
    let run = 1;
    for (let r = 1; r <= N; r++) {
      if (r < N && g[r][c] === g[r - 1][c] && g[r][c] >= 0) run++;
      else { if (run >= 3) collect(c, false, run, r); run = 1; }
    }
  }
  return [...seen.values()];
}
function swapCells(grid, r1, c1, r2, c2) {
  const t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t;
}
function findAnyMove(grid, N) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc;
      if (r2 >= N || c2 >= N) continue;
      swapCells(grid, r, c, r2, c2);
      const ok = findMatches(grid, N).length > 0;
      swapCells(grid, r, c, r2, c2);
      if (ok) return { r, c, r2, c2 };
    }
  }
  return null;
}
function gravity(grid, N, kinds) {
  for (let c = 0; c < N; c++) {
    let write = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      if (grid[r][c] >= 0) { grid[write][c] = grid[r][c]; if (write !== r) grid[r][c] = -1; write--; }
    }
    for (let r = write; r >= 0; r--) grid[r][c] = Math.floor(Math.random() * kinds);
  }
}
/* 生成无初始消除、有可行棋的盘面（与页面 genBoard 一致） */
function genBoard(N, kinds) {
  for (let tries = 0; tries < 300; tries++) {
    const g = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.floor(Math.random() * kinds)));
    let guard = 0;
    while (findMatches(g, N).length && guard++ < 200) {
      for (const [r, c] of findMatches(g, N)) {
        const old = g[r][c];
        let nv;
        do { nv = Math.floor(Math.random() * kinds); } while (nv === old);
        g[r][c] = nv;
      }
    }
    if (findAnyMove(g, N)) return g;
  }
  throw new Error("genBoard 失败");
}

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}
const bg = (N) => Array.from({ length: N }, () => Array(N).fill(-1));

T("横向三连与四连同时存在 = 7 格", () => {
  const N = 8, g = bg(N);
  g[0] = [1, 2, 2, 2, 3, 3, 3, 3];
  assert.strictEqual(findMatches(g, N).length, 7);
});
T("纵向三连 = 3 格", () => {
  const N = 8, g = bg(N);
  g[0][0] = 2; g[1][0] = 2; g[2][0] = 2;
  assert.strictEqual(findMatches(g, N).length, 3);
});
T("两连不算，三连才算", () => {
  const N = 8, g = bg(N);
  g[0] = [1, 2, 2, 3, 3, 3, 4, 4];
  assert.strictEqual(findMatches(g, N).length, 3);
});
T("L/T 形（横纵交叉）合并去重", () => {
  const N = 8, g = bg(N);
  // 以 (2,2) 为中心：横向 1,1,1,1 在第 2 行，纵向 1 在第 2 列
  g[2] = [1, 1, 1, 1, -1, -1, -1, -1];
  g[0][2] = 1; g[1][2] = 1; g[3][2] = 1; g[4][2] = 1;
  const m = findMatches(g, N);
  assert.strictEqual(m.length, 8, "横4 + 纵5，共享 (2,2) 去重一次 → 4+5-1=8");
});
T("背景 -1 不参与消除", () => {
  const N = 8, g = bg(N);
  assert.strictEqual(findMatches(g, N).length, 0);
});
T("交换成消除 / 换回复原", () => {
  const N = 8, g = bg(N);
  g[0] = [1, 2, 1, 1, 4, 4, 3, 3];
  g[1] = [4, 1, 3, 2, 2, 3, 4, 2];
  assert.strictEqual(findMatches(g, N).length, 0, "交换前无消除");
  swapCells(g, 0, 1, 1, 1);
  assert.strictEqual(findMatches(g, N).length, 4, "换入 1 → 1,1,1,1");
  swapCells(g, 0, 1, 1, 1);
  assert.strictEqual(findMatches(g, N).length, 0, "换回复原");
});
T("随机 200 盘生成：无初始三连、有可行棋、值域合法", () => {
  for (const [N, kinds] of [[8, 5], [8, 6], [9, 6]]) {
    for (let t = 0; t < 200; t++) {
      const g = genBoard(N, kinds);
      assert.strictEqual(findMatches(g, N).length, 0, "存在初始三连");
      assert.ok(findAnyMove(g, N), "无可行棋");
      for (const row of g) for (const v of row) assert.ok(v >= 0 && v < kinds, "值域越界");
    }
  }
});
T("重力下落：无空洞、原有块保持相对顺序", () => {
  const N = 4, kinds = 5;
  const g = [
    [-1, 1, 3, 2],
    [2, -1, -1, 1],
    [3, 2, -1, 3],
    [1, 3, 2, -1],
  ];
  gravity(g, N, kinds);
  for (const row of g) for (const v of row) assert.ok(v >= 0 && v < kinds, "补牌值域");
  // 第 0 列：非空块 2,3,1 依次下沉到底部
  assert.deepStrictEqual(g.map(r => r[0]).slice(1), [2, 3, 1]);
});
T("连锁计分模型：3+3+4 → 30+60+120=210", () => {
  let s = 0, chain = 0;
  for (const n of [3, 3, 4]) { chain++; s += n * 10 * chain; }
  assert.strictEqual(s, 210);
});
T("死局检测与重排可行性：重排后必有可行棋", () => {
  for (let t = 0; t < 50; t++) {
    const N = 8, kinds = 6;
    const g = genBoard(N, kinds);
    // 随机破坏直至无解
    let guard = 0;
    while (findAnyMove(g, N) && guard++ < 300) {
      const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
      g[r][c] = (g[r][c] + 1) % kinds;
    }
    if (findAnyMove(g, N)) continue;         // 没破坏成死局就跳过
    // 模拟重排：打乱所有值直到有解
    const flat = [];
    for (const row of g) flat.push(...row);
    let ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      const sh = flat.slice();
      for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
      const test = [];
      for (let r = 0; r < N; r++) test.push(sh.slice(r * N, r * N + N));
      if (findAnyMove(test, N)) ok = true;
    }
    assert.ok(ok, "重排 60 次内应找到有解盘面");
  }
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
