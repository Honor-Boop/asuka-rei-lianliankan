/* 壁纸背景轮换组件：依赖 wallpapers/manifest.js 提供的 window.WALLPAPER_LIST。
   在任意页面引入：
     <script src="wallpapers/manifest.js"></script>
     <script src="background.js"></script>
   提供 window.__bgNext() 手动切换下一张，window.__bgList() 获取当前列表。 */
(function () {
  "use strict";
  const LIST = (window.WALLPAPER_LIST || []).filter(w => w.src);
  if (!LIST.length) return;

  const ROTATE_MS = 12000;      // 每张停留时间
  const FADE_MS = 1600;         // 淡入淡出时长

  const style = document.createElement("style");
  style.textContent = `
    #bgRotator { position: fixed; inset: 0; z-index: -1; overflow: hidden;
                 background: #0b0817; }
    #bgRotator .bg-layer { position: absolute; inset: -24px;
                           background-size: cover; background-position: center;
                           opacity: 0; transition: opacity ${FADE_MS}ms ease-in-out;
                           transform: scale(1.02); }
    #bgRotator .bg-layer.on { opacity: 1; }
    #bgRotator .bg-shade { position: absolute; inset: 0;
      background:
        radial-gradient(1100px 640px at 82% -8%, rgba(88, 182, 255, 0.10), transparent 60%),
        radial-gradient(950px 640px at 10% 108%, rgba(255, 106, 61, 0.10), transparent 60%),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 26px),
        linear-gradient(180deg, rgba(11, 8, 23, 0.60), rgba(11, 8, 23, 0.74));
    }
    #bgRotator .bg-tag { position: fixed; right: 14px; bottom: 10px; z-index: 1;
      font-size: 11px; letter-spacing: 1px; color: rgba(236, 232, 247, 0.5);
      background: rgba(11, 8, 23, 0.45); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 3px 9px; pointer-events: none;
      font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "bgRotator";
  const layerA = document.createElement("div");
  layerA.className = "bg-layer";
  const layerB = document.createElement("div");
  layerB.className = "bg-layer";
  const shade = document.createElement("div");
  shade.className = "bg-shade";
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  root.append(layerA, layerB, shade, tag);
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
    back.style.backgroundImage = `url("${item.src}")`;
    // 强制回流后再切换透明度，保证过渡生效
    void back.offsetWidth;
    back.classList.add("on");
    front.classList.remove("on");
    front = back;
    current = index;
    const who = item.char === "rei" ? "绫波丽" : "明日香";
    tag.textContent = `${who} · ${item.res}`;
  }

  function nextIndex() { return (current + 1) % LIST.length; }

  function schedule() {
    if (timer) clearTimeout(timer);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setTimeout(async () => { await show(nextIndex()); schedule(); }, ROTATE_MS);
  }

  window.__bgNext = async function () {
    await show(nextIndex());
    schedule(); // 手动切换后重新计时
  };
  window.__bgList = () => LIST.slice();

  // 首页随机起点
  show(Math.floor(Math.random() * LIST.length)).then(schedule);
})();
