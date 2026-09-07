# -*- coding: utf-8 -*-
"""重建 spider.html：头部模板 + 引入 + 标准规则脚本。"""
import io

head = io.open("_spider_head.html", encoding="utf-8").read()

MAIN = '''<script>
"use strict";
/* ============ 素材与常量（双姝扑克全套） ============ */
const RANK_NAME = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["红桃", "方块", "梅花", "黑桃"];
const FACES = [];
let BACK = null;
const IMG_BASE = "assets/spider/cards/";
const CARD_FILE = (s, r) => `${IMG_BASE}${SUITS[s]}${RANK_NAME[r]}.jpg`;

/* ============ 状态 ============ */
/* 标准蜘蛛规则：
   列 col = 视觉自上而下，col[0] 是列顶。
   可整体拖动的段 = 列顶开始的同花降序连续（K,Q,J,…；任意长度含单张）。
   放置：目标列为空；或目标列顶牌点数 = 段顶牌 + 1（花色不限）。
   同花 K→A 连续 13 张出现即自动收走（可在列中任意位置）。 */
let mode = "single";   // single: 単色红桃×8 / four: 整副×2 四花色
let stacks = [];
let reserve = [];
let sel = null;        // {col, len} 选中列顶段
let setsDone = 0, moves = 0;
let history = [];
let audioCtx = null;

const $ = id => document.getElementById(id);
const tableEl = $("table");

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/* ============ 音效 ============ */
function ensureAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function beep(f, d, t, g, delay) {
  if (!audioCtx) return;
  const s0 = audioCtx.currentTime + (delay || 0);
  const o = audioCtx.createOscillator(), v = audioCtx.createGain();
  o.type = t || "sine"; o.frequency.value = f;
  v.gain.setValueAtTime(g || .11, s0);
  v.gain.exponentialRampToValueAtTime(.0001, s0 + d);
  o.connect(v); v.connect(audioCtx.destination);
  o.start(s0); o.stop(s0 + d + .02);
}
const sndFlip = () => beep(700, .05, "triangle", .08);
const sndMove = () => beep(420, .06, "sine", .1);
const sndSet  = () => { beep(523, .1, "sine", .14); beep(784, .12, "sine", .14, .07); beep(1047, .14, "sine", .13, .15); };
const sndWin  = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .16, "sine", .14, i * .12));

/* ============ 发牌 ============ */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame(m) {
  if (m) mode = m;
  const deck = [];
  if (mode === "single") {
    for (let g = 0; g < 8; g++) for (let r = 1; r <= 13; r++) deck.push({ r, suit: 0 });
  } else {
    for (let d = 0; d < 2; d++) for (let s2 = 0; s2 < 4; s2++) for (let r = 1; r <= 13; r++) deck.push({ r, suit: s2 });
  }
  const sh = shuffled(deck);
  stacks = []; reserve = [];
  let k = 0;
  for (let c = 0; c < 10; c++) {
    const n = c < 4 ? 6 : 5;
    const col = [];
    for (let i = 0; i < n; i++) col.push({ ...sh[k++], up: i === 0 });
    stacks.push(col);
  }
  reserve = sh.slice(k);
  sel = null; setsDone = 0; moves = 0; history = [];
  $("overlay").classList.remove("show");
  render(); updateHUD();
  $("modeTag").textContent = mode === "single" ? "♥ 単色 · 红桃×8 组" : "♠ 4花色 · 整副×2 · 标准";
  document.querySelectorAll(".mbtn").forEach(b => b.classList.toggle("active", b.dataset.m === mode));
  statusLine();
  toast((mode === "single" ? "単色（红桃）新局" : "4 花色新局") + "：把同花 K→A 收齐");
}

/* ============ 规则 ============ */
function segLen(col) {
  if (!col.length || !col[0].up) return 0;
  let n = 1;
  while (n < col.length && col[n].up &&
         col[n].r === col[n - 1].r - 1 && col[n].suit === col[n - 1].suit) n++;
  return n;
}

function canPlace(srcC, dstC) {
  if (srcC === dstC) return false;
  const s = stacks[srcC];
  if (!s.length || !s[0].up) return false;
  const d = stacks[dstC];
  if (!d.length) return true;
  if (!d[0].up) return false;
  return d[0].r === s[0].r + 1;
}

function doMove(srcC, dstC) {
  snapshot();
  const n = segLen(stacks[srcC]);
  const seg = stacks[srcC].splice(0, n);
  stacks[dstC].unshift(...seg);
  moves++;
  const sc = stacks[srcC];
  if (sc.length && !sc[0].up) { sc[0].up = true; sndFlip(); }
  sndMove();
  render(); updateHUD();
  collectAll();
  statusLine();
  if (!reserve.length && allEmpty()) finish(true);
}

function collectAll() {
  let found = false;
  for (let ci = 0; ci < 10; ci++) {
    const col = stacks[ci];
    for (let j = 0; j + 13 <= col.length; j++) {
      let ok = true;
      for (let i = j + 1; i < j + 13; i++) {
        if (!col[i].up || col[i].r !== col[i - 1].r - 1 || col[i].suit !== col[j].suit) { ok = false; break; }
      }
      if (!ok) continue;
      col.splice(j, 13);
      setsDone++;
      found = true;
      sndSet();
      toast(`K→A 一套收齐 +100 · ${setsDone} / 8`);
      const box = tableEl.children[ci];
      if (box) box.classList.add("win-flash");
      break;
    }
  }
  if (found) { render(); updateHUD(); statusLine(); }
}

function dealRow() {
  ensureAudio();
  if (!reserve.length) return;
  snapshot();
  for (let c = 0; c < 10 && reserve.length; c++) stacks[c].unshift({ ...reserve.shift(), up: true });
  moves++;
  render(); updateHUD();
  collectAll();
  statusLine();
  toast("发牌：每列顶部 +1");
}

function allEmpty() { return stacks.every(c => c.length === 0); }

function statusLine() {
  const anyMove = findMove();
  let txt;
  if (setsDone >= 8) txt = "";
  else if (anyMove) txt = "同花降序段可整拖 · 目标列顶需比段顶大 1 · 同花 K→A 自动收套";
  else if (reserve.length) txt = "暂时没有可移动的组合 —— 点「🃏 发牌」或继续整理";
  else txt = "没有可移动的组合且发牌已用完 —— 这局无法继续，点「♻ 重开」";
  $("turnBar").innerHTML = txt;
  $("dealLeft").textContent = Math.ceil(reserve.length / 10);
}

function findMove() {
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++)
    if (canPlace(a, b)) return { a, b };
  return null;
}

/* ============ 渲染 ============ */
function render() {
  tableEl.innerHTML = "";
  const colH = Math.max(340, window.innerHeight - 250);
  stacks.forEach((col, ci) => {
    const box = document.createElement("div");
    box.className = "col" + (sel && sel.col === ci ? " selcol" : "");
    box.style.height = colH + "px";
    const tops2 = [];
    let y2 = 4;
    for (let i = 0; i < col.length; i++) {
      tops2[i] = y2;
      if (i < col.length - 1) y2 += (col[i + 1].up ? 24 : 8);
    }
    for (let i = 0; i < col.length; i++) {
      const c = col[i];
      const card = document.createElement("div");
      card.className = "slot-card";
      card.style.top = tops2[i] + "px";
      card.style.zIndex = i;
      if (!c.up) {
        card.classList.add("face-down");
        const img = document.createElement("img");
        img.src = IMG_BASE + "back_blue.jpg";
        card.appendChild(img);
      } else {
        const img = document.createElement("img");
        img.src = FACES[c.suit][c.r].src;
        img.draggable = false;
        card.appendChild(img);
        if (sel && sel.col === ci && i < sel.len) card.classList.add("sel");
      }
      card.dataset.ci = ci;
      card.dataset.i = i;
      card.addEventListener("click", () => onClick(ci, i));
      if (i === 0 && c.up) {
        card.draggable = true;
        card.addEventListener("dragstart", e => onDragStart(e, ci));
        card.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          if (sel && sel.col === ci) sel = null;
          render();
        });
      }
      box.appendChild(card);
    }
    if (!col.length) {
      const slot = document.createElement("div");
      slot.className = "slot-card";
      slot.style.top = "4px";
      slot.style.height = "70px";
      slot.dataset.ci = ci;
      slot.addEventListener("click", () => onClick(ci, -1));
      box.appendChild(slot);
    }
    box.addEventListener("dragover", e => {
      if (sel && canPlace(sel.col, ci)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; box.classList.add("drop-ok"); }
    });
    box.addEventListener("dragleave", () => box.classList.remove("drop-ok"));
    box.addEventListener("drop", e => {
      e.preventDefault();
      box.classList.remove("drop-ok");
      if (!sel) return;
      const sc = sel.col;
      if (canPlace(sc, ci)) doMove(sc, ci);
      sel = null;
    });
    tableEl.appendChild(box);
  });
  $("dealBtn").disabled = reserve.length === 0;
}

/* ============ 交互 ============ */
function onClick(ci, i) {
  ensureAudio();
  const col = stacks[ci];
  if (sel) {
    if (sel.col === ci) { sel = null; render(); return; }
    if (canPlace(sel.col, ci)) {
      const sc = sel.col;
      sel = null;
      doMove(sc, ci);
      return;
    }
    sel = null;
  }
  if (col.length && !col[0].up && i === 0) {
    col[0].up = true;
    sndFlip();
    snapshot();
    render(); statusLine();
    return;
  }
  if (col.length && col[0].up && segLen(col) >= 1) {
    sel = { col: ci, len: segLen(col) };
    render();
  }
}

function onDragStart(e, ci) {
  const col = stacks[ci];
  if (!col.length || !col[0].up) { e.preventDefault(); return; }
  const len = segLen(col);
  if (!len) { e.preventDefault(); return; }
  sel = { col: ci, len };
  e.dataTransfer.setData("text/plain", String(ci));
  e.dataTransfer.effectAllowed = "move";
  const img = e.currentTarget.querySelector("img");
  if (img) e.dataTransfer.setDragImage(img, 40, 60);
  e.currentTarget.classList.add("dragging");
}

/* ============ HUD / 撤销 / 提示 ============ */
function updateHUD() {
  $("setsDone").textContent = setsDone + " / 8";
  $("moves").textContent = moves;
  $("undoBtn").disabled = history.length === 0;
}
function snapshot() {
  history.push(JSON.stringify({ stacks, reserve, setsDone, moves }));
  if (history.length > 300) history.shift();
}
function undo() {
  if (!history.length) return;
  const h = JSON.parse(history.pop());
  stacks = h.stacks; reserve = h.reserve; setsDone = h.setsDone; moves = h.moves;
  sel = null;
  render(); updateHUD(); statusLine();
  toast("已撤销");
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 2400);
}
function finish(win) {
  ensureAudio();
  if (win) sndWin();
  const h2 = $("endTitle");
  h2.className = win ? "win" : "lose";
  h2.textContent = win ? "胜 利 ！" : "这局无解……";
  $("endStats").innerHTML = `${setsDone} 套收齐 · 步数 <b>${moves}</b>`;
  $("endNote").textContent = win ? "蜘蛛网被你拆了个干净！" : "发牌用完也没有可移动的组合，重开一局吧。";
  $("overlay").classList.add("show");
}

/* ============ 事件 ============ */
document.querySelectorAll(".mbtn").forEach(b => b.addEventListener("click", () => { ensureAudio(); newGame(b.dataset.m); }));
$("undoBtn").addEventListener("click", undo);
$("dealBtn").addEventListener("click", dealRow);
$("newBtn").addEventListener("click", () => { ensureAudio(); newGame(); toast("新的一局"); });
$("hintBtn").addEventListener("click", () => {
  ensureAudio();
  const mv = findMove();
  if (!mv) {
    toast(reserve.length ? "无可用移动 —— 建议先「🃏 发牌」" : "已无解，建议重开一局");
    return;
  }
  sel = { col: mv.a, len: segLen(stacks[mv.a]) };
  render();
  tableEl.children[mv.a].classList.add("drop-ok");
  tableEl.children[mv.b].classList.add("drop-ok");
  setTimeout(() => {
    tableEl.children[mv.a].classList.remove("drop-ok");
    tableEl.children[mv.b].classList.remove("drop-ok");
  }, 2200);
  toast(`可把「${RANK_NAME[stacks[mv.a][0].r]}」开头的同花段放到右侧高亮列`);
});
$("modeBtn").addEventListener("click", () => { location.href = "index.html"; });
$("againBtn").addEventListener("click", () => { ensureAudio(); newGame(); });
$("modeBtn2").addEventListener("click", () => { location.href = "index.html"; });
window.addEventListener("resize", render);
document.addEventListener("pointerdown", ensureAudio, { once: true });

/* ============ 启动 ============ */
(async function boot() {
  const jobs = [];
  for (let s2 = 0; s2 < 4; s2++) {
    FACES[s2] = [];
    for (let r = 1; r <= 13; r++) {
      FACES[s2][r] = null;
      jobs.push(loadImg(CARD_FILE(s2, r)).then(im => { FACES[s2][r] = im; }));
    }
  }
  BACK = await loadImg(IMG_BASE + "back_blue.jpg").catch(() => null);
  await Promise.all(jobs);
  newGame();
})();
</script>
</body>
</html>'''

includes = '''<script>document.write('<script src="wallpapers/manifest.js?v=' + Date.now() + '"><\\/script>');</script>
<script src="background.js"></script>
<script src="deco.js"></script>

'''

full = head + includes + MAIN
io.open("spider.html", "w", encoding="utf-8", newline="\n").write(full)
print("spider.html rebuilt,", full.count("\n"), "lines")
