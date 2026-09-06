/* EVA 主题侧边装饰栏（宽屏显示，窄屏自动隐藏）。
   页面引入：<script src="deco.js"></script>
   可在 <body> 上用 data-deco-min="1600" 调整显示的最小视口宽度（默认 1300）。
   游戏页可通过 window.__decoSyncRate(数值, 是否暴走) 驱动同步率面板。 */
(function () {
  "use strict";
  const MIN_W = Number(document.body.dataset.decoMin || 1300);

  const style = document.createElement("style");
  style.textContent = `
    .deco-rail{position:fixed;top:0;bottom:0;width:150px;z-index:0;pointer-events:none;
      display:none;flex-direction:column;justify-content:space-between;align-items:center;
      padding:16px 6px;font-family:Consolas,'Courier New',monospace;color:#b9b0d6;opacity:1}
    body.deco-on .deco-rail{display:flex}
    .deco-rail.left{left:0;border-right:1px dashed rgba(255,255,255,.07)}
    .deco-rail.right{right:0;border-left:1px dashed rgba(255,255,255,.07)}
    .deco-rail::after{content:"";position:absolute;inset:0;pointer-events:none;
      background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 1px,transparent 1px 4px)}
    .deco-item{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;position:relative;z-index:1}
    .vtext{display:flex;gap:12px;writing-mode:vertical-rl;font-family:"Microsoft YaHei",sans-serif;
      font-size:13px;letter-spacing:8px;color:rgba(255,255,255,.5);padding:6px 0}
    .vtext b{color:rgba(255,255,255,.75);font-weight:600}
    .stripe{width:104px;height:12px;border-radius:3px;opacity:.7;
      background:repeating-linear-gradient(-45deg,#f5c518 0 9px,#191423 9px 18px)}
    .chip{font-size:10px;letter-spacing:1px;padding:4px 9px;border:1px solid rgba(88,255,163,.4);
      border-radius:6px;color:#58ffa3;display:flex;gap:6px;align-items:center;background:rgba(88,255,163,.05)}
    .chip .dot{width:6px;height:6px;border-radius:50%;background:#58ffa3;animation:blink 1.6s steps(2) infinite}
    @keyframes blink{50%{opacity:.15}}
    .tiny{font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.5)}
    .barcode{width:88px;height:20px;opacity:.65;
      background:repeating-linear-gradient(90deg,#cfc8e8 0 2px,transparent 2px 5px,#cfc8e8 5px 6px,transparent 6px 11px,#cfc8e8 11px 14px,transparent 14px 17px)}
    .nerv-word{font-weight:900;font-style:italic;font-size:19px;letter-spacing:5px;color:#e8332a;
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
  `;
  document.head.appendChild(style);

  const nervEmblem = `
    <svg width="100" height="60" viewBox="0 0 104 64" aria-hidden="true">
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

  const left = document.createElement("aside");
  left.className = "deco-rail left";
  left.innerHTML = `
    <div class="deco-item">${nervEmblem}
      <div class="nerv-word">NERV</div>
      <div class="motto">God's in his heaven.<br>All's right with the world.</div>
    </div>
    <div class="deco-item vtext"><span>特務機関</span><b>第3新東京市</b></div>
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
    <div class="deco-item"><div class="stripe"></div></div>
    <div class="deco-item magi">
      ${tri(true, "MELCHIOR")}${tri(false, "BALTHASAR")}${tri(false, "CASPER")}
      <div class="tiny">MAGI SYSTEM · 3 NODES</div>
    </div>
    <div class="deco-item atf">
      <svg width="118" height="82" viewBox="0 0 120 84" aria-hidden="true">
        <g fill="none" stroke="#ffb300" stroke-width="1.6">
          <polygon points="86,42 73,19.5 47,19.5 34,42 47,64.5 73,64.5"/>
          <polygon points="108,62 101.5,50.7 88.5,50.7 82,62 88.5,73.3 101.5,73.3" opacity=".8"/>
          <polygon points="38,18 33,9.3 23,9.3 18,18 23,26.7 33,26.7" opacity=".6"/>
        </g>
      </svg>
      <div class="lab">A.T. FIELD ACTIVE</div>
    </div>
    <div class="deco-item vtext"><b>使徒襲来</b><span>発進準備</span></div>`;

  document.body.appendChild(left);
  document.body.appendChild(right);

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

  // 宽屏才显示
  const mq = window.matchMedia("(min-width:" + MIN_W + "px)");
  const apply = () => document.body.classList.toggle("deco-on", mq.matches);
  if (mq.addEventListener) mq.addEventListener("change", apply); else mq.addListener(apply);
  apply();
})();
