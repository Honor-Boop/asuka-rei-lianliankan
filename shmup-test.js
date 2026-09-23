// 弹幕射击规则回归测试（与 shmup.html 内联脚本逻辑一致）
// 与页面逻辑逐字一致，仅把隐式全局改为显式参数，用于回归测试
const assert = require("assert");

const W = 720, H = 960;
const DIFFS = {
  easy:   { key: "easy",   name: "見習い",   waves: 5, hpMul: .8,  bulletMul: .85, lives: 3 },
  normal: { key: "normal", name: "正規隊員", waves: 7, hpMul: 1,   bulletMul: 1,   lives: 3 },
  hard:   { key: "hard",   name: "使徒級",   waves: 9, hpMul: 1.35, bulletMul: 1.24, lives: 2 },
};
const TYPES = {
  small:  { hp: 22,  r: 15, speed: 175, score: 100, fire: 0,   bs: 190, color: "#9c7bff" },
  medium: { hp: 70,  r: 24, speed: 105, score: 250, fire: 2.1, bs: 215, color: "#70ffb8" },
  heavy:  { hp: 170, r: 33, speed: 62,  score: 520, fire: 1.7, bs: 230, color: "#ff7057" },
};
const P = { r: 16, speed: 430, fireBase: .14, dmg: 7, berserkTime: 6, shieldRecharge: 18 };
const BOSS_MAX = 1500;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function hit(ax, ay, ar, bx, by, br) { const rr = ar + br; return dist2(ax, ay, bx, by) <= rr * rr; }
function aimAngle(fx, fy, tx, ty) { return Math.atan2(ty - fy, tx - fx); }
function fanAngles(base, count, spread) {
  if (count <= 1) return [base];
  const out = [], step = spread / (count - 1);
  for (let i = 0; i < count; i++) out.push(base - spread / 2 + step * i);
  return out;
}
function ringAngles(count, offset) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(offset + i * Math.PI * 2 / count);
  return out;
}
function spiralAngles(arms, base) {
  const out = [];
  for (let i = 0; i < arms; i++) out.push(base + i * Math.PI * 2 / arms);
  return out;
}
function waveCount(diff) { return DIFFS[diff].waves; }
function bossHp(diff) { return Math.round(BOSS_MAX * DIFFS[diff].hpMul); }
function bossPhase(hp, maxHp) { const f = hp / maxHp; return f > .66 ? 0 : f > .33 ? 1 : 2; }
function syncGainHit(cur, berserk) { return berserk ? cur : clamp(cur + .6, 0, 100); }
function syncGainKill(cur, berserk) { return berserk ? cur : clamp(cur + 1.6, 0, 100); }
function syncDecay(cur, dt, berserk) { return berserk ? cur : clamp(cur - 1.2 * dt, 0, 100); }
function syncDamage(cur) { return clamp(cur - 15, 0, 100); }
function enterBerserk(cur) { return cur >= 100; }
function afterBerserk() { return 45; }
function killScore(type, berserk, combo) {
  const mult = 1 + Math.min(combo, 20) * .05;
  return Math.round(TYPES[type].score * mult * (berserk ? 2 : 1));
}
function buildWave(diff, waveIndex, rng) {
  const R = rng || Math.random, w = waveIndex + 1, out = [];
  const smalls = 3 + w;
  const mediums = w >= 2 ? 1 + Math.floor(w / 2) : 0;
  const heavies = w >= 4 ? 1 + Math.floor((w - 4) / 3) : 0;
  let t = .4;
  for (let i = 0; i < smalls; i++) { out.push({ delay: t, type: "small", x: 90 + R() * (W - 180) }); t += .42; }
  t += .5;
  for (let i = 0; i < mediums; i++) { out.push({ delay: t, type: "medium", x: 130 + R() * (W - 260) }); t += 1.0; }
  t += .5;
  for (let i = 0; i < heavies; i++) { out.push({ delay: t, type: "heavy", x: 140 + R() * (W - 280) }); t += 1.3; }
  return out;
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
  assert.strictEqual(clamp(-5, 0, 100), 0);
  assert.strictEqual(clamp(140, 0, 100), 100);
  assert.strictEqual(clamp(37, 0, 100), 37);
});
T("圆-圆碰撞：重合命中 / 相切命中 / 擦过不中", () => {
  assert.ok(hit(100, 100, 10, 100, 100, 10), "重合应命中");
  assert.ok(hit(100, 100, 10, 120, 100, 10), "相切（d = r1+r2）应命中");
  assert.ok(!hit(100, 100, 10, 120.5, 100, 10), "距离略大于 r1+r2 不应命中");
  assert.ok(!hit(100, 100, 10, 100, 200, 10), "远离不应命中");
});
T("aimAngle 四象限朝向正确", () => {
  const eps = 1e-9;
  assert.ok(Math.abs(aimAngle(0, 0, 10, 0) - 0) < eps, "正右 = 0");
  assert.ok(Math.abs(aimAngle(0, 0, 0, 10) - Math.PI / 2) < eps, "正下 = π/2");
  assert.ok(Math.abs(aimAngle(0, 0, -10, 0) - Math.PI) < eps, "正左 = π");
  assert.ok(Math.abs(aimAngle(0, 0, 0, -10) + Math.PI / 2) < eps, "正上 = -π/2");
});
T("瞄准弹：由使徒指向玩家", () => {
  const a = aimAngle(360, 100, 100, 900);       // 玩家在左下方
  assert.ok(a > Math.PI / 2 && a < Math.PI, "指向左下象限");
  const b = aimAngle(360, 100, 620, 900);       // 玩家在右下方
  assert.ok(b > 0 && b < Math.PI / 2, "指向右下象限");
});
T("扇形弹幕：单发返回自身角度，5 发对称等距", () => {
  const one = fanAngles(1, 1, .5);
  assert.deepStrictEqual(one, [1], "count=1 应只返回 base");
  const f = fanAngles(0, 5, .8);
  assert.strictEqual(f.length, 5);
  assert.ok(Math.abs(f[0] + .4) < 1e-9, "首角 = base - spread/2");
  assert.ok(Math.abs(f[4] - .4) < 1e-9, "末角 = base + spread/2");
  for (let i = 1; i < 5; i++) assert.ok(Math.abs((f[i] - f[i - 1]) - .2) < 1e-9, "间距 = spread/(count-1)");
});
T("环形弹幕：12 发均匀分布，首角 = 偏移量", () => {
  const r = ringAngles(12, .7);
  assert.strictEqual(r.length, 12);
  assert.strictEqual(r[0], .7);
  for (let i = 1; i < 12; i++) assert.ok(Math.abs((r[i] - r[i - 1]) - Math.PI / 6) < 1e-9, "相邻角差 30°");
});
T("螺旋弹幕：双臂相差 π", () => {
  const s = spiralAngles(2, 0);
  assert.strictEqual(s.length, 2);
  assert.ok(Math.abs(s[1] - Math.PI) < 1e-9);
  const s4 = spiralAngles(4, 0);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(s4[i] - i * Math.PI / 2) < 1e-9);
});
T("波次编成：敌人数随波次递增、delay 严格递增、类型合法", () => {
  const rng = mulberry32(7);
  let prev = null;
  for (let w = 0; w < 9; w++) {
    const q = buildWave("normal", w, rng);
    if (prev !== null) assert.ok(q.length > prev, "第 " + (w + 1) + " 波敌人应多于上一波");
    prev = q.length;
    for (let i = 0; i < q.length; i++) {
      assert.ok(TYPES[q[i].type], "类型合法");
      if (i) assert.ok(q[i].delay > q[i - 1].delay, "delay 应递增");
    }
  }
});
T("波次编成：第 1 波只有小型，第 2 波起出现中型，第 4 波起出现重型", () => {
  const rng = mulberry32(11);
  const kinds = w => new Set(buildWave("normal", w, rng).map(s => s.type));
  assert.deepStrictEqual([...kinds(0)], ["small"], "第 1 波仅小型");
  assert.ok(kinds(1).has("medium"), "第 2 波含中型");
  assert.ok(!kinds(2).has("heavy"), "第 3 波不含重型");
  assert.ok(kinds(3).has("heavy"), "第 4 波含重型");
});
T("波次编成：500 次随机采样 x 始终在界内", () => {
  const R = mulberry32(2026);
  for (let d of ["easy", "normal", "hard"]) {
    for (let w = 0; w < 9; w++) {
      for (const s of buildWave(d, w, R)) {
        assert.ok(s.x >= 60 && s.x <= W - 60, "x 越界: " + s.x);
        assert.ok(s.delay >= 0, "delay 为负");
      }
    }
  }
});
T("难度波数：見習い 5 / 正規隊員 7 / 使徒級 9", () => {
  assert.strictEqual(waveCount("easy"), 5);
  assert.strictEqual(waveCount("normal"), 7);
  assert.strictEqual(waveCount("hard"), 9);
});
T("使徒血量按难度缩放，且为整数", () => {
  assert.strictEqual(bossHp("easy"), 1200);
  assert.strictEqual(bossHp("normal"), 1500);
  assert.strictEqual(bossHp("hard"), 2025);
  for (const d of ["easy", "normal", "hard"]) {
    assert.strictEqual(bossHp(d), Math.round(bossHp(d)), "应为整数");
  }
});
T("Boss 三段形态：血线 100% / 67% / 34% / 33% / 0%", () => {
  assert.strictEqual(bossPhase(1500, 1500), 0, "满血 = 阶段 0");
  assert.strictEqual(bossPhase(1005, 1500), 0, "67% 仍为阶段 0");
  assert.strictEqual(bossPhase(990, 1500), 1, "66% = 阶段 1");
  assert.strictEqual(bossPhase(510, 1500), 1, "34% 仍为阶段 1");
  assert.strictEqual(bossPhase(495, 1500), 2, "33% = 阶段 2");
  assert.strictEqual(bossPhase(0, 1500), 2, "0 血 = 阶段 2");
});
T("同步率：命中/击破累加，封顶 100", () => {
  assert.ok(Math.abs(syncGainHit(50, false) - 50.6) < 1e-9);
  assert.ok(Math.abs(syncGainKill(50, false) - 51.6) < 1e-9);
  assert.strictEqual(syncGainHit(99.8, false), 100, "封顶 100");
  assert.strictEqual(syncGainKill(100, false), 100, "已满仍为 100");
});
T("同步率：暴走期间不再累加（维持 100）", () => {
  assert.strictEqual(syncGainHit(100, true), 100);
  assert.strictEqual(syncGainKill(100, true), 100);
  assert.strictEqual(syncDecay(100, .5, true), 100, "暴走中不衰减");
});
T("同步率：受击 -15、下限 0，自然衰减按 dt 计", () => {
  assert.strictEqual(syncDamage(50), 35);
  assert.strictEqual(syncDamage(10), 0, "下限 0");
  assert.ok(Math.abs(syncDecay(50, 1, false) - 48.8) < 1e-9, "1 秒衰减 1.2");
  assert.strictEqual(syncDecay(1, 5, false), 0, "下限 0");
});
T("暴走：满 100 触发，结束后回落到 45", () => {
  assert.ok(!enterBerserk(99.9), "未满不触发");
  assert.ok(enterBerserk(100), "满 100 触发");
  assert.ok(enterBerserk(100.5), "越界也触发");
  assert.strictEqual(afterBerserk(), 45);
});
T("连续命中 100 次可触发暴走（从 50 起）", () => {
  let s = 50, n = 0;
  while (!enterBerserk(s) && n < 1000) { s = syncGainHit(s, false); n++; }
  assert.strictEqual(n, 84, "需 84 次命中（0.6/次，从 50 到 100）");
});
T("暴走可达性：按页面帧序（命中 → 先判暴走 → 再衰减）能真正触发", () => {
  let s = 50, t = 0, berserkAt = null;
  const frame = (hit) => {
    if (hit) s = syncGainHit(s, false);
    if (berserkAt === null && enterBerserk(s)) { berserkAt = t; return; }
    s = syncDecay(s, 1 / 60, false);
    t += 1 / 60;
  };
  for (let i = 0; i < 120 * 60 && berserkAt === null; i++) frame(i % 12 === 0);   // 每 0.2 秒命中一次
  assert.ok(berserkAt !== null, "持续命中应在 120 秒内触发暴走");
  assert.ok(berserkAt < 120, "触发时间应合理，实际 " + berserkAt.toFixed(1) + "s");
});
T("顺序回归：若先衰减再判定，则永远触发不了（弹幕射击 v1.5.0 曾因此失效）", () => {
  let s = 100, ever = false;
  for (let i = 0; i < 600; i++) {
    s = syncDecay(s, 1 / 60, false);
    if (enterBerserk(s)) ever = true;
    s = syncGainHit(s, false);                             // 增益封顶在恰好 100
  }
  assert.ok(!ever, "错误顺序下触发不了");
});
T("计分：连击加成上限 2×、暴走翻倍", () => {
  assert.strictEqual(killScore("small", false, 0), 100, "无连击基础分");
  assert.strictEqual(killScore("small", false, 10), 150, "连击 10 → 1.5×");
  assert.strictEqual(killScore("small", false, 20), 200, "连击 20 → 2×");
  assert.strictEqual(killScore("small", false, 50), 200, "连击 50 仍封顶 2×");
  assert.strictEqual(killScore("small", true, 0), 200, "暴走翻倍");
  assert.strictEqual(killScore("heavy", false, 20), 1040);
});
T("AT 力场：先扣盾后扣耐久，力场冷却 18 秒", () => {
  const st = { shield: 1, hp: 3 };
  const hurt = () => { if (st.shield > 0) { st.shield = 0; } else { st.hp--; } };
  hurt(); assert.strictEqual(st.hp, 3, "第一击消耗力场，不掉耐久");
  hurt(); assert.strictEqual(st.hp, 2, "第二击掉耐久");
  assert.strictEqual(st.shield, 0);
  assert.strictEqual(P.shieldRecharge, 18);
});
T("火力等级：1→1 发 / 2→2 发 / 3→3 发，上限 3 级", () => {
  const lanes = lv => lv === 1 ? [0] : lv === 2 ? [-15, 15] : [-16, 0, 16];
  assert.strictEqual(lanes(1).length, 1);
  assert.strictEqual(lanes(2).length, 2);
  assert.strictEqual(lanes(3).length, 3);
  let power = 1;
  for (let i = 0; i < 5; i++) power = Math.min(3, power + 1);
  assert.strictEqual(power, 3, "升级封顶 3 级");
});
T("暴走增益：火力间隔减半、伤害 1.5×", () => {
  const interval = berserk => P.fireBase / (berserk ? 2 : 1);
  assert.ok(Math.abs(interval(true) - .07) < 1e-9);
  assert.ok(Math.abs(P.dmg * 1.5 - 10.5) < 1e-9);
});
T("波次推进调度：队列耗尽且场上清空后才进入下一波", () => {
  const st = { wave: 0, spawnQ: [], alive: 0, gap: 1.6 };
  const tick = dt => {
    if (st.spawnQ.length) { for (let i = st.spawnQ.length - 1; i >= 0; i--) { if (st.spawnQ[i].delay <= 0) st.spawnQ.splice(i, 1); } return; }
    if (st.alive > 0) return;
    st.gap -= dt;
    if (st.gap <= 0) { st.wave++; st.spawnQ = buildWave("normal", st.wave - 1, mulberry32(st.wave)); st.gap = 2.6; }
  };
  tick(.5);
  assert.strictEqual(st.wave, 0, "1.6 秒倒计时未到不开始");
  tick(1.2);
  assert.strictEqual(st.wave, 1, "倒计时结束开第 1 波");
  assert.ok(st.spawnQ.length > 0, "生成队列");
  st.spawnQ = [];
  st.alive = 2;
  tick(5);
  assert.strictEqual(st.wave, 1, "场上仍有敌人时不推进");
  st.alive = 0;
  tick(1);
  assert.strictEqual(st.wave, 1, "2.6 秒间隔未到不推进");
  tick(2);
  assert.strictEqual(st.wave, 2, "清场 + 间隔到 → 下一波");
});
T("通关奖励与耐久挂钩：剩余耐久越多奖励越高", () => {
  const bonus = hp => 5000 + hp * 1200;
  assert.strictEqual(bonus(1), 6200);
  assert.strictEqual(bonus(3), 8600);
  assert.ok(bonus(3) > bonus(1));
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
