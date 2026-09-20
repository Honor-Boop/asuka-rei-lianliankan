// 塔防规则回归测试（与 tower.html 内联脚本逻辑一致）
// 与页面逻辑逐字一致，仅把隐式全局改为显式参数，用于回归测试
const assert = require("assert");

const CELL = 72, COLS = 13, ROWS = 7;
const W = CELL * COLS, H = CELL * ROWS;
const WAVE_PLAN = {
  easy:   { key: "easy",   name: "見習い",   waves: 15, bossAt: [8, 15],    hpMul: .85,  funds: 460, hq: 20 },
  normal: { key: "normal", name: "正規隊員", waves: 20, bossAt: [10, 20],   hpMul: 1,    funds: 420, hq: 20 },
  hard:   { key: "hard",   name: "使徒級",   waves: 25, bossAt: [10, 18, 25], hpMul: 1.15, funds: 420, hq: 18 },
};
const TOWERS = {
  rei:      { key: "rei",      name: "零号机 · 绫波",   cost: 90,  range: 140, dmg: 11, rate: .85, slow: .40, slowT: 1.6, color: "#74c4ff", badge: "assets/match3/rei_a.png" },
  asuka:    { key: "asuka",    name: "二号机 · 明日香", cost: 130, range: 112, dmg: 15, rate: .32, color: "#ff8055", badge: "assets/match3/asuka_a.png" },
  positron: { key: "positron", name: "阳电子炮台",      cost: 220, range: 246, dmg: 62, rate: 2.1, color: "#70ffb8" },
  field:    { key: "field",    name: "AT 力场发生器",   cost: 170, range: 120, dmg: 9,  rate: 1.0, aoe: true, color: "#c9a6ff" },
};
const ANGELS = {
  s1:   { key: "s1",   name: "小型使徒",   hp: 55,   speed: 62, armor: 0,  reward: 20,  leak: 1, r: 13, color: "#9c7bff", shape: 4 },
  s2:   { key: "s2",   name: "中型使徒",   hp: 130,  speed: 48, armor: 2,  reward: 34,  leak: 1, r: 17, color: "#70ffb8", shape: 6 },
  s3:   { key: "s3",   name: "重装使徒",   hp: 320,  speed: 34, armor: 9,  reward: 60,  leak: 2, r: 21, color: "#ff7057", shape: 5 },
  s4:   { key: "s4",   name: "分裂使徒",   hp: 160,  speed: 52, armor: 1,  reward: 40,  leak: 2, r: 18, color: "#ffe066", shape: 3, split: 2 },
  boss: { key: "boss", name: "使徒 · 本体", hp: 1500, speed: 22, armor: 11, reward: 450, leak: 5, r: 30, color: "#ff5a3c", shape: 8 },
};
const WAY_GRID = [[-1, 2], [2, 2], [2, 5], [5, 5], [5, 1], [8, 1], [8, 5], [11, 5], [11, 2], [12, 2]];
const HQ_CELL = [12, 2];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}
function pointAt(pts, d) {
  if (d <= 0) return { x: pts[0].x, y: pts[0].y };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= d) {
      const k = seg ? (d - acc) / seg : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}
function pathCells(pts, cell) {
  const set = new Set();
  for (let i = 1; i < pts.length; i++) {
    const c0 = Math.floor(pts[i - 1].x / cell), r0 = Math.floor(pts[i - 1].y / cell);
    const c1 = Math.floor(pts[i].x / cell), r1 = Math.floor(pts[i].y / cell);
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    set.add(c + "," + r);
    while (c !== c1 || r !== r1) { c += dc; r += dr; set.add(c + "," + r); }
  }
  return set;
}
function towerStat(type, level) {
  const T = TOWERS[type], m = level - 1;
  return {
    dmg: T.dmg * Math.pow(1.75, m),
    range: T.range * Math.pow(1.12, m),
    rate: T.rate * Math.pow(.88, m),
    slow: T.slow ? Math.min(.72, T.slow + .1 * m) : 0,
    slowT: T.slowT ? T.slowT + .3 * m : 0,
    aoe: !!T.aoe,
  };
}
function upgradeCost(type, level) {
  if (level >= 3) return null;
  return Math.round(TOWERS[type].cost * .8 * level);
}
function invested(type, level) {
  let sum = TOWERS[type].cost;
  for (let l = 1; l < level; l++) sum += upgradeCost(type, l);
  return sum;
}
function sellRefund(type, level) { return Math.floor(invested(type, level) * 7 / 10); }
function damageAfterArmor(dmg, armor) { return Math.max(dmg * .15, dmg - armor); }
function applySlow(st, factor, dur) {
  if (factor >= st.slowF) { st.slowF = factor; st.slowT = Math.max(st.slowT, dur); }
  else if (st.slowT <= 0) { st.slowF = factor; st.slowT = dur; }
  return st;
}
function effSpeed(base, st) { return st.slowT > 0 ? base * (1 - st.slowF) : base; }
function pickTarget(tx, ty, range, list) {
  let best = null, bestD = -1;
  const r2 = range * range;
  for (const e of list) {
    if (e.dead) continue;
    if (dist2(tx, ty, e.x, e.y) > r2) continue;
    if (e.dist > bestD) { best = e; bestD = e.dist; }
  }
  return best;
}
function angelHp(type, waveNo, diff) { return Math.round(ANGELS[type].hp * (1 + (waveNo - 1) * .10) * WAVE_PLAN[diff].hpMul); }
function waveComp(diff, waveNo, rng) {
  const R = rng || Math.random, p = WAVE_PLAN[diff], out = [];
  if (p.bossAt.includes(waveNo)) {
    if (waveNo === p.waves) { out.push({ type: "boss", count: 1, gap: 0 }); return out; }
    out.push({ type: "boss", count: 1, gap: 0, after: 1.6 });
    out.push({ type: "s1", count: 4 + waveNo, gap: .5 });
    return out;
  }
  out.push({ type: "s1", count: Math.max(3, Math.round(4 + waveNo * .9)), gap: Math.max(.28, .62 - waveNo * .012) });
  if (waveNo >= 4) out.push({ type: "s2", count: Math.round(1 + (waveNo - 3) * .55), gap: .8, after: .8 });
  if (waveNo >= 7) out.push({ type: "s3", count: Math.round(1 + (waveNo - 6) * .35), gap: 1.3, after: .8 });
  if (waveNo >= 9) out.push({ type: "s4", count: Math.round(1 + (waveNo - 8) * .4), gap: 1.1, after: .6 });
  return out;
}
function expandWave(diff, waveNo, rng) {
  const out = [];
  let t = 0;
  for (const g of waveComp(diff, waveNo, rng)) {
    for (let i = 0; i < g.count; i++) { out.push({ t, type: g.type }); t += g.gap; }
    t += (g.after || 0) + .5;
  }
  return out;
}
function totalWaves(diff) { return WAVE_PLAN[diff].waves; }
function isBossWave(diff, waveNo) { return WAVE_PLAN[diff].bossAt.includes(waveNo); }
function earlyBonus(prepLeft) { return Math.max(0, Math.round(prepLeft * 4)); }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const PTS = WAY_GRID.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }));

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}

T("通道长度 = 折线各段之和", () => {
  const L = pathLength(PTS);
  let manual = 0;
  for (let i = 1; i < PTS.length; i++) manual += Math.hypot(PTS[i].x - PTS[i - 1].x, PTS[i].y - PTS[i - 1].y);
  assert.ok(Math.abs(L - manual) < 1e-9);
  assert.ok(L > 0, "长度应为正");
  // 格数 27 段（3+3+3+4+3+4+3+3+1=27）→ 27×72
  assert.strictEqual(L, 27 * CELL);
});
T("pointAt：起点 / 中点 / 拐点 / 末端 / 越界夹紧", () => {
  const a = pointAt(PTS, 0);
  assert.deepStrictEqual([a.x, a.y], [PTS[0].x, PTS[0].y], "d=0 在起点");
  const b = pointAt(PTS, 36);                       // 第一段中点（水平段，长 216）
  assert.ok(Math.abs(b.x - (PTS[0].x + 36)) < 1e-9 && Math.abs(b.y - PTS[0].y) < 1e-9, "第一段中点");
  const g = pointAt(PTS, 216);                      // 第一个拐点
  assert.ok(Math.abs(g.x - PTS[1].x) < 1e-9 && Math.abs(g.y - PTS[1].y) < 1e-9, "拐点落在航点上");
  const far = pointAt(PTS, 1e6);
  assert.deepStrictEqual([far.x, far.y], [PTS[PTS.length - 1].x, PTS[PTS.length - 1].y], "越界夹紧到末端");
  const neg = pointAt(PTS, -50);
  assert.deepStrictEqual([neg.x, neg.y], [PTS[0].x, PTS[0].y], "负距离夹紧到起点");
});
T("pointAt 全程连续：弦长不超过弧长步长，直线段内精确等距", () => {
  const step = 7, total = pathLength(PTS);
  let prev = pointAt(PTS, 0);
  for (let d = step; d <= total; d += step) {
    const p = pointAt(PTS, d);
    const chord = Math.hypot(p.x - prev.x, p.y - prev.y);
    assert.ok(chord <= step + 1e-9, "弦长不应超过弧长（拐角处应更短），实际 " + chord.toFixed(4));
    prev = p;
  }
  // 直线段（第一段为水平段，长 216）：段内采样应精确等距
  const a = pointAt(PTS, 20), b = pointAt(PTS, 50), c = pointAt(PTS, 80);
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 30) < 1e-9, "水平段内步长 30");
  assert.ok(Math.abs(Math.hypot(c.x - b.x, c.y - b.y) - 30) < 1e-9);
  assert.ok(Math.abs(a.y - b.y) < 1e-9 && Math.abs(b.y - c.y) < 1e-9, "水平段 y 恒定");
  // 竖直段（第二段）：x 恒定
  const v1 = pointAt(PTS, 216 + 30), v2 = pointAt(PTS, 216 + 60);
  assert.ok(Math.abs(v1.x - v2.x) < 1e-9, "竖直段 x 恒定");
  assert.ok(Math.abs(Math.hypot(v2.x - v1.x, v2.y - v1.y) - 30) < 1e-9, "竖直段内步长 30");
});
T("通道格集合：覆盖 L 型拐弯的所有经过格", () => {
  const cells = pathCells([{ x: CELL * .5, y: CELL * .5 }, { x: CELL * 2.5, y: CELL * .5 }, { x: CELL * 2.5, y: CELL * 2.5 }], CELL);
  assert.ok(cells.has("0,0") && cells.has("1,0") && cells.has("2,0"), "水平段三格");
  assert.ok(cells.has("2,1") && cells.has("2,2"), "垂直段两格");
  assert.strictEqual(cells.size, 5, "共 5 格且不重复");
});
T("通道格不可建造（与本部格一起排除）", () => {
  const blocked = pathCells(PTS, CELL);
  blocked.add(HQ_CELL.join(","));
  assert.ok(blocked.has("2,2"), "拐点格被排除");
  assert.ok(blocked.has("12,2"), "本部格被排除");
  assert.ok(!blocked.has("0,0"), "左上角空地为可建格");
  // 通道占用格数 ≤ 27（同格不重复计数）
  let pathCellCount = 0;
  for (const k of blocked) if (k !== HQ_CELL.join(",")) pathCellCount++;
  assert.ok(pathCellCount > 20 && pathCellCount <= 27, "通道格数 " + pathCellCount);
});
T("炮台属性：Lv1 等于基础值；升级提升伤害/射程、缩短间隔", () => {
  const l1 = towerStat("positron", 1), l3 = towerStat("positron", 3);
  assert.strictEqual(l1.dmg, TOWERS.positron.dmg);
  assert.strictEqual(l1.range, TOWERS.positron.range);
  assert.ok(l3.dmg > l1.dmg && l3.range > l1.range && l3.rate < l1.rate, "Lv3 应更强");
  assert.ok(Math.abs(l3.dmg - 62 * 1.75 * 1.75) < 1e-9, "伤害按 1.75^n 递增");
});
T("减速属性：随等级提升且封顶 72%", () => {
  assert.strictEqual(towerStat("rei", 1).slow, .40);
  assert.ok(Math.abs(towerStat("rei", 2).slow - .50) < 1e-9);
  assert.ok(Math.abs(towerStat("rei", 3).slow - .60) < 1e-9);
  const capped = { slowF: 0, slowT: 0 };
  applySlow(capped, .95, 3);
  assert.strictEqual(capped.slowF, .95, "机制上不封顶（数值由配置保证 ≤.72）");
  assert.ok(towerStat("rei", 4).slow <= .72, "等级越界也不会超过封顶");
});
T("升级费用：Lv1→2 / 2→3 递增，满级返回 null", () => {
  assert.strictEqual(upgradeCost("rei", 1), 72);
  assert.strictEqual(upgradeCost("rei", 2), 144);
  assert.strictEqual(upgradeCost("rei", 3), null, "满级不可再升");
  assert.ok(upgradeCost("positron", 2) > upgradeCost("positron", 1));
});
T("投入与返还：三级总投入正确、拆除返还 70% 向下取整", () => {
  assert.strictEqual(invested("rei", 1), 90);
  assert.strictEqual(invested("rei", 2), 90 + 72);
  assert.strictEqual(invested("rei", 3), 90 + 72 + 144);
  assert.strictEqual(sellRefund("rei", 3), Math.floor(306 * .7));
  assert.strictEqual(sellRefund("rei", 1), 63);
  assert.ok(sellRefund("rei", 3) < invested("rei", 3), "返还必然少于投入");
});
T("护甲减伤：按护甲扣减，保底 15% 伤害", () => {
  assert.strictEqual(damageAfterArmor(62, 0), 62, "无甲全额");
  assert.strictEqual(damageAfterArmor(62, 14), 48, "Boss 护甲扣 14");
  assert.ok(Math.abs(damageAfterArmor(9, 9) - 1.35) < 1e-9, "伤害=护甲 → 保底 15%");
  assert.ok(Math.abs(damageAfterArmor(5, 20) - .75) < 1e-9, "护甲远高于伤害 → 保底 15%");
  assert.ok(damageAfterArmor(320, 9) > 0, "高伤仍有效");
});
T("减速规则：强减速覆盖弱减速，弱减速不顶替强减速", () => {
  const st = { slowF: 0, slowT: 0 };
  applySlow(st, .4, 1.6);
  assert.strictEqual(st.slowF, .4);
  applySlow(st, .6, 1.9);
  assert.strictEqual(st.slowF, .6, "更强的减速替换");
  assert.strictEqual(st.slowT, 1.9);
  applySlow(st, .4, 5);
  assert.strictEqual(st.slowF, .6, "更弱的减速不生效");
  assert.strictEqual(st.slowT, 1.9, "持续时间也不被拉长");
});
T("减速不叠加：同级多次施放只刷新时长", () => {
  const st = { slowF: 0, slowT: 0 };
  applySlow(st, .5, 2);
  applySlow(st, .5, 3);
  assert.strictEqual(st.slowF, .5, "仍是 50%，不会变成 100%");
  assert.strictEqual(st.slowT, 3, "时长取更久者");
});
T("减速到期后速度恢复", () => {
  const st = { slowF: .6, slowT: .1 };
  assert.ok(Math.abs(effSpeed(100, st) - 40) < 1e-9, "减速中为 40% 速度");
  st.slowT = 0;
  assert.strictEqual(effSpeed(100, st), 100, "到期恢复全速");
  const fresh = { slowF: 0, slowT: 0 };
  assert.strictEqual(effSpeed(62, fresh), 62, "未减速不变");
});
T("选靶：射程内最靠前者（dist 最大）优先", () => {
  const near = { x: 50, y: 0, dist: 50 };
  const far = { x: 80, y: 0, dist: 300 };
  const out = { x: 500, y: 0, dist: 999 };
  assert.strictEqual(pickTarget(0, 0, 100, [near, far, out]), far, "两者都在射程内 → 选更靠前的");
  assert.strictEqual(pickTarget(0, 0, 100, [near, out]), near, "只剩一个在射程内");
  assert.strictEqual(pickTarget(0, 0, 10, [near, far, out]), null, "都超射程 → null");
  assert.strictEqual(pickTarget(0, 0, 100, []), null, "空列表 → null");
  const dead = { x: 60, y: 0, dist: 900, dead: true };
  assert.strictEqual(pickTarget(0, 0, 100, [near, dead]), near, "已死亡目标跳过");
});
T("选靶：射程边界按平方距离判定", () => {
  const e = { x: 200, y: 100, dist: 10 };
  assert.ok(pickTarget(100, 100, 100, [e]) === e, "恰好 100 距 → 命中");
  assert.strictEqual(pickTarget(100, 100, 99.9, [e]), null, "略小射程 → 不命中");
});
T("使徒血量：随波次与难度递增、恒为整数", () => {
  assert.strictEqual(angelHp("s1", 1, "normal"), 55, "第 1 波为基础值");
  assert.ok(angelHp("s1", 10, "normal") > angelHp("s1", 1, "normal"), "越后越强");
  assert.ok(angelHp("s1", 5, "hard") > angelHp("s1", 5, "easy"), "难度更高血更厚");
  for (const d of ["easy", "normal", "hard"]) {
    for (const t of Object.keys(ANGELS)) {
      const v = angelHp(t, 12, d);
      assert.strictEqual(v, Math.round(v), t + " 血量应为整数");
      assert.ok(v > 0);
    }
  }
});
T("波次编成：敌人种类按期解锁（1 小型 / 4 中型 / 7 重型 / 9 分裂）", () => {
  const kinds = w => waveComp("normal", w).map(g => g.type);
  assert.deepStrictEqual(kinds(1), ["s1"], "第 1 波仅小型");
  assert.ok(!kinds(3).includes("s2"), "第 3 波无中型");
  assert.ok(kinds(4).includes("s2"), "第 4 波起有中型");
  assert.ok(!kinds(6).includes("s3"), "第 6 波无重装");
  assert.ok(kinds(7).includes("s3"), "第 7 波起有重装");
  assert.ok(!kinds(8).includes("s4"), "第 8 波无分裂");
  assert.ok(kinds(9).includes("s4"), "第 9 波起有分裂");
});
T("波次编成：非 Boss 波总敌人数随波次单调不减", () => {
  const total = w => waveComp("normal", w).reduce((s, g) => s + g.count, 0);
  let prev = 0;
  for (let w = 1; w <= 20; w++) {
    if (isBossWave("normal", w)) continue;
    const t = total(w);
    assert.ok(t >= prev, "第 " + w + " 波人数不应少于上一波（" + t + " < " + prev + "）");
    prev = t;
  }
});
T("Boss 波：中途 Boss 波伴随小型群，最终波只有 Boss 本体", () => {
  assert.ok(isBossWave("normal", 10) && isBossWave("normal", 20), "Boss 波位");
  const mid = waveComp("normal", 10);
  assert.strictEqual(mid[0].type, "boss");
  assert.ok(mid.length > 1 && mid[1].type === "s1", "中途 Boss 波带小型群");
  const fin = waveComp("normal", 20);
  assert.strictEqual(fin.length, 1, "最终波只有 Boss");
  assert.strictEqual(fin[0].type, "boss");
  assert.ok(!isBossWave("normal", 9) && !isBossWave("normal", 19), "非 Boss 波判定");
});
T("难度波数：見習い 15 / 正規隊員 20 / 使徒級 25", () => {
  assert.strictEqual(totalWaves("easy"), 15);
  assert.strictEqual(totalWaves("normal"), 20);
  assert.strictEqual(totalWaves("hard"), 25);
  assert.strictEqual(WAVE_PLAN.easy.hq, 20, "見習い 与正規隊員同为 20 点耐久");
  assert.strictEqual(WAVE_PLAN.normal.hq, 20);
  assert.ok(WAVE_PLAN.hard.hq < WAVE_PLAN.normal.hq, "使徒級耐久更少（更难）");
  assert.ok(WAVE_PLAN.hard.hpMul > WAVE_PLAN.normal.hpMul, "使徒級敌人更厚");
});
T("expandWave：生成时间严格递增、总数等于编成数量", () => {
  const R = mulberry32(9);
  for (const d of ["easy", "normal", "hard"]) {
    for (let w = 1; w <= totalWaves(d); w++) {
      const q = expandWave(d, w, R);
      const expect = waveComp(d, w, R).reduce((s, g) => s + g.count, 0);
      assert.strictEqual(q.length, expect, d + " 第 " + w + " 波数量");
      for (let i = 1; i < q.length; i++) assert.ok(q[i].t >= q[i - 1].t, "生成时间应不减");
      for (const s of q) assert.ok(ANGELS[s.type], "类型合法: " + s.type);
      assert.strictEqual(q[0].t, 0, "首个敌人应在波次开始瞬间进入");
    }
  }
});
T("全难度全波次：总敌人数有限且可用炮台击杀（经济可行性粗判）", () => {
  for (const d of ["easy", "normal", "hard"]) {
    let totalReward = 0, totalHp = 0;
    for (let w = 1; w <= totalWaves(d); w++) {
      for (const s of expandWave(d, w, mulberry32(w))) {
        totalReward += ANGELS[s.type].reward;
        totalHp += angelHp(s.type, w, d);
      }
    }
    assert.ok(totalHp > 0 && totalReward > WAVE_PLAN[d].funds, d + " 击杀奖励总量应超过初始经费");
  }
});
T("提前出击奖励：剩余备战时间换算经费（0.25 秒 = 1 经费）", () => {
  assert.strictEqual(earlyBonus(0), 0);
  assert.strictEqual(earlyBonus(10), 40);
  assert.strictEqual(earlyBonus(3.2), 13, "四舍五入");
  assert.strictEqual(earlyBonus(-5), 0, "负数不出负经费");
});
T("经济：初始经费至少能建三座零号机，但不足以堆满阳电子炮", () => {
  for (const d of ["easy", "normal", "hard"]) {
    const f = WAVE_PLAN[d].funds;
    assert.ok(f >= TOWERS.rei.cost * 3, d + " 初始经费应能建三座零号机");
    assert.ok(f < TOWERS.positron.cost * 3, d + " 初始不足以堆三座阳电子炮");
  }
});
T("漏怪与胜负状态机：耐久归零判负，全波次清空判胜", () => {
  const st = { hq: 20, wave: 0, inWave: false, waves: 20, over: false, victory: false };
  const leak = n => { st.hq -= n; if (st.hq <= 0 && !st.over) { st.over = true; st.victory = false; } };
  leak(5); leak(5);
  assert.ok(!st.over, "未归零不判负");
  assert.strictEqual(st.hq, 10);
  leak(10);
  assert.ok(st.over && !st.victory, "归零判负");
  const st2 = { over: false, victory: false, cleared: true, wave: 20, waves: 20 };
  const finish = () => { if (st2.cleared && st2.wave >= st2.waves) { st2.over = true; st2.victory = true; } };
  finish();
  assert.ok(st2.over && st2.victory, "全清判胜");
});
T("分裂使徒：击破后裂出两只小型，且分裂体不再分裂", () => {
  const spawned = [];
  const kill = (e, noSplit) => { if (ANGELS[e.type].split && !noSplit) for (let i = 0; i < ANGELS[e.type].split; i++) spawned.push({ type: "s1", noSplit: true }); };
  kill({ type: "s4" });
  assert.strictEqual(spawned.length, 2, "裂成两只");
  assert.ok(spawned.every(s => s.type === "s1"), "分裂体为小型使徒");
  assert.ok(spawned.every(s => s.noSplit), "分裂体标记不再分裂");
  spawned.length = 0;
  kill({ type: "s4" }, true);
  assert.strictEqual(spawned.length, 0, "带 noSplit 标记的不再裂");
  kill({ type: "s1" });
  assert.strictEqual(spawned.length, 0, "小型使徒本身不裂");
});
T("减速 + 护甲组合：重装使徒在减速下推进更慢、阳电子炮仍能有效杀伤", () => {
  const s3 = { slowF: 0, slowT: 0 };
  const fast = effSpeed(ANGELS.s3.speed, s3);
  applySlow(s3, towerStat("rei", 3).slow, 2);
  const slowed = effSpeed(ANGELS.s3.speed, s3);
  assert.ok(slowed < fast * .5, "三级减速下速度不足一半");
  const dmg = damageAfterArmor(towerStat("positron", 1).dmg, ANGELS.s3.armor);
  assert.ok(dmg > 50, "阳电子炮对重装仍打出 50+ 伤害");
  const poor = damageAfterArmor(towerStat("rei", 1).dmg, ANGELS.s3.armor);
  assert.ok(poor < 3, "零号机对重装输出很低（定位是减速控场），实际 " + poor.toFixed(2));
  assert.ok(poor < damageAfterArmor(towerStat("positron", 1).dmg, ANGELS.s3.armor), "阳电子炮应明显高于零号机");
});
T("通道上不可建造、空地上可建造、已建塔位置不可重复建造", () => {
  const blocked = pathCells(PTS, CELL); blocked.add(HQ_CELL.join(","));
  const towersList = [{ c: 0, r: 0 }];
  const canBuild = (c, r) => !blocked.has(c + "," + r) && !towersList.some(t => t.c === c && t.r === r);
  assert.ok(!canBuild(2, 2), "通道格");
  assert.ok(!canBuild(12, 2), "本部格");
  assert.ok(!canBuild(0, 0), "已占格");
  assert.ok(canBuild(0, 1), "相邻空地可建");
  assert.ok(canBuild(6, 3), "中部空地可建");
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
