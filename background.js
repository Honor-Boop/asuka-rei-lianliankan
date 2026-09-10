/* 壁纸背景轮换组件：依赖 wallpapers/manifest.js 提供的 window.WALLPAPER_LIST。
   在任意页面引入：
     <script src="wallpapers/manifest.js"></script>
     <script src="background.js"></script>
   提供 window.__bgNext() 手动切换下一张，window.__bgList() 获取当前列表。

   显示策略：图片【完整 contain 显示】于中央，不裁切任何部分；
   背后用同一张图的高倍模糊版铺满全屏，避免黑边，兼顾完整与沉浸。 */
(function () {
  "use strict";
  const LIST = (window.WALLPAPER_LIST || []).filter(w => w.src);
  if (!LIST.length) return;

  const ROTATE_MS = 12000;      // 每张停留时间
  const FADE_MS = 1600;         // 淡入淡出时长

  const style = document.createElement("style");
  style.textContent = `
    #bgRotator { position: fixed; inset: 0; z-index: -1; overflow: hidden;
                 background: #12102b; }
    #bgRotator .bg-layer { position: absolute; inset: 0;
                           opacity: 0; transition: opacity ${FADE_MS}ms ease-in-out; }
    #bgRotator .bg-layer.on { opacity: 1; }
    /* 铺底：同图放大模糊（盖满全屏、无黑边） */
    #bgRotator .bg-blur { position: absolute; inset: -30px;
                          background-size: cover; background-position: center;
                          filter: blur(22px) brightness(0.52) saturate(1.15);
                          transform: scale(1.04); }
    /* 主图：完整 contain 显示，任何分辨率都不裁切 */
    #bgRotator .bg-fit { position: absolute; inset: 0;
                         background-size: contain; background-position: center;
                         background-repeat: no-repeat; }
    #bgRotator .bg-shade { position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(1100px 640px at 82% -8%, rgba(88, 182, 255, 0.10), transparent 60%),
        radial-gradient(950px 640px at 10% 108%, rgba(255, 106, 61, 0.10), transparent 60%),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 26px),
        linear-gradient(180deg, rgba(20, 16, 44, 0.42), rgba(20, 16, 44, 0.16) 42%,
                        rgba(20, 16, 44, 0.28) 60%, rgba(20, 16, 44, 0.5));
    }
    #bgRotator .bg-tag { position: fixed; right: 14px; bottom: 10px; z-index: 1;
      font-size: 11px; letter-spacing: 1px; color: rgba(236, 232, 247, 0.5);
      background: rgba(11, 8, 23, 0.45); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 3px 9px; pointer-events: none;
      font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; }
  `;
  document.head.appendChild(style);

  function makeLayer() {
    const layer = document.createElement("div");
    layer.className = "bg-layer";
    const blur = document.createElement("div");
    blur.className = "bg-blur";
    const fit = document.createElement("div");
    fit.className = "bg-fit";
    layer.append(blur, fit);
    return layer;
  }
  const layerA = makeLayer();
  const layerB = makeLayer();
  const root = document.createElement("div");
  root.id = "bgRotator";
  root.append(layerA, layerB);
  // 观景页（data-bg-clean）不叠暗化遮罩，纯享壁纸
  const cleanMode = document.body.hasAttribute("data-bg-clean");
  let tag = null;
  if (!cleanMode) {
    const shade = document.createElement("div");
    shade.className = "bg-shade";
    root.appendChild(shade);
  }
  tag = document.createElement("div");
  tag.className = "bg-tag";
  root.appendChild(tag);
  document.body.prepend(root);

  let current = -1;   // 当前展示下标
  let front = layerA; // 处于 on 状态的层
  let timer = null;

  function preload(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  async function show(index) {
    const item = LIST[index];
    if (!item) return;
    const ok = await preload(item.src);
    if (!ok) return;
    const back = front === layerA ? layerB : layerA;
    const imgUrl = `url("${item.src}")`;
    back.querySelector(".bg-blur").style.backgroundImage = imgUrl;
    back.querySelector(".bg-fit").style.backgroundImage = imgUrl;
    // 强制回流后再切换透明度，保证过渡生效
    void back.offsetWidth;
    back.classList.add("on");
    front.classList.remove("on");
    front = back;
    current = index;
    const who = { rei: "绫波丽", asuka: "明日香", misato: "美里" }[item.char] || item.char;
    tag.textContent = `${who} · ${item.res}`;
    window.dispatchEvent(new CustomEvent("bgchange", { detail: { index, char: item.char } }));
  }

  function nextIndex() { return (current + 1) % LIST.length; }
  function prevIndex() { return current < 0 ? 0 : (current - 1 + LIST.length) % LIST.length; }

  function schedule() {
    if (timer) clearTimeout(timer);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setTimeout(async () => { await show(nextIndex()); schedule(); }, ROTATE_MS);
  }

  window.__bgNext = async function () {
    await show(nextIndex());
    schedule(); // 手动切换后重新计时
  };
  window.__bgPrev = async function () {
    await show(prevIndex());
    schedule();
  };
  window.__bgPause = function () { if (timer) { clearTimeout(timer); timer = null; } };
  window.__bgResume = function () { schedule(); };
  window.__bgPaused = () => !timer;
  window.__bgList = () => LIST.slice();
  window.__bgCurrent = () => current;
  window.__bgCurrentItem = () => LIST[current] || null;
  // 跳到指定壁纸（图库面板「设为背景」用）：接受下标或 src
  window.__bgShowSrc = async function (srcOrIndex) {
    const i = typeof srcOrIndex === "number"
      ? srcOrIndex : LIST.findIndex(w => w.src === srcOrIndex);
    if (i < 0 || i >= LIST.length) return false;
    await show(i);
    schedule();          // 从这张起继续轮换
    return true;
  };

  // 首页随机起点
  show(Math.floor(Math.random() * LIST.length)).then(schedule);
})();
