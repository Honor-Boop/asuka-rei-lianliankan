/* EVA 主题侧边装饰栏（宽屏显示，窄屏自动隐藏）。
   页面引入：<script src="deco.js"></script>
   可在 <body> 上用 data-deco-min="1600" 调整显示的最小视口宽度（默认 1300）。
   游戏页可通过 window.__decoSyncRate(数值, 是否暴走) 驱动同步率面板。 */
(function () {
  "use strict";
  const MIN_W = Number(document.body.dataset.decoMin || 1300);

  const style = document.createElement("style");
  style.textContent = `
    .deco-rail{position:fixed;top:0;bottom:0;width:252px;z-index:0;pointer-events:none;
      display:none;flex-direction:column;justify-content:space-between;align-items:center;
      padding:16px 12px;font-family:Consolas,'Courier New',monospace;color:#b9b0d6;opacity:1}
    body.deco-on .deco-rail{display:flex}
    .deco-rail.left{left:0;border-right:1px dashed rgba(255,255,255,.07)}
    .deco-rail.right{right:0;border-left:1px dashed rgba(255,255,255,.07)}
    .deco-rail::after{content:"";position:absolute;inset:0;pointer-events:none;
      background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 1px,transparent 1px 4px)}
    .deco-item{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;position:relative;z-index:1}
    .vtext{display:flex;gap:12px;writing-mode:vertical-rl;font-family:"Microsoft YaHei",sans-serif;
      font-size:13px;letter-spacing:8px;color:rgba(255,255,255,.5);padding:6px 0}
    .vtext b{color:rgba(255,255,255,.75);font-weight:600}
    .stripe{width:180px;height:12px;border-radius:3px;opacity:.7;
      background:repeating-linear-gradient(-45deg,#f5c518 0 9px,#191423 9px 18px)}
    .chip{font-size:11px;letter-spacing:1px;padding:6px 12px;border:1px solid rgba(88,255,163,.4);
      border-radius:6px;color:#58ffa3;display:flex;gap:6px;align-items:center;background:rgba(88,255,163,.05)}
    .chip .dot{width:6px;height:6px;border-radius:50%;background:#58ffa3;animation:blink 1.6s steps(2) infinite}
    @keyframes blink{50%{opacity:.15}}
    .tiny{font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.5)}
    .barcode{width:160px;height:20px;opacity:.65;
      background:repeating-linear-gradient(90deg,#cfc8e8 0 2px,transparent 2px 5px,#cfc8e8 5px 6px,transparent 6px 11px,#cfc8e8 11px 14px,transparent 14px 17px)}
    .nerv-word{font-weight:900;font-style:italic;font-size:24px;letter-spacing:5px;color:#e8332a;
      text-shadow:0 0 14px rgba(232,51,42,.45);font-family:"Segoe UI",sans-serif}
    .motto{font-size:7px;letter-spacing:1.5px;color:rgba(255,255,255,.55);line-height:1.7;text-transform:uppercase}
    .sync-box{position:relative;border:1px solid rgba(88,255,163,.35);border-radius:10px;
      padding:10px 12px 8px;background:rgba(10,8,20,.55);min-width:118px}
    .sync-box .lab{font-size:9px;letter-spacing:1.5px;color:#58ffa3}
    .sync-box .val{font-size:23px;font-weight:700;color:#58ffa3;font-variant-numeric:tabular-nums;
      text-shadow:0 0 12px rgba(88,255,163,.4);line-height:1.2}
    .sync-box .val i{font-style:normal;font-size:13px}
    .sync-box .sub{font-size:8px;letter-spacing:1.5px;color:rgba(255,255,255,.55)}
    .sync-box .ring{position:absolute;left:50%;top:50%;width:130px;height:130px;margin:-65px 0 0 -65px;
      animation:spin 26s linear infinite;opacity:.4}
    @keyframes spin{to{transform:rotate(360deg)}}
    .sync-box.berserk{border-color:rgba(255,90,60,.75);animation:alarm 1s steps(2) infinite}
    .sync-box.berserk .lab,.sync-box.berserk .val{color:#ff5a3c;text-shadow:0 0 14px rgba(255,90,60,.65)}
    @keyframes alarm{50%{background:rgba(255,60,30,.14)}}
    .magi{display:flex;flex-direction:column;gap:6px;align-items:center}
    .magi .node{display:flex;flex-direction:column;align-items:center;gap:2px}
    .magi .node span{font-size:7.5px;letter-spacing:1.5px;color:rgba(255,255,255,.6)}
    .magi .node.pulse svg{animation:magiPulse 2.8s ease-in-out infinite}
    @keyframes magiPulse{50%{opacity:.35}}
    .atf svg{animation:atPulse 3.6s ease-in-out infinite}
    @keyframes atPulse{50%{opacity:.45;transform:scale(.97)}}
    .atf .lab{font-size:9px;letter-spacing:2px;color:#ffb300}
    @media (prefers-reduced-motion: reduce){
      .sync-box .ring,.chip .dot,.magi .node.pulse svg,.atf svg,.sync-box.berserk{animation:none}
    }
    .deco-gallery{display:flex;flex-direction:column;align-items:center;gap:9px}
    .gal-title{font-size:9px;letter-spacing:2px;color:#c9a6ff;opacity:.9;font-family:Consolas,monospace}
    .deco-card{position:relative;width:196px;height:298px;padding:0;overflow:hidden;
      border:1px solid rgba(201,166,255,.45);border-radius:12px;background:#14101f;
      cursor:zoom-in;pointer-events:auto;display:block;box-shadow:0 4px 16px rgba(0,0,0,.5);
      transition:transform .18s,box-shadow .18s,border-color .18s;font-family:inherit}
    .deco-card img{width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block}
    .deco-card:hover{transform:scale(1.06);border-color:#e6c9ff;box-shadow:0 0 18px rgba(201,166,255,.55)}
    .deco-card .tag{position:absolute;left:0;right:0;bottom:0;font-size:9px;letter-spacing:1.5px;
      color:#fff;text-align:center;padding:16px 2px 5px;font-family:Consolas,monospace;
      background:linear-gradient(transparent,rgba(10,6,20,.88));pointer-events:none}
    #decoLight{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;
      background:rgba(5,3,12,.9);backdrop-filter:blur(8px)}
    #decoLight.show{display:flex}
    #decoLight img{max-width:min(88vw,1400px);max-height:86vh;border-radius:12px;
      box-shadow:0 12px 70px rgba(0,0,0,.85)}
    #decoLight .x{position:fixed;top:18px;right:22px;width:42px;height:42px;border-radius:50%;
      border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;
      font-size:16px;cursor:pointer;font-family:inherit}
    #decoLight .x:hover{background:rgba(255,255,255,.22)}

    /* EVA 风格刷新钮（左栏 NERV 徽章下方） */
    .deco-reload{display:flex;align-items:center;justify-content:center;gap:7px;
      width:182px;height:32px;border-radius:6px;cursor:pointer;pointer-events:auto;
      background:linear-gradient(180deg,rgba(112,255,184,.14),rgba(112,255,184,.03));
      border:1px solid rgba(112,255,184,.55);
      color:#70ffb8;font-family:Consolas,'Courier New',monospace;
      font-size:10.5px;letter-spacing:2px;transition:all .15s;position:relative}
    .deco-reload::before{content:"";position:absolute;inset:3px;border:1px solid rgba(112,255,184,.18);
      border-radius:4px;pointer-events:none}
    .deco-reload .ico{display:inline-block;font-size:14px;line-height:1;transition:transform .4s}
    .deco-reload:hover{background:rgba(112,255,184,.22);border-color:#70ffb8;
      box-shadow:0 0 14px rgba(112,255,184,.4)}
    .deco-reload:hover .ico{transform:rotate(360deg)}
    .deco-reload .st{color:rgba(112,255,184,.55);font-size:8px;letter-spacing:1px;
      border-left:1px solid rgba(112,255,184,.35);padding-left:7px}
    /* 窄屏回退悬浮圆钮 */
    #reloadFab{position:fixed;bottom:16px;left:14px;z-index:9;width:38px;height:38px;border-radius:50%;
      border:1px solid rgba(112,255,184,.6);background:rgba(18,16,43,.75);color:#70ffb8;
      font-size:17px;cursor:pointer;font-family:inherit;display:none;
      box-shadow:0 2px 10px rgba(0,0,0,.4);transition:all .15s;
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    #reloadFab:hover{background:rgba(112,255,184,.22);transform:rotate(90deg)}
    @media (max-width:1299px){#reloadFab{display:block}}
    .lightband{position:fixed;top:0;bottom:0;width:170px;z-index:0;pointer-events:none}
    .lightband.l{left:252px;background:linear-gradient(90deg,rgba(180,140,255,.14),rgba(180,140,255,0))}
    .lightband.r{right:252px;background:linear-gradient(270deg,rgba(255,128,85,.12),rgba(255,128,85,0))}

    .corner{position:fixed;width:30px;height:30px;z-index:4;pointer-events:none;opacity:.85}
    .corner.tl{top:8px;left:8px;border-top:3px solid rgba(245,197,24,.95);border-left:3px solid rgba(245,197,24,.95)}
    .corner.tr{top:8px;right:8px;border-top:3px solid rgba(245,197,24,.95);border-right:3px solid rgba(245,197,24,.95)}
    .corner.bl{bottom:8px;left:8px;border-bottom:3px solid rgba(245,197,24,.95);border-left:3px solid rgba(245,197,24,.95)}
    .corner.br{bottom:8px;right:8px;border-bottom:3px solid rgba(245,197,24,.95);border-right:3px solid rgba(245,197,24,.95)}
    .haz-tape{position:fixed;top:0;left:0;right:0;height:4px;z-index:4;pointer-events:none;opacity:.7;
      background:repeating-linear-gradient(-45deg,#f5c518 0 7px,#14101f 7px 14px)}
  `;
  document.head.appendChild(style);

  const nervEmblem = `
    <svg width="150" height="90" viewBox="0 0 104 64" aria-hidden="true">
      <path d="M8 60 A 44 44 0 0 1 96 60 Z" fill="#c8102e" stroke="#7d0a1d" stroke-width="2"/>
      <path d="M52 60 V 20 M52 36 C 41 32 33 24 31 13 M52 36 C 63 32 71 24 73 13
               M52 47 C 39 45 27 37 23 27 M52 47 C 65 45 77 37 81 27"
            stroke="#ffd9dd" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </svg>`;

  const tri = (pulse, name) => `
    <div class="node${pulse ? " pulse" : ""}">
      <svg width="26" height="23" viewBox="0 0 26 23">
        <path d="M13 2 L24 21 H2 Z" fill="rgba(88,255,163,.08)" stroke="#58ffa3" stroke-width="1.6"/>
      </svg><span>${name}</span>
    </div>`;

  // 葛城美里精选（另抓的性感向 safe 图，非图库内壁纸）
  const cardHtml = (n) => `
    <button class="deco-card" data-hd="assets/deco/hd/misato_card_${n}.jpg">
      <img src="assets/deco/misato_card_${n}.jpg" alt="葛城美里" loading="lazy">
      <span class="tag">KATSURAGI · 0${n}</span>
    </button>`;
  const galleryHtml = (a, b) => `
    <div class="deco-item deco-gallery">
      <div class="gal-title">◆ GALLERY · KATSURAGI ◆</div>
      ${cardHtml(a)}${cardHtml(b)}
    </div>`;

  const left = document.createElement("aside");
  left.className = "deco-rail left";
  left.innerHTML = `
    <div class="deco-item">${nervEmblem}
      <div class="nerv-word">NERV</div>
      <div class="motto">God's in his heaven.<br>All's right with the world.</div>
      <button class="deco-reload" title="刷新页面（重新加载最新版本）">
        <span class="ico">⟳</span>RESTART<span class="st">再起動</span>
      </button>
    </div>
    ${galleryHtml(1, 2)}
    <div class="deco-item"><div class="stripe"></div></div>
    <div class="deco-item chip"><span class="dot"></span>PATTERN : BLUE</div>
    <div class="deco-item"><div class="barcode"></div><div class="tiny">MARDUK REPORT · 04</div></div>`;

  const right = document.createElement("aside");
  right.className = "deco-rail right";
  right.innerHTML = `
    <div class="deco-item">
      <div class="sync-box" id="decoSync">
        <svg class="ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#58ffa3" stroke-width="1" stroke-dasharray="4 7"/>
        </svg>
        <div class="lab">シンクロ率 SYNC RATE</div>
        <div class="val" id="decoSyncVal">41.3<i>%</i></div>
        <div class="sub">EVA-01 TEST TYPE</div>
      </div>
    </div>
    ${galleryHtml(3, 4)}
    <div class="deco-item"><div class="stripe"></div></div>
    <div class="deco-item magi">
      ${tri(true, "MELCHIOR")}${tri(false, "BALTHASAR")}${tri(false, "CASPER")}
      <div class="tiny">MAGI SYSTEM · 3 NODES</div>
    </div>`;

  const corners = ["tl", "tr", "bl", "br"].map(k => {
    const d = document.createElement("div");
    d.className = "corner " + k;
    return d;
  });
  const tape = document.createElement("div");
  tape.className = "haz-tape";
  corners.forEach(c => document.body.appendChild(c));
  document.body.appendChild(tape);
  const bandL = document.createElement("div");
  bandL.className = "lightband l";
  const bandR = document.createElement("div");
  bandR.className = "lightband r";
  document.body.appendChild(bandL);
  document.body.appendChild(bandR);
  document.body.appendChild(left);
  document.body.appendChild(right);

  // 美里精选：点击卡片放大预览
  const light = document.createElement("div");
  light.id = "decoLight";
  light.innerHTML = `<img src="" alt=""><button class="x" title="关闭 (Esc)">✕</button>`;
  document.body.appendChild(light);
  const lightImg = light.querySelector("img");
  const lightClose = () => light.classList.remove("show");
  document.querySelectorAll(".deco-card").forEach(card => {
    card.addEventListener("click", () => {
      lightImg.src = card.dataset.hd;
      light.classList.add("show");
    });
  });
  light.querySelector(".x").addEventListener("click", lightClose);
  light.addEventListener("click", e => { if (e.target === light) lightClose(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && light.classList.contains("show")) lightClose();
  });

  // 同步率面板：目标值平滑逼近 + 轻微抖动，暴走时红色警报
  const valEl = right.querySelector("#decoSyncVal");
  const boxEl = right.querySelector("#decoSync");
  let target = 41.3, shown = 41.3, berserk = false;
  window.__decoSyncRate = (v, b) => {
    target = Math.max(0, Math.min(400, Number(v) || 0));
    berserk = !!b;
  };
  setInterval(() => {
    shown += (target - shown) * 0.2;
    const jitter = (Math.random() - 0.5) * (berserk ? 2.4 : 0.5);
    valEl.innerHTML = Math.max(0, shown + jitter).toFixed(1) + "<i>%</i>";
    boxEl.classList.toggle("berserk", berserk);
  }, 620);

  // 刷新按钮（左栏 EVA 组件 + 窄屏悬浮圆钮回退）
  const reloadBtn = document.createElement("button");
  reloadBtn.id = "reloadFab";
  reloadBtn.title = "刷新页面（重新加载最新版本）";
  reloadBtn.textContent = "⟳";
  document.body.appendChild(reloadBtn);
  // 刷新程序：请求本地服务自重启（拉取最新代码），完成后刷新页面
  let restarting = false;
  const doRestart = async (btn) => {
    if (restarting) return;
    restarting = true;
    const label = btn ? btn.textContent : "";
    if (btn) btn.textContent = label.replace("RESTART", "RESTARTING").replace("再起動", "再起動中");
    try {
      await fetch("api/restart", { method: "POST" });
    } catch (e) { /* 服务重启中连接会断，属正常 */ }
    setTimeout(() => location.reload(), 1400);
  };
  reloadBtn.addEventListener("click", () => doRestart(reloadBtn));
  document.querySelectorAll(".deco-reload").forEach(b => b.addEventListener("click", () => doRestart(b)));

  // 宽屏才显示
  const mq = window.matchMedia("(min-width:" + MIN_W + "px)");
  const apply = () => {
    document.body.classList.toggle("deco-on", mq.matches);
    // reload 按钮：宽屏走 rail 内组件，窄屏走悬浮回退（CSS media 控制）
  };
  if (mq.addEventListener) mq.addEventListener("change", apply); else mq.addListener(apply);
  apply();
})();
