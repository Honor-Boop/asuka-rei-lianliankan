// EVA 突击（横版平台跳跃）规则回归测试（与 platform.html 内联脚本逻辑一致）
// 与页面逻辑逐字一致；LEVELS 地图直接从页面提取（避免两处维护漂移）
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const PAGE = fs.readFileSync(path.join(__dirname, "platform.html"), "utf8");

/* ---- 从页面提取 LEVELS（LEVELS-BEGIN .. LEVELS-END 之间的 JS 数组） ---- */
function extractLevels() {
  const a = PAGE.indexOf("/* LEVELS-BEGIN");
  const b = PAGE.indexOf("LEVELS-END */");
  if (a < 0 || b < 0) throw new Error("页面缺少 LEVELS 标记");
  const block = PAGE.slice(PAGE.indexOf("[", a), PAGE.lastIndexOf("]", b) + 1);
  return eval(block);                                     // 受控来源：本仓库自己的页面文件
}
const LEVELS = extractLevels();

/* ================= 配置镜像（与页面逐字一致） ================= */
const W = 960, H = 528, TILE = 48, VROWS = 11;
const TE = 0, TS = 1, TO = 2, TG = 3;
const CHARS = {
  rei:   { key: "rei",   name: "绫波",   run: 320, jump: 880, suit: "#5a7fd4", suitLight: "#8fb4f0", suitDark: "#33507e", hair: "#c8d8ff", hairDark: "#9fb8e8", number: "00" },
  asuka: { key: "asuka", name: "明日香", run: 360, jump: 830, suit: "#e8552c", suitLight: "#f08050", suitDark: "#a03418", hair: "#d98a4a", hairDark: "#a8622e", number: "02" },
};
const DIFFS = {
  easy:   { key: "easy",   name: "見習い",   lives: 3, espMul: .85, time: 240 },
  normal: { key: "normal", name: "正規隊員", lives: 3, espMul: 1,   time: 200 },
  hard:   { key: "hard",   name: "使徒級",   lives: 2, espMul: 1.3, time: 160 },
};
const PHYS = {
  gravity: 2300, holdGravity: 1600, maxFall: 1200,
  accel: 2600, friction: 2200, airAccel: 2200,
  coyote: .08, buffer: .1, stompBounce: 560, hurtInvuln: 1.5,
  knockX: 260, knockY: 330,
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function parseLevel(rows) {
  if (!rows || !rows.length) throw new Error("空关卡");
  const cols = rows[0].length;
  if (cols < 8) throw new Error("关卡太窄");
  const grid = new Uint8Array(rows.length * cols);
  const out = { cols, rows: rows.length, grid, player: null, goal: null, batteries: [], walkers: [], flyers: [] };
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    if (line.length !== cols) throw new Error("第 " + r + " 行宽度不一致");
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (ch === "." || ch === " ") { grid[r * cols + c] = TE; continue; }
      if (ch === "#") { grid[r * cols + c] = TS; continue; }
      if (ch === "-") { grid[r * cols + c] = TO; continue; }
      if (ch === "^") { grid[r * cols + c] = TG; continue; }
      if (ch === "P") { if (out.player) throw new Error("多个出生点"); out.player = { c, r }; continue; }
      if (ch === "G") { out.goal = { c, r }; continue; }
      if (ch === "o") { out.batteries.push({ c, r }); continue; }
      if (ch === "E") { out.walkers.push({ c, r }); continue; }
      if (ch === "F") { out.flyers.push({ c, r }); continue; }
      throw new Error("非法字符: " + ch);
    }
  }
  if (!out.player) throw new Error("缺少出生点 P");
  if (!out.goal) throw new Error("缺少终点 G");
  return out;
}
function tileAt(grid, cols, rows, c, r) {
  if (c < 0 || c >= cols) return TS;
  if (r < 0 || r >= rows) return TE;
  return grid[r * cols + c];
}
function solidAt(grid, cols, rows, c, r) { return tileAt(grid, cols, rows, c, r) === TS; }
function touchesCode(box, code, grid, cols, rows) {
  const c0 = Math.floor(box.x / TILE), c1 = Math.floor((box.x + box.w - .001) / TILE);
  const r0 = Math.floor(box.y / TILE), r1 = Math.floor((box.y + box.h - .001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
    if (tileAt(grid, cols, rows, c, r) === code) return true;
  return false;
}
function resolveMove(box, dx, dy, grid, cols, rows) {
  const out = { x: box.x, y: box.y, hitWall: false, hitFloor: false, hitCeil: false };
  out.x += dx;
  let c0 = Math.floor(out.x / TILE), c1 = Math.floor((out.x + box.w - .001) / TILE);
  let r0 = Math.floor(box.y / TILE), r1 = Math.floor((box.y + box.h - .001) / TILE);
  if (dx > 0) {
    for (let r = r0; r <= r1 && !out.hitWall; r++)
      for (let c = c1; c >= c0 && !out.hitWall; c--)
        if (solidAt(grid, cols, rows, c, r)) { out.x = c * TILE - box.w - .001; out.hitWall = true; }
  } else if (dx < 0) {
    for (let r = r0; r <= r1 && !out.hitWall; r++)
      for (let c = c0; c <= c1 && !out.hitWall; c++)
        if (solidAt(grid, cols, rows, c, r)) { out.x = (c + 1) * TILE + .001; out.hitWall = true; }
  }
  const prevBottom = box.y + box.h;
  out.y += dy;
  c0 = Math.floor(out.x / TILE); c1 = Math.floor((out.x + box.w - .001) / TILE);
  r0 = Math.floor(out.y / TILE); r1 = Math.floor((out.y + box.h - .001) / TILE);
  if (dy > 0) {
    for (let r = r1; r >= r0 && !out.hitFloor; r--)
      for (let c = c0; c <= c1 && !out.hitFloor; c++) {
        const t = tileAt(grid, cols, rows, c, r), top = r * TILE;
        if (t === TS || (t === TO && prevBottom <= top + 1)) { out.y = top - box.h - .001; out.hitFloor = true; }
      }
  } else if (dy < 0) {
    for (let r = r0; r <= r1 && !out.hitCeil; r++)
      for (let c = c0; c <= c1 && !out.hitCeil; c++)
        if (solidAt(grid, cols, rows, c, r)) { out.y = (r + 1) * TILE + .001; out.hitCeil = true; }
  }
  return out;
}
function applyGravity(vy, holding, dt) {
  const g = (vy < 0 && holding) ? PHYS.holdGravity : PHYS.gravity;
  return Math.min(vy + g * dt, PHYS.maxFall);
}
function jumpUpdate(st, onGround, wantJump, dt) {
  st.coyote = onGround ? PHYS.coyote : Math.max(0, st.coyote - dt);
  st.buffer = wantJump ? PHYS.buffer : Math.max(0, st.buffer - dt);
  const can = st.buffer > 0 && (onGround || st.coyote > 0);
  if (can) { st.buffer = 0; st.coyote = 0; }
  return can;
}
function isStomp(prevBottom, vy, enemyTop) { return vy > 0 && prevBottom <= enemyTop + 10; }
function walkerStep(w, dt, grid, cols, rows, speed) {
  const frontX = w.dir > 0 ? w.x + w.w / 2 + 2 : w.x - w.w / 2 - 2;
  const fc = Math.floor(frontX / TILE);
  const bodyR = Math.floor((w.y + w.h / 2) / TILE);
  const belowR = Math.floor((w.y + w.h + 4) / TILE);
  if (solidAt(grid, cols, rows, fc, bodyR) || !solidAt(grid, cols, rows, fc, belowR)) {
    return { ...w, dir: -w.dir };
  }
  return { ...w, x: w.x + w.dir * speed * dt };
}
function flyerPos(x0, y0, t, phase) {
  return { x: x0 + Math.sin(t * .9 + phase) * FLYER.ampX, y: y0 + Math.sin(t * 1.8 + phase) * FLYER.ampY };
}
const FLYER = { w: 40, h: 26, ampX: 70, ampY: 24 };
function cameraTargetX(px, vx, levelPxW) {
  return clamp(px - W / 2 + clamp(vx * .3, -100, 100), 0, Math.max(0, levelPxW - W));
}
function cameraFollow(cam, target, dt) {
  if (Math.abs(target - cam) > 400) return target;
  return cam + (target - cam) * Math.min(1, dt * 10);
}
function levelBonus(timeLeft) { return CLEAR_BASE + Math.max(0, Math.round(timeLeft)) * TIME_BONUS; }
function stompScore(chain) { return STOMP_BASE + (chain - 1) * 50; }
function jumpHeight(v0, hold) {
  const g = hold ? PHYS.holdGravity : PHYS.gravity;
  return v0 * v0 / (2 * g);
}
function normalizeMap(rows) { return rows.map(s => s.replace(/ /g, ".").padEnd(rows.reduce((m, x) => Math.max(m, x.length), 0), ".")); }

/* 玩家尺寸（镜像页面常量） */
const PLAYER_W = 30, PLAYER_H = 44;
const WALKER = { w: 36, h: 32, speed: 90 };
const BATTERY_SCORE = 50, STOMP_BASE = 100, CLEAR_BASE = 1000, TIME_BONUS = 5;

/* 站立判定：格子为空且下方为可站表面（实心或单向平台） */
function standable(grid, cols, rows, c, r) {
  if (tileAt(grid, cols, rows, c, r) !== TE) return false;
  const below = tileAt(grid, cols, rows, c, r + 1);
  return below === TS || below === TO;
}
/* 保守可达性 BFS：从出生点出发，用“行走/跳跃(升≤3格、横跨≤5格)/下落”三种移动，
   判断终点旗是否可达。过近似（不查跳跃路径穿墙），作为静态下界守护。 */
function reachableG(m) {
  const { grid, cols, rows } = m;
  const key = (c, r) => r * cols + c;
  const start = standable(grid, cols, rows, m.player.c, m.player.r) ? { c: m.player.c, r: m.player.r }
    : (standable(grid, cols, rows, m.player.c, m.player.r + 1) ? { c: m.player.c, r: m.player.r + 1 } : null);
  if (!start) return false;
  const seen = new Set([key(start.c, start.r)]);
  const q = [start];
  const goalZone = new Set();
  for (let dr = -2; dr <= 0; dr++) goalZone.add(key(m.goal.c, m.goal.r + dr));
  while (q.length) {
    const { c, r } = q.shift();
    if (goalZone.has(key(c, r))) return true;
    const moves = [];
    for (const dc of [-1, 1]) if (standable(grid, cols, rows, c + dc, r)) moves.push({ c: c + dc, r });
    // 跳跃：横跨 1..6 格，落点比起点高 0..3 格或低 0..3 格（全按住跳跃射程 ≈6.7 格）
    for (let k = 1; k <= 6; k++) {
      for (let up = 0; up <= 3; up++) for (const dc of [-k, k])
        if (standable(grid, cols, rows, c + dc, r - up)) moves.push({ c: c + dc, r: r - up });
      for (let dn = 1; dn <= 3; dn++) for (const dc of [-k, k])
        if (standable(grid, cols, rows, c + dc, r + dn)) moves.push({ c: c + dc, r: r + dn });
    }
    // 下落：走出边缘，落到下方第一个可站位置
    for (const dc of [-1, 1]) {
      for (let rr = r; rr < rows; rr++) {
        if (standable(grid, cols, rows, c + dc, rr)) { moves.push({ c: c + dc, r: rr }); break; }
        if (tileAt(grid, cols, rows, c + dc, rr) === TS) break;
      }
    }
    for (const mv of moves) {
      const k = key(mv.c, mv.r);
      if (!seen.has(k)) { seen.add(k); q.push(mv); }
    }
  }
  return false;
}

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("✗ " + name + " :: " + e.message); }
}
const G23 = (cols) => new Uint8Array(cols * 3);          // 3 行空网格

/* ---------- 地图解析 ---------- */
T("parseLevel：合法地图 → 网格与实体正确", () => {
  const m = parseLevel([
    "............",
    "....o.......",
    "..P...E..F.G",
    "############",
  ]);
  assert.strictEqual(m.cols, 12);
  assert.deepStrictEqual(m.player, { c: 2, r: 2 });
  assert.deepStrictEqual(m.goal, { c: 11, r: 2 });
  assert.strictEqual(m.batteries.length, 1);
  assert.strictEqual(m.walkers.length, 1);
  assert.strictEqual(m.flyers.length, 1);
  assert.strictEqual(m.grid[1 * 12 + 4], TE, "o 是实体不是瓦片");
  assert.strictEqual(m.grid[3 * 12 + 0], TS);
});
T("parseLevel：行宽不一致抛错", () => {
  assert.throws(() => parseLevel(["............", "..P....G"]), /宽度不一致/);
});
T("parseLevel：非法字符抛错", () => {
  assert.throws(() => parseLevel(["............", "..P..X...G.."]), /非法字符/);
});
T("parseLevel：缺 P / 双 P / 缺 G 都抛错", () => {
  assert.throws(() => parseLevel(["............", ".....E...G.."]), /缺少出生点/);
  assert.throws(() => parseLevel(["............", "..P..P...G.."]), /多个出生点/);
  assert.throws(() => parseLevel(["............", "..P......E.."]), /缺少终点/);
});
T("tileAt：左右越界=实心墙，上下越界=开放", () => {
  const grid = G23(4);
  assert.strictEqual(tileAt(grid, 4, 3, -1, 1), TS, "左越界");
  assert.strictEqual(tileAt(grid, 4, 3, 4, 1), TS, "右越界");
  assert.strictEqual(tileAt(grid, 4, 3, 2, -1), TE, "上越界");
  assert.strictEqual(tileAt(grid, 4, 3, 2, 3), TE, "下越界（坑）");
});
T("normalizeMap：空格转点、右侧补齐", () => {
  const n = normalizeMap(["..P  ", "..G..", "#####"]);
  assert.strictEqual(n[0], "..P..");
  assert.strictEqual(n[1], "..G..");
  assert.strictEqual(n[2], "#####");
});

/* ---------- 碰撞解析 ---------- */
T("resolveMove：下落到实心地面 → 贴地并 hitFloor", () => {
  const grid = G23(6);
  grid[2 * 6 + 2] = TS; grid[2 * 6 + 3] = TS;            // r2 有地面
  const box = { x: 110, y: 60, w: 30, h: 44 };            // 底边接近 r2 上沿
  const r = resolveMove(box, 0, 20, grid, 6, 3);
  assert.ok(r.hitFloor, "应落地");
  assert.ok(Math.abs(r.y - (2 * TILE - 44 - .001)) < 1e-6, "y 应贴到地面顶端，实际 " + r.y);
});
T("resolveMove：向上顶头 → hitCeil 并回落", () => {
  const grid = G23(6);
  grid[0 * 6 + 2] = TS; grid[0 * 6 + 3] = TS;
  const box = { x: 110, y: TILE * 2, w: 30, h: 44 };
  const r = resolveMove(box, 0, -100, grid, 6, 3);
  assert.ok(r.hitCeil, "应顶头");
  assert.ok(Math.abs(r.y - (TILE + .001)) < 1e-6, "y 应钳在砖块下方");
});
T("resolveMove：左右撞墙双向阻挡", () => {
  const grid = G23(6);
  for (let r = 0; r < 3; r++) grid[r * 6 + 3] = TS;      // c3 竖墙
  const box = { x: 100, y: 10, w: 30, h: 44 };
  const right = resolveMove(box, 60, 0, grid, 6, 3);
  assert.ok(right.hitWall && Math.abs(right.x - (3 * TILE - 30 - .001)) < 1e-6, "向右被挡");
  const box2 = { x: 200, y: 10, w: 30, h: 44 };
  const left = resolveMove(box2, -60, 0, grid, 6, 3);
  assert.ok(left.hitWall && Math.abs(left.x - (4 * TILE + .001)) < 1e-6, "向左被挡");
});
T("单向平台：从下方上升可穿过（不 hitCeil）", () => {
  const grid = G23(6);
  grid[1 * 6 + 2] = TO; grid[1 * 6 + 3] = TO;
  const box = { x: 110, y: 110, w: 30, h: 44 };
  const r = resolveMove(box, 0, -60, grid, 6, 3);
  assert.ok(!r.hitCeil, "上升穿过单向平台不应被挡");
});
T("单向平台：从上方下落会站立；已在平台下方时下落不吸附", () => {
  const grid = G23(6);
  grid[1 * 6 + 2] = TO; grid[1 * 6 + 3] = TO;
  const top = TILE;                                       // 平台顶 = 48
  const above = { x: 110, y: top - 50, w: 30, h: 44 };    // 底边 -6（在平台上方）
  const land = resolveMove(above, 0, 60, grid, 6, 3);
  assert.ok(land.hitFloor && Math.abs(land.y - (top - 44 - .001)) < 1e-6, "应站在平台上");
  const below = { x: 110, y: top + 20, w: 30, h: 44 };    // 底边已低于平台顶
  const pass2 = resolveMove(below, 0, 40, grid, 6, 3);
  assert.ok(!pass2.hitFloor, "已在平台下方不应吸附");
});
T("尖刺瓦片不是实心：不阻挡位移，但可被 touchesCode 检出", () => {
  const grid = G23(6);
  grid[2 * 6 + 3] = TG;
  const box = { x: 3 * TILE + 10, y: TILE, w: 30, h: 44 };
  const r = resolveMove(box, 0, 100, grid, 6, 3);
  assert.ok(!r.hitFloor, "尖刺不挡路");
  assert.ok(touchesCode({ x: 3 * TILE + 10, y: 2 * TILE - 20, w: 30, h: 44 }, TG, grid, 6, 3), "应检出尖刺");
});

/* ---------- 物理 ---------- */
T("applyGravity：上升按住=弱重力，否则强重力；有终端速度", () => {
  assert.ok(Math.abs(applyGravity(-880, true, 1) - (-880 + 1600)) < 1e-9, "上升按住 1600");
  assert.ok(Math.abs(applyGravity(-880, false, .1) - (-880 + 230)) < 1e-9, "否则 2300（短步长不受终端速度影响）");
  assert.ok(Math.abs(applyGravity(500, false, 1) - PHYS.maxFall) < 1e-9, "终端速度 1200");
  assert.ok(applyGravity(100, true, 1) > 100, "下落中按住不影响（仅上升段）");
});
T("跳跃状态机：地面起跳消耗 buffer；空中按跳进 buffer 落地即跳", () => {
  const st = { coyote: 0, buffer: 0 };
  assert.ok(jumpUpdate(st, true, true, .016), "地面可起跳");
  const st2 = { coyote: 0, buffer: 0 };
  assert.ok(!jumpUpdate(st2, false, true, .016), "空中按跳不立即起跳");
  assert.ok(st2.buffer > 0, "但进入缓冲");
  assert.ok(jumpUpdate(st2, true, false, .016), "落地瞬间自动起跳");
});
T("土狼时间：离开地面 0.08s 内仍可起跳，超时不行", () => {
  const st = { coyote: 0, buffer: 0 };
  jumpUpdate(st, true, false, .016);                      // 站地刷新 coyote
  jumpUpdate(st, false, false, .01);                      // 离地（不按跳），仅倒计时
  assert.ok(st.coyote > 0, "coyote 倒计时中");
  assert.ok(jumpUpdate({ coyote: st.coyote, buffer: 0 }, false, true, .001), "土狼时间内按跳仍可起跳");
  const st2 = { coyote: 0, buffer: 0 };
  jumpUpdate(st2, true, false, .016);
  for (let i = 0; i < 10; i++) jumpUpdate(st2, false, false, .01);   // 0.1s 过去
  assert.strictEqual(st2.coyote, 0, "土狼时间已耗尽");
  assert.ok(!jumpUpdate(st2, false, true, .016), "不可起跳");
});
T("跳高理论值：绫波轻点 ≈168px / 长按 ≈242px，明日香更矮", () => {
  assert.ok(Math.abs(jumpHeight(880, false) - 168.3) < 1, "轻点 " + jumpHeight(880, false).toFixed(1));
  assert.ok(Math.abs(jumpHeight(880, true) - 242) < 1, "长按 " + jumpHeight(880, true).toFixed(1));
  assert.ok(jumpHeight(830, true) < jumpHeight(880, true), "明日香跳得矮");
  assert.ok(jumpHeight(830, true) / TILE > 4.2, "长按跳高 ≥ 4.2 格");
});
T("固定步长积分模拟：全按住跳跃的实际高度与理论一致", () => {
  let y = 0, vy = -CHARS.rei.jump;
  for (let i = 0; i < 2400 && vy <= 0; i++) {
    vy = applyGravity(vy, true, 1 / 240);
    y += vy / 240;
  }
  assert.ok(Math.abs(-y - jumpHeight(CHARS.rei.jump, true)) < 3, "积分高度应等于理论值（差 <3px），实际 " + (-y).toFixed(1));
});

/* ---------- 敌人 ---------- */
T("踩头判定：下落中且前一帧底边在使徒顶边之上 → true；上升或侧碰 → false", () => {
  assert.ok(isStomp(100, 400, 105), "下落且底边略高于顶边");
  assert.ok(isStomp(96, 200, 100), "容差 10px 内");
  assert.ok(!isStomp(120, 400, 100), "底边深入过多（侧碰）");
  assert.ok(!isStomp(100, -300, 105), "上升中不算踩");
});
T("巡逻使徒：前方有墙折返 / 悬崖折返 / 平地前进", () => {
  const grid = new Uint8Array(8 * 3);
  for (let c = 1; c < 6; c++) grid[2 * 8 + c] = TS;      // 地面 c1..c5
  grid[1 * 8 + 5] = TS;                                   // c5 处的墙
  const w = { x: 2.5 * TILE, y: 2 * TILE - 32, w: 36, h: 32, dir: 1 };
  const w1 = walkerStep(w, .016, grid, 8, 3, 90);
  assert.ok(w1.dir === 1 && w1.x > w.x, "平地前进");
  const wNearWall = { ...w, x: 4.7 * TILE };
  const w2 = walkerStep(wNearWall, .016, grid, 8, 3, 90);
  assert.strictEqual(w2.dir, -1, "前方是墙 → 折返");
  const wNearEdge = { x: 1.4 * TILE, y: 2 * TILE - 32, w: 36, h: 32, dir: -1 };
  const w3 = walkerStep(wNearEdge, .016, grid, 8, 3, 90);
  assert.strictEqual(w3.dir, 1, "前方是悬崖 → 折返");
});
T("飞行使徒轨道：有界正弦，参数化可复现", () => {
  const a = flyerPos(500, 300, 0, 0), b = flyerPos(500, 300, 0, 0);
  assert.deepStrictEqual(a, b, "同参数同结果");
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let t = 0; t < 60; t += .05) {
    const p = flyerPos(500, 300, t, 1.3);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  assert.ok(maxX - minX <= 2 * FLYER.ampX + 1, "横向振幅不超界");
  assert.ok(maxY - minY <= 2 * FLYER.ampY + 1, "纵向振幅不超界");
});

/* ---------- 摄像机 / 计分 / 难度 ---------- */
T("摄像机：目标随速度前瞻（转向平滑过渡），两端钳制", () => {
  const levelPx = 64 * TILE;
  assert.strictEqual(cameraTargetX(100, 0, levelPx), 0, "左端钳制");
  assert.strictEqual(cameraTargetX(64 * TILE, 0, levelPx), levelPx - W, "右端钳制");
  const fwd = cameraTargetX(2000, 320, levelPx), back = cameraTargetX(2000, -320, levelPx);
  assert.ok(Math.abs((fwd - back) - 192) < 1e-9, "速度前瞻差 192px（±96 = 320×0.3）");
  assert.ok(Math.abs(cameraTargetX(2000, 9999, levelPx) - cameraTargetX(2000, 340, levelPx)) < 1e-9, "前瞻封顶 ±100");
});
T("摄像机跟随：指数平滑收敛；换关大跳变直接吸附", () => {
  let cam = 0;
  cam = cameraFollow(cam, 200, 1 / 60);
  assert.ok(cam > 0 && cam < 200, "向目标平滑推进，实际 " + cam.toFixed(1));
  for (let i = 0; i < 600; i++) cam = cameraFollow(cam, 200, 1 / 60);
  assert.ok(Math.abs(cam - 200) < 1, "收敛到目标，实际 " + cam.toFixed(2));
  assert.strictEqual(cameraFollow(0, 3000, 1 / 60), 3000, "大跳变（>400）直接吸附");
  // 关键手感守护：转向不再产生镜头瞬移——前瞻由速度连续驱动
  const t1 = cameraTargetX(2000, 320, 64 * TILE), t2 = cameraTargetX(2000, 0, 64 * TILE), t3 = cameraTargetX(2000, -320, 64 * TILE);
  assert.ok(t1 - t2 === 96 && t2 - t3 === 96, "转向时镜头目标连续变化（无瞬移）");
});
T("过关奖励 = 1000 + 剩余秒 ×5；踩怪连击 = 100 + (n-1)×50", () => {
  assert.strictEqual(levelBonus(0), CLEAR_BASE);
  assert.strictEqual(levelBonus(30), 1150);
  assert.strictEqual(levelBonus(-5), CLEAR_BASE, "负数不出负奖励");
  assert.strictEqual(stompScore(1), STOMP_BASE);
  assert.strictEqual(stompScore(3), 200);
});
T("难度与角色配置：生命/限时/使徒速度缩放/双主角差异", () => {
  assert.strictEqual(DIFFS.easy.lives, 3); assert.strictEqual(DIFFS.normal.lives, 3); assert.strictEqual(DIFFS.hard.lives, 2);
  assert.ok(DIFFS.easy.time > DIFFS.normal.time && DIFFS.normal.time > DIFFS.hard.time, "限时递减");
  assert.ok(DIFFS.hard.espMul > DIFFS.normal.espMul && DIFFS.normal.espMul >= DIFFS.easy.espMul, "使徒加速");
  assert.ok(CHARS.rei.jump > CHARS.asuka.jump, "绫波跳更高");
  assert.ok(CHARS.asuka.run > CHARS.rei.run, "明日香跑更快");
});

/* ---------- 真实关卡 ---------- */
T("6 张真实关卡全部可解析且结构健康", () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const m = parseLevel(normalizeMap(LEVELS[i]));
    assert.ok(m.batteries.length >= 2, "第 " + (i + 1) + " 关电池 ≥2");
    assert.ok(m.walkers.length + m.flyers.length >= 2, "第 " + (i + 1) + " 关使徒 ≥2");
    assert.ok(m.goal.c > m.cols * .8, "终点应靠近右端（第 " + (i + 1) + " 关）");
    assert.strictEqual(m.rows, 11, "11 行高");
  }
  assert.strictEqual(LEVELS.length, 6, "共 6 关");
});
T("出生点安全：P 下方有地面、周围无尖刺", () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const m = parseLevel(normalizeMap(LEVELS[i]));
    assert.ok(standable(m.grid, m.cols, m.rows, m.player.c, m.player.r) ||
              standable(m.grid, m.cols, m.rows, m.player.c, m.player.r + 1), "第 " + (i + 1) + " 关 P 应站在地面上");
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = m.player.c + dc, r = m.player.r + dr;
      assert.ok(tileAt(m.grid, m.cols, m.rows, c, r) !== TG, "第 " + (i + 1) + " 关出生点旁不应有尖刺");
    }
  }
});
T("静态可达性：6 关的终点旗都能从出生点到达（保守 BFS）", () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const m = parseLevel(normalizeMap(LEVELS[i]));
    assert.ok(reachableG(m), "第 " + (i + 1) + " 关终点不可达！");
  }
});
T("地图宽度递增或持平（难度曲线）", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i][0].length >= LEVELS[i - 1][0].length, "第 " + (i + 1) + " 关不应更短");
  }
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
