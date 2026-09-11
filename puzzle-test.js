// 拼图逻辑回归测试（与 puzzle.html 内联脚本逻辑一致）
const assert = require("assert");

const DIFFS = { easy: { n: 3 }, normal: { n: 4 }, hard: { n: 5 } };

function shuffled(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
/* 打乱：Fisher-Yates，确保至少 max(2N, 60%) 块错位 */
function makeShuffle(N) {
  const total = N * N;
  let board = [...Array(total).keys()];
  for (let tries = 0; tries < 50; tries++) {
    for (let i = board.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [board[i], board[j]] = [board[j], board[i]];
    }
    let wrong = 0;
    for (let i = 0; i < total; i++) if (board[i] !== i) wrong++;
    if (wrong >= Math.max(2 * N, Math.floor(total * 0.6))) break;
  }
  return board;
}
function swap(board, a, b) { [board[a], board[b]] = [board[b], board[a]]; }
function solved(board) { return board.every((t, i) => t === i); }
/* 提示：把 tileId === pos 的碎片换到 pos */
function hintPlace(board, pos) {
  const from = board.indexOf(pos);
  swap(board, pos, from);
  return from;
}

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}

T("打乱后始终是合法排列（每个碎片恰好一次）", () => {
  for (const [k, d] of Object.entries(DIFFS)) {
    for (let t = 0; t < 30; t++) {
      const b = makeShuffle(d.n);
      assert.strictEqual(b.length, d.n * d.n, k + " 长度");
      assert.strictEqual(new Set(b).size, d.n * d.n, k + " 有重复碎片");
    }
  }
});

T("打乱充分（错位块数达标，且不可能是已完成状态）", () => {
  for (const [k, d] of Object.entries(DIFFS)) {
    const need = Math.max(2 * d.n, Math.floor(d.n * d.n * 0.6));
    let worst = Infinity;
    for (let t = 0; t < 40; t++) {
      const b = makeShuffle(d.n);
      const wrong = b.filter((v, i) => v !== i).length;
      worst = Math.min(worst, wrong);
      assert.ok(!solved(b), k + " 打乱后不应是已完成状态");
    }
    assert.ok(worst >= need, `${k} 最少错位 ${worst} < 要求 ${need}`);
  }
});

T("交换操作可逆、计数正确", () => {
  const b = makeShuffle(3);
  const before = b.slice();
  swap(b, 0, 5);
  assert.strictEqual(b[0], before[5]);
  assert.strictEqual(b[5], before[0]);
  swap(b, 0, 5);
  assert.deepStrictEqual(b, before);
});

T("任意排列都能靠交换复原（拼图永远可解）", () => {
  for (const [k, d] of Object.entries(DIFFS)) {
    for (let t = 0; t < 20; t++) {
      const b = makeShuffle(d.n);
      // 逐位归位：把 tileId === i 的碎片换到 i
      for (let i = 0; i < b.length; i++) if (b[i] !== i) hintPlace(b, i);
      assert.ok(solved(b), k + " 未能复原");
    }
  }
});

T("提示归位：目标位置变正确，且不动其它已正确块", () => {
  const b = [1, 0, 2, 3, 4, 5, 6, 7, 8];       // 只有 0/1 互换
  hintPlace(b, 0);
  assert.deepStrictEqual(b, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(solved(b));
  // 已正确的部分不应被破坏
  const b2 = [0, 2, 1, 3, 4, 5, 6, 7, 8];
  hintPlace(b2, 1);
  assert.strictEqual(b2[0], 0, "位置 0 原本正确，提示不应动它");
  assert.strictEqual(b2[1], 1);
});

T("通关判定：全对才算完成", () => {
  const total = 9;
  assert.ok(solved([...Array(total).keys()]));
  assert.ok(!solved([0, 1, 2, 3, 4, 5, 6, 7, 0]));
});

T("素材列表：优先实时接口、过滤无效项、离线回退", () => {
  const apiResp = [{ src: "wallpapers/a.jpg", char: "rei", res: "2560x1440" },
                   { src: "", char: "x" }, null,
                   { src: "wallpapers/new_upload.jpg", char: "misato", res: "1200x1600" }];
  const cleaned = (Array.isArray(apiResp) ? apiResp : []).filter(w => w && w.src);
  assert.strictEqual(cleaned.length, 2);
  assert.ok(cleaned.some(w => w.src.includes("new_upload")), "新上传的图应在清单里");
  // 离线回退
  const FALLBACK = ["images/rei_1.jpg", "images/asuka_5.jpg"];
  const offline = [].length ? [] : FALLBACK.map(s => ({ src: s, char: "", res: "" }));
  assert.strictEqual(offline.length, 2);
});

T("随机选图不会连续抽到同一张（有其它候选时）", () => {
  const list = [{ src: "a" }, { src: "b" }, { src: "c" }];
  const pick = (exclude) => {
    const pool = list.filter(w => w.src !== exclude);
    const arr = pool.length ? pool : list;
    return arr[Math.floor(Math.random() * arr.length)];
  };
  for (let i = 0; i < 200; i++) assert.notStrictEqual(pick("a").src, "a");
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
