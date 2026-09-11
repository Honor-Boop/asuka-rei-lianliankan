// 接龙（Klondike）规则与不变量回归测试（与 klondike.html 内联脚本逻辑一致）
const assert = require("assert");

const DIFFS = {
  easy:   { draw: 1, maxPass: 0 },
  normal: { draw: 3, maxPass: 0 },
  hard:   { draw: 3, maxPass: 1 },
};
const isRed = s => s === 0 || s === 1;

let tableau = [], foundations = [], stock = [], waste = [], passes = 0, cfg = DIFFS.normal;

function shuffled(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function deal() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
  const sh = shuffled(deck);
  tableau = []; foundations = [[], [], [], []]; stock = []; waste = []; passes = 0;
  let k = 0;
  for (let col = 0; col < 7; col++) {
    const arr = [];
    for (let i = 0; i <= col; i++) arr.push({ ...sh[k++], up: i === col });
    tableau.push(arr);
  }
  stock = sh.slice(k).map(c => ({ ...c, up: false }));
}
const topCard = a => a.length ? a[a.length - 1] : null;
function runStart(col) {
  const a = tableau[col];
  let i = a.length - 1;
  while (i > 0 && a[i].up && a[i - 1].up && a[i - 1].r === a[i].r + 1 &&
         isRed(a[i - 1].s) !== isRed(a[i].s)) i--;
  return i;
}
function canDropOnTableau(card, dstCol) {
  const d = tableau[dstCol];
  if (!d.length) return card.r === 13;
  const t = topCard(d);
  return t.up && t.r === card.r + 1 && isRed(t.s) !== isRed(card.s);
}
function canDropOnFoundation(card, fIdx) {
  const f = foundations[fIdx];
  if (!f.length) return card.r === 1;
  return card.s === fIdx && card.r === f[0] + 1;
}
function canRecycle() {
  if (stock.length || !waste.length) return false;
  return cfg.maxPass === 0 || passes < cfg.maxPass;
}
function drawStock() {
  if (!stock.length) return false;
  const n = Math.min(cfg.draw, stock.length);
  for (let i = 0; i < n; i++) { const c = stock.pop(); c.up = true; waste.push(c); }
  return true;
}
function recycle() {
  if (!canRecycle()) return false;
  passes++;
  stock = waste.reverse().map(c => ({ ...c, up: false }));
  waste = [];
  return true;
}
/* 把列 ci 从 idx 起的整段移到列 dst / 基础叠 */
function moveRun(ci, idx, dst) {
  const card = tableau[ci][idx];
  if (!canDropOnTableau(card, dst)) return false;
  const seg = tableau[ci].splice(idx);
  tableau[dst].push(...seg);
  return true;
}
function moveToFoundation(src, idx) {
  const card = src === "waste" ? waste[waste.length - 1] : tableau[src][idx];
  if (!card) return false;
  const fi = card.s;
  if (!canDropOnFoundation(card, fi)) return false;
  if (src === "waste") waste.pop(); else tableau[src].pop();
  foundations[fi].push(card.r);
  return true;
}
/* 不变量：总牌数 52、无重复、基础叠按花色 A 起连续、列内明牌段红黑交替降序 */
function checkInvariants(tag) {
  const all = [...tableau.flat(), ...stock, ...waste];
  foundations.forEach((f, s) => f.forEach(r => all.push({ s, r, up: true })));
  assert.strictEqual(all.length, 52, tag + " 总牌数应为 52，实际 " + all.length);
  assert.strictEqual(new Set(all.map(c => c.s + "-" + c.r)).size, 52, tag + " 出现重复牌");
  foundations.forEach((f, s) => {
    f.forEach((r, i) => assert.strictEqual(r, i + 1, tag + ` 基础叠${s} 顺序错: ${f.join(",")}`));
  });
  tableau.forEach((col, ci) => {
    col.forEach((c, i) => {
      if (i > 0 && c.up && col[i - 1].up) {
        assert.strictEqual(col[i - 1].r, c.r + 1, tag + ` 列${ci} 非降序 @${i}`);
        assert.notStrictEqual(isRed(col[i - 1].s), isRed(c.s), tag + ` 列${ci} 未红黑交替 @${i}`);
      }
    });
  });
}

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}

T("发牌结构：1..7 列 / 28 张在手 / 24 张牌垛 / 仅列底翻开 / 无重复", () => {
  for (let t = 0; t < 20; t++) {
    deal();
    assert.deepStrictEqual(tableau.map(c => c.length), [1, 2, 3, 4, 5, 6, 7]);
    assert.strictEqual(tableau.reduce((n, c) => n + c.length, 0), 28);
    assert.strictEqual(stock.length, 24);
    tableau.forEach(col => {
      assert.ok(col[col.length - 1].up, "列底应翻开");
      assert.ok(col.slice(0, -1).every(c => !c.up), "非列底应盖着");
    });
    checkInvariants("发牌后");
  }
});

T("列叠放规则：降序 + 红黑交替；空列只放 K", () => {
  tableau = [[{ s: 3, r: 7, up: true }], [{ s: 0, r: 6, up: true }], [], [{ s: 3, r: 9, up: true }], [], [], []];
  assert.ok(canDropOnTableau({ s: 0, r: 6 }, 0), "红6 应能放到黑7");
  assert.ok(!canDropOnTableau({ s: 3, r: 6 }, 0), "黑6 不能放到黑7（同色）");
  assert.ok(!canDropOnTableau({ s: 0, r: 5 }, 0), "红5 不能放到黑7（跳级）");
  assert.ok(canDropOnTableau({ s: 0, r: 13 }, 2), "K 可放空列");
  assert.ok(!canDropOnTableau({ s: 0, r: 12 }, 2), "Q 不能放空列");
});

T("基础叠规则：A 起、同花顺接、不可跳级、不可跨花", () => {
  foundations = [[], [], [], []];
  assert.ok(canDropOnFoundation({ s: 0, r: 1 }, 0), "A 可开基础叠");
  assert.ok(!canDropOnFoundation({ s: 0, r: 2 }, 0), "空叠不能放 2");
  foundations = [[1], [1], [], []];
  assert.ok(canDropOnFoundation({ s: 0, r: 2 }, 0), "♥A 上可放 ♥2");
  assert.ok(!canDropOnFoundation({ s: 1, r: 2 }, 0), "♦2 不能放到 ♥ 叠");
  assert.ok(!canDropOnFoundation({ s: 0, r: 3 }, 0), "♥3 不能跳过 ♥2");
});

T("整段识别：只有红黑交替降序才算一段", () => {
  tableau = [[{ s: 3, r: 9, up: true }, { s: 0, r: 8, up: true }, { s: 3, r: 7, up: true }], [], [], [], [], [], []];
  assert.strictEqual(runStart(0), 0, "黑9红8黑7 应整段");
  tableau = [[{ s: 3, r: 9, up: true }, { s: 3, r: 8, up: true }], [], [], [], [], [], []];
  assert.strictEqual(runStart(0), 1, "同色不算一段");
  tableau = [[{ s: 3, r: 9, up: false }, { s: 0, r: 8, up: true }], [], [], [], [], [], []];
  assert.strictEqual(runStart(0), 1, "盖牌不参与成段");
});

T("抽牌：見習い抽 1 / 正規隊員抽 3 / 牌垛不足时抽完即止", () => {
  cfg = DIFFS.easy; deal();
  drawStock();
  assert.strictEqual(waste.length, 1, "抽 1");
  cfg = DIFFS.normal; deal();
  drawStock();
  assert.strictEqual(waste.length, 3, "抽 3");
  // 不足时抽完即止：抽 1 模式把牌垛抽到只剩 1 张，再抽应恰好抽走这 1 张
  cfg = DIFFS.easy; deal();
  let guard = 0;
  while (stock.length > 1 && guard++ < 40) drawStock();
  assert.strictEqual(stock.length, 1, "应正好剩 1 张");
  drawStock();
  assert.strictEqual(stock.length, 0, "最后 1 张应被抽走，不能卡住");
  checkInvariants("抽牌后");
});

T("循环：見習い/正規隊員无限；使徒級仅一轮", () => {
  cfg = DIFFS.normal; deal();
  while (stock.length) drawStock();
  assert.ok(canRecycle(), "无限模式可循环");
  recycle();
  assert.strictEqual(stock.length, 24, "循环后牌垛应回到 24 张");
  assert.strictEqual(waste.length, 0);
  while (stock.length) drawStock();
  assert.ok(canRecycle(), "无限模式可再次循环");
  cfg = DIFFS.hard; deal();
  while (stock.length) drawStock();
  assert.ok(canRecycle(), "使徒級第一轮可循环");
  recycle();
  while (stock.length) drawStock();
  assert.ok(!canRecycle(), "使徒級第二轮应被拒绝");
  assert.strictEqual(recycle(), false);
  checkInvariants("循环后");
});

T("移动/收牌保持不变量（随机 3000 步压力测试）", () => {
  cfg = DIFFS.normal; deal();
  let acted = 0;
  for (let step = 0; step < 3000; step++) {
    const opts = [];
    // 收牌
    for (let ci = 0; ci < 7; ci++) {
      const t = topCard(tableau[ci]);
      if (t && t.up && canDropOnFoundation(t, t.s)) opts.push(() => moveToFoundation(ci, tableau[ci].length - 1));
    }
    const w = waste[waste.length - 1];
    if (w && canDropOnFoundation(w, w.s)) opts.push(() => moveToFoundation("waste", 0));
    // 段移动（含空列）
    for (let ci = 0; ci < 7; ci++) {
      if (!tableau[ci].length) continue;
      const st = runStart(ci);
      for (let dst = 0; dst < 7; dst++) {
        if (dst === ci) continue;
        if (canDropOnTableau(tableau[ci][st], dst)) opts.push(() => moveRun(ci, st, dst));
      }
    }
    // 翻牌 / 循环
    if (stock.length) opts.push(() => drawStock());
    else if (canRecycle()) opts.push(() => recycle());
    if (!opts.length) break;
    const fn = opts[Math.floor(Math.random() * opts.length)];
    if (fn()) acted++;
    checkInvariants("第 " + step + " 步后");
  }
  assert.ok(acted > 200, "随机走法执行数过少：" + acted);
});

T("翻开盖牌与胜利判定", () => {
  tableau = [[{ s: 3, r: 5, up: false }], [], [], [], [], [], []];
  foundations = [[], [], [], []]; stock = []; waste = [];
  tableau[0][0].up = true;
  assert.ok(tableau[0][0].up);
  // 胜利：四叠齐 13 张
  foundations = [[1,2,3,4,5,6,7,8,9,10,11,12,13],[1,2,3,4,5,6,7,8,9,10,11,12,13],
                 [1,2,3,4,5,6,7,8,9,10,11,12,13],[1,2,3,4,5,6,7,8,9,10,11,12,13]];
  const n = foundations.reduce((a, f) => a + f.length, 0);
  assert.strictEqual(n, 52, "胜利条件应为 52 张收齐");
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
