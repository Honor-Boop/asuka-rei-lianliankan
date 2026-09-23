// AT 力场弹球规则回归测试（与 breakout.html 内联脚本逻辑一致）
// 与页面逻辑逐字一致，仅把隐式全局改为显式参数，用于回归测试
const assert = require("assert");

const W = 760, H = 920;
const COLS = 10, BW = 68, BH = 28, BGAP = 4, BTOP = 76;
const DIFFS = {
  easy:   { key: "easy",   name: "見習い",   levels: 5, ballSpeed: 430, paddleW: 170, lives: 3, rows: 5, armor: .10, core: .00 },
  normal: { key: "normal", name: "正規隊員", levels: 6, ballSpeed: 520, paddleW: 138, lives: 3, rows: 6, armor: .22, core: .05 },
  hard:   { key: "hard",   name: "使徒級",   levels: 6, ballSpeed: 605, paddleW: 112, lives: 2, rows: 6, armor: .34, core: .10 },
};
const PADDLE_H = 16, PADDLE_Y = H - 78, BALL_R = 9, MIN_VX = .14;
const KINDS = {
  a: { hp: 1, score: 10,  color: "#7b5cff", name: "装甲" },
  b: { hp: 2, score: 25,  color: "#ff8055", name: "重装装甲" },
  c: { hp: 3, score: 60,  color: "#ffe066", name: "核心装甲" },
};
const SYNC = { start: 45, decay: .3, lose: 12, max: 100, berserk: 6, after: 40 };
const SYNC_GAIN = { a: 2.4, b: 4.0, c: 7.0 };            // 按装甲类型给同步率
const POWER = { w: 14, p: 7, m: 3 };

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  if (dx * dx + dy * dy > r * r) return { hit: false };
  const left = cx + r - rx, right = rx + rw - (cx - r), top = cy + r - ry, bottom = ry + rh - (cy - r);
  let axis = "y", pen = Math.min(left, right, top, bottom);
  if (pen === left) axis = "left";
  else if (pen === right) axis = "right";
  else if (pen === top) axis = "top";
  else axis = "bottom";
  return { hit: true, axis, pen };
}
function paddleBounce(bx, px, pw, speed, maxAngle) {
  const half = pw / 2;
  const off = clamp((bx - (px + half)) / half, -1, 1);
  const ang = off * (maxAngle === undefined ? 1.05 : maxAngle);
  let vx = Math.sin(ang) * speed, vy = -Math.cos(ang) * speed;
  const minX = speed * MIN_VX;                             // 保底横向分量：避免正中接球后的垂直死循环
  if (Math.abs(vx) < minX) vx = (off < 0 ? -1 : 1) * minX;
  return { vx, vy };
}
function ballSpeedFor(diff, level) { return DIFFS[diff].ballSpeed * Math.pow(1.08, level - 1); }
function paddleWidthFor(diff, wide) { return DIFFS[diff].paddleW * (wide ? 1.5 : 1); }
function brickLayout(diff, level, rng) {
  const R = rng || Math.random, d = DIFFS[diff], out = [];
  const rows = d.rows;
  const armor = clamp(d.armor + (level - 1) * .05, 0, .6);
  const core = clamp(d.core + (level - 1) * .03, 0, .3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const roll = R();
      let kind = "a";
      if (roll < core) kind = "c";
      else if (roll < core + armor) kind = "b";
      out.push({ col: c, row: r, kind, hp: KINDS[kind].hp });
    }
  }
  return out.filter(b => !(b.row === 0 && (b.col === 0 || b.col === COLS - 1)));
}
function brickTotal(list) { return list.length; }
function remainingBricks(list) { return list.filter(b => b.hp > 0).length; }
function brickScore(kind, berserk, combo) {
  const mult = 1 + Math.min(combo, 20) * .05;
  return Math.round(KINDS[kind].score * mult * (berserk ? 2 : 1));
}
function syncGainBrick(cur, kind, berserk) { return berserk ? cur : clamp(cur + (SYNC_GAIN[kind] || SYNC_GAIN.a), 0, SYNC.max); }
function syncGainLevel(cur) { return clamp(cur + 6, 0, SYNC.max); }
function syncLoss(cur) { return clamp(cur - SYNC.lose, 0, SYNC.max); }
function syncDecay(cur, dt, berserk) { return berserk ? cur : clamp(cur - SYNC.decay * dt, 0, SYNC.max); }
function enterBerserk(cur) { return cur >= SYNC.max; }
function afterBerserk() { return SYNC.after; }
function powerupRoll(rng) {
  const R = rng || Math.random;
  const roll = R();
  if (roll >= .12) return null;
  const pick = R();
  return pick < .3 ? "w" : pick < .58 ? "p" : pick < .82 ? "m" : "s";
}
function nextLevelState(diff, level) {
  const lv = level + 1;
  return { level: lv, speed: ballSpeedFor(diff, lv), rows: DIFFS[diff].rows,
           armor: clamp(DIFFS[diff].armor + (lv - 1) * .05, 0, .6) };
}
function substeps(dist) { return Math.max(1, Math.ceil(dist / 6)); }

function nudgeVelocity(vx, vy, rand) {
  const sp = Math.hypot(vx, vy) || 1;
  const a = Math.atan2(vy, vx) + (rand - .5) * .3;
  return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
}

/* 种子化 RNG（测试专用，保证可复现） */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}

T("clamp 边界与区间内取值", () => {
  assert.strictEqual(clamp(-9, 0, 100), 0);
  assert.strictEqual(clamp(200, 0, 100), 100);
  assert.strictEqual(clamp(37, 0, 100), 37);
});
T("圆-矩形碰撞：正上方命中，法线轴为 top", () => {
  const h = circleRectHit(100, 21, 10, 60, 30, 80, 20);   // 圆心距矩形上沿 9px，r=10 → 相交
  assert.ok(h.hit, "应命中");
  assert.strictEqual(h.axis, "top");
  assert.ok(Math.abs(h.pen - 1) < 1e-9, "穿透深度应为 1，实际 " + h.pen);
});
T("圆-矩形碰撞：侧面与角落", () => {
  const side = circleRectHit(55, 40, 9, 60, 30, 80, 20); // 左侧外 5px
  assert.ok(side.hit && side.axis === "left", "左侧命中轴为 left，实际 " + side.axis);
  const corner = circleRectHit(52, 22, 12, 60, 30, 80, 20); // 左上角
  assert.ok(corner.hit, "角落应命中");
  assert.ok(corner.axis === "left" || corner.axis === "top", "角落轴为 left/top，实际 " + corner.axis);
});
T("圆-矩形碰撞：擦过不中 / 完全在内部（视为命中）", () => {
  const miss = circleRectHit(40, 15, 5, 60, 30, 80, 20);  // 距角 √(20²+15²)=25 > 5
  assert.ok(!miss.hit, "远离不应命中");
  const inside = circleRectHit(100, 40, 9, 60, 30, 80, 20);
  assert.ok(inside.hit, "内部应命中");
});
T("挡板反弹：命中中心 → 近乎垂直，但保留保底横向分量（防垂直死循环）", () => {
  const r = paddleBounce(200, 100, 200, 500);            // 挡板 100..300，中心 200
  const minX = 500 * MIN_VX;
  assert.ok(Math.abs(r.vx) >= minX - 1e-9, "横向分量不低于保底值 " + minX + "，实际 " + r.vx);
  assert.ok(Math.abs(r.vx) <= minX + 1e-9, "正中命中时正好等于保底值");
  assert.ok(r.vy < 0, "应向上");
  const mag = Math.hypot(r.vx, r.vy);                     // 页面在应用旋转后会归一化回原速度
  const nvx = r.vx / mag * 500, nvy = r.vy / mag * 500;
  assert.ok(Math.abs(Math.hypot(nvx, nvy) - 500) < 1e-9, "归一化后速度守恒");
  assert.ok(Math.abs(nvx) >= minX * .98, "归一化后横向分量仍达保底");
});
T("保底横速：连续正中命中也不会退化成垂直死循环", () => {
  const speed = 520, minX = speed * MIN_VX;
  let vx = 0, vy = -speed, x = 380, y = 500;
  for (let i = 0; i < 20; i++) {                          // 模拟 20 次“正中接球”
    const r = paddleBounce(x, 380 - 69, 138, speed);
    vx = r.vx; vy = r.vy;
    assert.ok(Math.abs(vx) >= minX - 1e-9, "第 " + i + " 次仍有横向分量");
  }
  assert.ok(MIN_VX >= .1, "保底比例不应过小（" + MIN_VX + "）");
  assert.ok(MIN_VX <= .25, "保底比例也不应过大而破坏手感（" + MIN_VX + "）");
});
T("挡板反弹：靠左 → 向左上；靠右 → 向右上；速度守恒", () => {
  const l = paddleBounce(110, 100, 200, 500);
  assert.ok(l.vx < 0 && l.vy < 0, "左下弹出");
  const r = paddleBounce(290, 100, 200, 500);
  assert.ok(r.vx > 0 && r.vy < 0, "右下弹出");
  for (const b of [l, r]) {
    const sp = Math.hypot(b.vx, b.vy);
    assert.ok(Math.abs(sp - 500) < 1e-9, "速度应为 500，实际 " + sp);
  }
});
T("挡板反弹：越靠边角度越斜，且偏移量被夹在 ±1", () => {
  const mid = paddleBounce(200, 100, 200, 500);
  const edge = paddleBounce(300, 100, 200, 500);
  const beyond = paddleBounce(999, 100, 200, 500);
  assert.ok(Math.abs(edge.vx) > Math.abs(mid.vx), "边缘横向分量更大");
  assert.ok(Math.abs(beyond.vx - edge.vx) < 1e-9, "超出边界按边缘处理（夹紧）");
  assert.ok(Math.abs(beyond.vy - edge.vy) < 1e-9);
});
T("挡板反弹：自定义最大角生效", () => {
  const a = paddleBounce(300, 100, 200, 100, 0);          // 最大角 0 → 无角度，仅保底横速
  assert.ok(Math.abs(a.vx) <= 100 * MIN_VX + 1e-9, "最大角 0 时横向分量仅为保底值");
  const b = paddleBounce(100, 100, 200, 100, Math.PI / 4);
  assert.ok(Math.abs(Math.abs(b.vx) - Math.abs(b.vy)) < 1e-9, "45° 时 vx/vy 相等");
});
T("球速：基础值随难度不同，且随关卡单调递增", () => {
  assert.strictEqual(ballSpeedFor("normal", 1), DIFFS.normal.ballSpeed, "第 1 关为基础值");
  assert.ok(ballSpeedFor("normal", 3) > ballSpeedFor("normal", 2), "逐关加速");
  assert.ok(ballSpeedFor("hard", 1) > ballSpeedFor("normal", 1) && ballSpeedFor("normal", 1) > ballSpeedFor("easy", 1), "难度阶梯");
  assert.ok(Math.abs(ballSpeedFor("normal", 2) - 520 * 1.08) < 1e-9, "每关 ×1.08");
});
T("挡板宽度：加宽道具生效时 ×1.5，难度越宽越窄", () => {
  assert.strictEqual(paddleWidthFor("normal", false), DIFFS.normal.paddleW);
  assert.strictEqual(paddleWidthFor("normal", true), DIFFS.normal.paddleW * 1.5);
  assert.ok(paddleWidthFor("easy", false) > paddleWidthFor("hard", false), "見習い挡板更宽");
});
T("装甲阵型：总数 = 行×列 − 顶层两个缺口", () => {
  const rng = mulberry32(3);
  for (const d of ["easy", "normal", "hard"]) {
    const list = brickLayout(d, 1, rng);
    assert.strictEqual(list.length, DIFFS[d].rows * COLS - 2, d + " 数量不符");
    assert.strictEqual(brickTotal(list), list.length);
  }
});
T("装甲阵型：种类合法、血量与配置一致、行列在界内", () => {
  const rng = mulberry32(11);
  for (const d of ["easy", "normal", "hard"]) {
    for (let lv = 1; lv <= 6; lv++) {
      for (const b of brickLayout(d, lv, rng)) {
        assert.ok(KINDS[b.kind], "种类合法");
        assert.strictEqual(b.hp, KINDS[b.kind].hp, "血量与种类一致");
        assert.ok(b.col >= 0 && b.col < COLS, "列在界内");
        assert.ok(b.row >= 0 && b.row < DIFFS[d].rows, "行在界内");
      }
    }
  }
});
T("装甲阵型：无重复格", () => {
  const rng = mulberry32(5);
  const list = brickLayout("normal", 1, rng);
  const seen = new Set(list.map(b => b.col + "," + b.row));
  assert.strictEqual(seen.size, list.length, "不应有重复格");
});
T("装甲阵型：重装/核心比例随难度与关卡上升", () => {
  const count = (list) => list.filter(b => b.kind !== "a").length / list.length;
  const rng = mulberry32(7);
  const easy = count(brickLayout("easy", 1, rng));
  const hard = count(brickLayout("hard", 1, rng));
  assert.ok(hard > easy, "使徒級重装更多（" + hard.toFixed(2) + " > " + easy.toFixed(2) + "）");
  const lv1 = count(brickLayout("normal", 1, mulberry32(9)));
  const lv6 = count(brickLayout("normal", 6, mulberry32(9)));
  assert.ok(lv6 > lv1, "越深关卡重装越多（" + lv6.toFixed(2) + " > " + lv1.toFixed(2) + "）");
});
T("装甲阵型：注入同种子 → 结果可复现", () => {
  const a = brickLayout("normal", 2, mulberry32(123));
  const b = brickLayout("normal", 2, mulberry32(123));
  assert.deepStrictEqual(a, b, "同种子应完全一致");
  const c = brickLayout("normal", 2, mulberry32(124));
  assert.notDeepStrictEqual(a, c, "不同种子应不同");
});
T("装甲阵型：500 次随机采样全部合法且至少有一块可破坏", () => {
  const R = mulberry32(2026);
  for (let i = 0; i < 500; i++) {
    const list = brickLayout("normal", 1 + (i % 6), R);
    assert.ok(list.length > 0, "阵型不应为空");
    assert.ok(list.some(b => b.hp > 0), "至少一块可破坏");
    assert.ok(list.every(b => b.hp >= 1 && b.hp <= 3), "血量 1..3");
  }
});
T("关卡推进：下一关球速更快、重装更多", () => {
  const s1 = nextLevelState("normal", 1), s2 = nextLevelState("normal", 3);
  assert.strictEqual(s1.level, 2);
  assert.ok(s1.speed > ballSpeedFor("normal", 1), "第 2 关更快");
  assert.ok(s2.speed > s1.speed, "越后越快");
  assert.ok(s2.armor > s1.armor, "越后重装越多");
  assert.ok(s1.armor <= .6 && s2.armor <= .6, "重装比例有上限");
});
T("同步率：击破装甲按类型加分、封顶 100、暴走中不累加", () => {
  assert.ok(Math.abs(syncGainBrick(50, "a", false) - 52.4) < 1e-9, "装甲 +2.4");
  assert.ok(Math.abs(syncGainBrick(50, "b", false) - 54.0) < 1e-9, "重装 +4.0");
  assert.ok(Math.abs(syncGainBrick(50, "c", false) - 57.0) < 1e-9, "核心 +7.0");
  assert.ok(syncGainBrick(50, "unknown", false) > 50, "未知类型按装甲处理");
  assert.strictEqual(syncGainBrick(99.5, "c", false), 100, "封顶 100");
  assert.strictEqual(syncGainBrick(100, "a", true), 100, "暴走中维持");
  assert.strictEqual(syncGainLevel(97), 100, "过关 +6 同样封顶");
});
T("同步率：漏球 -12、下限 0、随时间衰减按 dt", () => {
  assert.strictEqual(syncLoss(50), 38);
  assert.strictEqual(syncLoss(5), 0, "下限 0");
  assert.ok(Math.abs(syncDecay(50, 1, false) - 49.7) < 1e-9, "1 秒衰减 0.3");
  assert.strictEqual(syncDecay(0.5, 5, false), 0, "下限 0");
  assert.strictEqual(syncDecay(50, 3, true), 50, "暴走中不衰减");
});
T("暴走：满 100 触发，结束后回落到 40", () => {
  assert.ok(!enterBerserk(99.9), "未满不触发");
  assert.ok(enterBerserk(100), "满 100 触发");
  assert.strictEqual(afterBerserk(), 40);
  assert.strictEqual(SYNC.berserk, 6, "暴走时长 6 秒");
});
T("平衡守护：一关（58 块 / 300 秒，实测节奏）内足以触发一次暴走", () => {
  // 按正規隊員的重装比例与实测量级（一关约 300 秒）模拟击破节奏，检验同步率能涨到 100
  const list = brickLayout("normal", 1, mulberry32(42));
  const dur = 300, brickPerSec = list.length / dur;
  let s = SYNC.start, berserkAt = null, acc = 0, idx = 0;
  for (let t = 0; t < dur; t += .1) {
    s = syncDecay(s, .1, false);
    acc += brickPerSec * .1;
    while (acc >= 1 && idx < list.length) {                 // 按节奏击破，不四舍五入成“每 tick 一块”
      s = syncGainBrick(s, list[idx].kind, false); idx++; acc -= 1;
    }
    if (berserkAt === null && enterBerserk(s)) berserkAt = +t.toFixed(1);
  }
  assert.ok(berserkAt !== null, "整关打完应触发暴走，结束时同步率仅 " + s.toFixed(1));
  assert.ok(berserkAt > 60 && berserkAt < dur, "触发时机应在关卡中后段，实际 " + berserkAt + "s");
});
T("平衡守护：完全不击破装甲时同步率只会回落、不会误触发暴走", () => {
  let s = SYNC.start;
  for (let t = 0; t < 200; t += .1) s = syncDecay(s, .1, false);
  assert.strictEqual(s, 0, "长时间无击破应衰减到 0");
  assert.ok(!enterBerserk(s), "不应触发暴走");
});
T("暴走可达性：按页面帧序（命中 → 先判暴走 → 再衰减）能真正触发", () => {
  // 复刻页面 update 的顺序：updateBalls 阶段增益，updateSync 阶段先判定暴走再衰减
  let s = SYNC.start, t = 0, berserkAt = null;
  const frame = (kind) => {
    if (kind) s = syncGainBrick(s, kind, false);
    if (berserkAt === null && enterBerserk(s)) { berserkAt = t; return; }
    s = syncDecay(s, 1 / 60, false);
    t += 1 / 60;
  };
  for (let i = 0; i < 300 * 60 && berserkAt === null; i++) frame(i % 180 === 0 ? "a" : null);  // 每 3 秒击破一块
  assert.ok(berserkAt !== null, "300 秒内应能触发暴走");
  assert.ok(berserkAt < 300, "触发应在关卡时长内，实际 " + berserkAt.toFixed(1) + "s");
});
T("顺序回归：若先衰减再判定，则永远触发不了（这个坑必须守住）", () => {
  let s = SYNC.max, t = 0, ever = false;
  for (let i = 0; i < 600; i++) {                          // 故意用错误顺序模拟
    s = syncDecay(s, 1 / 60, false);
    if (enterBerserk(s)) ever = true;
    s = syncGainBrick(s, "c", false);                      // 增益被封顶在恰好 100
    t += 1 / 60;
  }
  assert.ok(!ever, "错误顺序下确实触发不了——这正是修复前的真实缺陷");
});
T("暴走结束回落到 40，形成「一关一次」的节奏", () => {
  assert.strictEqual(afterBerserk(), 40);
  const rest = (100 - 40) / SYNC_GAIN.a;
  assert.ok(rest > 20, "回落后再攒满需 20+ 块装甲（不会连续暴走），实际 " + rest.toFixed(1));
});
T("计分：连击加成上限 2×、暴走翻倍、核心装甲分值最高", () => {
  assert.strictEqual(brickScore("a", false, 0), 10, "基础分");
  assert.strictEqual(brickScore("a", false, 20), 20, "连击封顶 2×");
  assert.strictEqual(brickScore("a", false, 50), 20, "超出仍封顶");
  assert.strictEqual(brickScore("a", true, 0), 20, "暴走翻倍");
  assert.ok(brickScore("c", false, 0) > brickScore("b", false, 0), "核心 > 重装");
  assert.ok(brickScore("b", false, 0) > brickScore("a", false, 0), "重装 > 装甲");
});
T("道具掉落：约 12% 概率，返回合法类型或 null", () => {
  const R = mulberry32(2026);
  let drops = 0, kinds = {};
  for (let i = 0; i < 20000; i++) {
    const k = powerupRoll(R);
    if (k === null) continue;
    drops++;
    kinds[k] = (kinds[k] || 0) + 1;
    assert.ok(["w", "p", "m", "s"].includes(k), "类型合法: " + k);
  }
  const rate = drops / 20000;
  assert.ok(rate > .09 && rate < .15, "掉落率应接近 12%，实际 " + (rate * 100).toFixed(1) + "%");
  assert.strictEqual(Object.keys(kinds).length, 4, "四种道具都会出现");
});
T("道具持续时长配置：加宽 14s / 穿透 7s / 分裂上限 3 球", () => {
  assert.strictEqual(POWER.w, 14);
  assert.strictEqual(POWER.p, 7);
  assert.strictEqual(POWER.m, 3);
});
T("剩余装甲计数：击破后递减，可判定过关", () => {
  const list = brickLayout("normal", 1, mulberry32(2));
  const n0 = remainingBricks(list);
  assert.strictEqual(n0, list.length);
  list[0].hp = 0; list[1].hp = 0;
  assert.strictEqual(remainingBricks(list), n0 - 2);
  for (const b of list) b.hp = 0;
  assert.strictEqual(remainingBricks(list), 0, "全清 → 0");
});
T("子步细分：高速下拆成多步，保证每步不超过 6px", () => {
  assert.strictEqual(substeps(3), 1, "慢速一步");
  assert.strictEqual(substeps(6), 1, "整 6px 一步");
  assert.strictEqual(substeps(54), 9, "54px 拆 9 步");
  const sp = 605, dt = 1 / 60;
  const steps = substeps(sp * dt);
  assert.ok(sp * dt / steps <= 6 + 1e-9, "每步位移不超过 6px（防穿透）");
  assert.ok(steps >= 2, "使徒級球速下应拆步");
});
T("轨道微调：速度守恒、方向偏转上限 ±0.15 弧度", () => {
  const sp0 = 520;
  const mid = nudgeVelocity(0, -sp0, .5);
  assert.ok(Math.abs(mid.vx) < 1e-9 && Math.abs(mid.vy + sp0) < 1e-9, "rand=0.5 时不偏转");
  const lo = nudgeVelocity(0, -sp0, 0), hi = nudgeVelocity(0, -sp0, 1);
  const pairs = [[lo, 0, -sp0], [hi, 0, -sp0], [nudgeVelocity(300, 400, .2), 300, 400]];
  for (const [v, ox, oy] of pairs) {
    const want = Math.hypot(ox, oy), got = Math.hypot(v.vx, v.vy);
    assert.ok(Math.abs(got - want) < 1e-9, "速度大小守恒（应 " + want + "，实际 " + got.toFixed(4) + "）");
  }
  const dLo = Math.abs(Math.atan2(lo.vy, lo.vx) - Math.atan2(-sp0, 0));
  const dHi = Math.abs(Math.atan2(hi.vy, hi.vx) - Math.atan2(-sp0, 0));
  assert.ok(Math.abs(dLo - .15) < 1e-9, "下限偏转 0.15，实际 " + dLo.toFixed(4));
  assert.ok(Math.abs(dHi - .15) < 1e-9, "上限偏转 0.15，实际 " + dHi.toFixed(4));
});
T("残局防卡死：轨道微调能打破垂直往复（改变水平分量）", () => {
  let v = { vx: 0, vy: -520 };                            // 纯垂直（最坏情况）
  let moved = false;
  for (let i = 0; i < 10; i++) {
    v = nudgeVelocity(v.vx, v.vy, i / 9);
    if (Math.abs(v.vx) > 1) moved = true;
  }
  assert.ok(moved, "10 次微调后应产生水平分量");
  assert.ok(Math.abs(Math.hypot(v.vx, v.vy) - 520) < 1e-9, "速度仍守恒");
});
T("漏球与失败判定：备用球递减，耗尽判负", () => {
  const st = { lives: DIFFS.normal.lives - 1, over: false, victory: false };
  const loseBall = () => { st.lives--; if (st.lives < 0 && !st.over) { st.over = true; st.victory = false; } };
  loseBall();
  assert.ok(!st.over && st.lives === 1, "还有备用球");
  loseBall(); loseBall();
  assert.ok(st.over && !st.victory, "耗尽判负");
});
T("关卡推进与通关判定：最后一关清空即通关", () => {
  const cfg = DIFFS.normal;
  const st = { level: 1, over: false, victory: false };
  const levelClear = () => { if (st.level >= cfg.levels) { st.over = true; st.victory = true; st.level = cfg.levels; return; } st.level++; };
  for (let i = 0; i < cfg.levels - 1; i++) levelClear();
  assert.strictEqual(st.level, cfg.levels, "推进到最后一关");
  assert.ok(!st.over, "未通关");
  levelClear();
  assert.ok(st.over && st.victory, "清空最后一关 → 通关");
});
T("通关奖励：与剩余备用球挂钩", () => {
  const bonus = lives => 3000 + lives * 600;
  assert.ok(bonus(2) > bonus(0), "备用球越多奖励越高");
  assert.strictEqual(bonus(0), 3000);
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
