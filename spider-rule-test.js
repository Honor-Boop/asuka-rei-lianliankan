// spider.html 规则函数镜像（微软标准列模型：盖牌簇在上 col[0]，明牌链在列底/数组尾）
// 与页面逻辑逐字一致，用于回归测试
const assert = require("assert");
let stacks, reserve, setsDone, moves, history, sel;

function segStart(col) {
  let i = col.length - 1;
  while (i > 0 && col[i].up && col[i - 1].up &&
         col[i - 1].suit === col[i].suit && col[i - 1].r === col[i].r + 1) i--;
  return i;
}
function segLen(col) { return col.length - segStart(col); }
function segTopCard(ci) { const col = stacks[ci]; return col[segStart(col)]; }
function canPlace(srcC, dstC) {
  if (srcC === dstC) return false;
  const s = stacks[srcC];
  if (!s.length || !s[s.length - 1].up) return false;
  const d = stacks[dstC];
  if (!d.length) return true;
  const last = d[d.length - 1];
  if (!last.up) return false;
  return last.r === segTopCard(srcC).r + 1;
}
function doMove(srcC, dstC) {
  const col = stacks[srcC];
  const start = segStart(col);
  const seg = col.splice(start);
  const d = stacks[dstC];
  d.push(...seg);
  moves++;
  const sc = stacks[srcC];
  if (sc.length && !sc[sc.length - 1].up) sc[sc.length - 1].up = true;
  collectAll();
}
function collectAll() {
  for (let ci = 0; ci < 10; ci++) {
    const col = stacks[ci];
    for (let j = 0; j + 13 <= col.length; j++) {
      const w = col.slice(j, j + 13);
      if (!w.every(c => c.up && c.suit === w[0].suit)) continue;
      if (w[0].r !== 13) continue;
      let ok = true;
      for (let i = 1; i < 13; i++) {
        if (w[i].r !== w[i - 1].r - 1) { ok = false; break; }
      }
      if (!ok) continue;
      col.splice(j, 13);
      setsDone++;
      break;
    }
  }
}
const U = (r, s = 0) => ({ r, suit: s, up: true });
const D = (r, s = 0) => ({ r, suit: s, up: false });

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}
function eq(actual, expected, msg) {
  assert.deepStrictEqual(actual, expected, msg);
}
function fresh(...cols) {
  stacks = [];
  for (let i = 0; i < 10; i++) stacks.push(cols[i] ? cols[i].map(c => ({ ...c })) : []);
  reserve = []; setsDone = 0; moves = 0; history = [];
}
const R = ci => stacks[ci].map(c => c.r + (c.up ? "u" : "d")).join(".");

/* 1) segLen：可拖段 = 列底（数组尾）起同花降序，盖牌上方可压 */
fresh([U(9, 0), U(8, 0), U(7, 0)]);
T("列底 987（同花降序）段=3", () => eq(segLen(stacks[0]), 3));
fresh([D(3), U(9), U(8), U(7)]);
T("盖牌压顶 + 987 段仍=3（盖不参与）", () => eq(segLen(stacks[0]), 3));
fresh([U(9, 0), U(8, 1), U(7, 1)]);
T("98 异花断开：段=2（8 7）", () => eq(segLen(stacks[0]), 2));
fresh([U(7), U(8), U(9)]);
T("升序向下 789 段=1（不可整拖）", () => eq(segLen(stacks[0]), 1));
fresh([D(3), D(2), U(13), U(12), U(11), U(10)]);
T("KQJ10 段=4（盖簇在上）", () => eq(segLen(stacks[0]), 4));

/* 2) canPlace：目标列尾翻开牌 = 段顶 + 1；空列任意；盖尾不可放 */
fresh([U(9), U(8), U(7)], [D(2), U(10)]);
T("987 → [盖,10] 允许（10 = 段顶 9 + 1）", () => assert.ok(canPlace(0, 1)));
fresh([U(9), U(8), U(7)], [U(8)]);
T("987 → 8 列拒绝（8 ≠ 9+1）", () => assert.ok(!canPlace(0, 1)));
fresh([U(8)], [D(3), U(9)]);
T("8 → [盖,9] 允许（落点是列尾 9）", () => assert.ok(canPlace(0, 1)));
fresh([U(8)], [U(10)]);
T("8 → 10 拒绝", () => assert.ok(!canPlace(0, 1)));
fresh([U(8)], []);
T("8 → 空列 允许", () => assert.ok(canPlace(0, 1)));
fresh([U(9), U(8)], [D(2), D(5)]);
T("任何 → [盖,盖]（无明牌尾）拒绝", () => assert.ok(!canPlace(0, 1)));

/* 3) doMove：整段 push 到目标列尾（列底），源列剩盖时自动翻开新尾 */
fresh([U(9), U(8), U(7)], [D(3), U(10)]);
doMove(0, 1);
eq(R(1), "3d.10u.9u.8u.7u", "落点 [盖3,10,9,8,7]（盖簇仍在上）");
fresh([D(2), U(9)], [D(3), U(10)]);
doMove(0, 1);
eq(R(1), "3d.10u.9u", "9 → 10 下：盖簇保持、明链延长");
eq(R(0), "2u", "源列剩 1 张盖 → 自动翻开成明牌");
fresh([D(3), U(9), U(8)], []);
doMove(0, 1);
eq(R(1), "9u.8u", "空列收整段：顺序保持 9 上 8 下");

/* 4) 发牌（dealRow 同款 push）：新牌出现在列底，且恒为明牌 */
fresh([D(2), U(9)]);
reserve = [U(13)];
const r0 = stacks[0].slice();
stacks[0].push({ ...reserve.shift(), up: true });
eq(R(0), "2d.9u.13u", "发牌 push 到列尾");
eq(reserve.length, 0, "reserve 耗尽");

/* 5) 收套：仅同花 K(数组头/视觉上)→A(数组尾/视觉下) 13 张 */
fresh([U(13), U(12), U(11), U(10), U(9), U(8), U(7), U(6), U(5), U(4), U(3), U(2), U(1)]);
collectAll();
eq(setsDone, 1, "K→A 收 +1");
eq(stacks[0].length, 0, "列清空");
fresh([U(1), U(2), U(3), U(4), U(5), U(6), U(7), U(8), U(9), U(10), U(11), U(12), U(13)]);
collectAll();
eq(setsDone, 0, "A→K 升序不收");
fresh([U(12), U(11), U(10), U(9), U(8), U(7), U(6), U(5), U(4), U(3), U(2), U(1)]);
collectAll();
eq(setsDone, 0, "Q→A 12 张不收");

/* 6) 收套发生在盖簇下方明链窗口：移走后上方盖牌不受影响 */
fresh([D(2), U(13), U(12), U(11), U(10), U(9), U(8), U(7), U(6), U(5), U(4), U(3), U(2), U(1)]);
collectAll();
eq(setsDone, 1, "盖簇+完整 K→A 也能收");
eq(R(0), "2d", "只剩盖簇");

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
