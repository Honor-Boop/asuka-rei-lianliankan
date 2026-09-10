/* 图库面板组件（任意游戏页可用）
   引入方式：在页面里加载 manifest.js + background.js 之后：
     <script src="gallery_panel.js"></script>
   效果：
     - 自动往页面控制区（.controls 或 #bar）插入「🖼 图库」按钮；没有控制区则右下角浮钮
     - 点开后就地浏览壁纸：角色筛选、缩略图墙、点图放大（←/→ 翻页、Esc 关闭）
     - 「设为背景」立即把该图换成当前背景（需 background.js 提供 __bgShowSrc）
     - 「打开完整图库」跳 gallery.html（上传/删除等管理功能）
   也提供 window.__openGallery(char) 供页面主动调用。 */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const CHAR_NAME = { rei: "绫波丽", asuka: "明日香", misato: "美里" };
  const CHAR_ORDER = ["rei", "asuka", "misato"];

  /* ---------- 样式 ---------- */
  const style = document.createElement("style");
  style.textContent = `
    #gpModal{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;
      background:rgba(8,5,18,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    #gpModal.show{display:flex}
    #gpModal .gp-box{width:min(1080px,calc(100vw - 40px));max-height:88vh;display:flex;flex-direction:column;
      background:rgba(28,21,58,.96);border:1px solid rgba(255,224,102,.35);border-radius:16px;
      box-shadow:0 0 0 1px rgba(255,224,102,.12),0 18px 70px rgba(0,0,0,.65);overflow:hidden}
    #gpModal .gp-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.12)}
    #gpModal .gp-title{font-size:16px;font-weight:900;font-style:italic;letter-spacing:2px;
      background:linear-gradient(90deg,#74c4ff,#b48cff 55%,#ff8055);
      -webkit-background-clip:text;background-clip:text;color:transparent}
    #gpModal .gp-count{font-size:11px;color:var(--text-dim,#c9c2ea);letter-spacing:1px;
      font-family:Consolas,monospace;margin-right:auto}
    #gpModal .gp-chip{font-family:inherit;font-size:12px;color:#fff;cursor:pointer;
      background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);border-radius:20px;
      padding:4px 13px;transition:all .15s}
    #gpModal .gp-chip:hover{background:rgba(255,255,255,.2)}
    #gpModal .gp-chip.on{border-color:var(--gold,#ffe066);color:var(--gold,#ffe066);
      box-shadow:0 0 12px rgba(255,224,102,.25)}
    #gpModal .gp-close{font-family:inherit;font-size:15px;line-height:1;color:#fff;cursor:pointer;
      background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);border-radius:9px;
      padding:5px 11px}
    #gpModal .gp-close:hover{background:rgba(255,90,60,.35);border-color:#ff5a3c}
    #gpModal .gp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));
      gap:10px;padding:14px 18px 18px;overflow:auto}
    #gpModal .gp-item{position:relative;border-radius:10px;overflow:hidden;cursor:pointer;
      border:1px solid rgba(255,255,255,.16);background:#171130;transition:all .15s}
    #gpModal .gp-item:hover{border-color:rgba(116,196,255,.75);transform:translateY(-2px);
      box-shadow:0 6px 20px rgba(0,0,0,.45)}
    #gpModal .gp-item img{width:100%;height:104px;object-fit:cover;display:block}
    #gpModal .gp-item .cap{font-size:10.5px;color:#c9c2ea;padding:5px 8px;letter-spacing:.5px;
      display:flex;justify-content:space-between;gap:6px}
    #gpModal .gp-item.now{border-color:var(--eva-green,#70ffb8);box-shadow:0 0 14px rgba(112,255,184,.35)}
    #gpModal .gp-item .nowtag{position:absolute;top:6px;left:6px;font-size:10px;
      background:rgba(112,255,184,.9);color:#0d2b1d;border-radius:6px;padding:1px 6px;font-weight:700}
    #gpModal .gp-empty{padding:26px 18px;color:#c9c2ea;font-size:13px;text-align:center}

    #gpLight{position:fixed;inset:0;z-index:140;display:none;align-items:center;justify-content:center;
      background:rgba(6,4,14,.94)}
    #gpLight.show{display:flex}
    #gpLight img{max-width:calc(100vw - 190px);max-height:calc(100vh - 130px);
      border-radius:12px;box-shadow:0 18px 70px rgba(0,0,0,.75);object-fit:contain}
    #gpLight .nav{position:absolute;top:50%;transform:translateY(-50%);font-size:26px;line-height:1;
      color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);
      border-radius:50%;width:54px;height:54px;cursor:pointer;font-family:inherit}
    #gpLight .nav:hover{background:rgba(116,196,255,.35)}
    #gpLight #gpPrevL{left:26px}
    #gpLight #gpNextL{right:26px}
    #gpLight .gp-lbar{position:absolute;bottom:22px;left:0;right:0;display:flex;gap:9px;
      justify-content:center;align-items:center;flex-wrap:wrap}
    #gpLight .gp-lbar button{font-family:inherit;font-size:12.5px;font-weight:700;color:#14101f;
      border:none;border-radius:9px;padding:8px 18px;cursor:pointer;
      background:linear-gradient(90deg,#74c4ff,#ff8055)}
    #gpLight .gp-lbar button.ghost{background:rgba(255,255,255,.12);color:#fff;font-weight:400;
      border:1px solid rgba(255,255,255,.26)}
    #gpLight .gp-meta{position:absolute;top:20px;left:0;right:0;text-align:center;color:#fff;
      font-size:12.5px;letter-spacing:2px}
    #gpLight .gp-meta b{color:var(--gold,#ffe066)}
    #gpLight .gp-x{position:absolute;top:18px;right:22px;font-size:16px;color:#fff;cursor:pointer;
      background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.26);border-radius:9px;
      padding:6px 13px;font-family:inherit}
    @media (max-width:700px){
      #gpLight img{max-width:calc(100vw - 60px)}
      #gpLight .nav{display:none}
    }
  `;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  const modal = document.createElement("div");
  modal.id = "gpModal";
  modal.innerHTML = `
    <div class="gp-box">
      <div class="gp-head">
        <div class="gp-title">壁纸图库 · GALLERY</div>
        <div class="gp-count" id="gpCount"></div>
        <div id="gpChips" style="display:flex;gap:7px;flex-wrap:wrap"></div>
        <button class="gp-close" id="gpClose" title="关闭 (Esc)">✕</button>
      </div>
      <div class="gp-grid" id="gpGrid"></div>
    </div>`;
  document.body.appendChild(modal);

  const light = document.createElement("div");
  light.id = "gpLight";
  light.innerHTML = `
    <div class="gp-meta" id="gpMeta"></div>
    <button class="gp-x" id="gpX">✕ 关闭</button>
    <button class="nav" id="gpPrevL" title="上一张 (←)">‹</button>
    <img id="gpBig" alt="">
    <button class="nav" id="gpNextL" title="下一张 (→)">›</button>
    <div class="gp-lbar">
      <button id="gpSetBg">🖼 设为背景</button>
      <button class="ghost" id="gpOpenFull">打开完整图库（上传/删除）</button>
      <button class="ghost" id="gpCloseL">关闭</button>
    </div>`;
  document.body.appendChild(light);

  /* ---------- 入口按钮 ---------- */
  function injectButton() {
    const bar = document.querySelector(".controls") || $("bar");
    const btn = document.createElement("button");
    btn.id = "galleryBtn";
    btn.type = "button";
    btn.title = "查看壁纸图库（不离开当前游戏）";
    btn.textContent = "🖼 图库";
    btn.addEventListener("click", () => { if (window.ensureAudio) try { window.ensureAudio(); } catch (e) {} open(); });
    if (bar) {
      bar.appendChild(btn);
    } else {
      // 无控制区：右下角浮钮（避开版本角标）
      btn.style.cssText = "position:fixed;right:14px;bottom:70px;z-index:7;font-family:inherit;" +
        "font-size:12px;color:#fff;cursor:pointer;background:rgba(18,16,43,.72);" +
        "border:1px solid rgba(255,255,255,.24);border-radius:9px;padding:5px 11px;" +
        "backdrop-filter:blur(6px)";
      document.body.appendChild(btn);
    }
    return btn;
  }
  injectButton();

  /* ---------- 状态 ---------- */
  let filter = "all";     // all | rei | asuka | misato
  let view = [];          // 当前筛选后的列表
  let cur = 0;            // 灯箱下标（相对 view）

  const list = () => {
    const all = (window.__bgList ? window.__bgList() : (window.WALLPAPER_LIST || []))
      .filter(w => w && w.src);
    return filter === "all" ? all : all.filter(w => w.char === filter);
  };

  /* ---------- 渲染 ---------- */
  function renderChips() {
    const all = (window.__bgList ? window.__bgList() : (window.WALLPAPER_LIST || [])).filter(w => w && w.src);
    const counts = { all: all.length };
    for (const c of CHAR_ORDER) counts[c] = all.filter(w => w.char === c).length;
    const box = $("gpChips");
    box.innerHTML = "";
    const mk = (key, label) => {
      if (key !== "all" && !counts[key]) return;
      const b = document.createElement("button");
      b.className = "gp-chip" + (filter === key ? " on" : "");
      b.textContent = label + " " + (counts[key] || 0);
      b.addEventListener("click", () => { filter = key; open(); });
      box.appendChild(b);
    };
    mk("all", "全部");
    for (const c of CHAR_ORDER) mk(c, CHAR_NAME[c] || c);
  }

  function renderGrid() {
    view = list();
    const grid = $("gpGrid");
    grid.innerHTML = "";
    $("gpCount").textContent = view.length + " 张";
    if (!view.length) {
      grid.innerHTML = '<div class="gp-empty">这个分类下还没有壁纸。<br>' +
        '到完整图库页可以「添加图片」上传自己的壁纸。</div>';
      return;
    }
    const nowSrc = (window.__bgCurrentItem && window.__bgCurrentItem() || {}).src;
    view.forEach((w, i) => {
      const d = document.createElement("div");
      d.className = "gp-item" + (w.src === nowSrc ? " now" : "");
      d.title = "点击放大查看";
      d.innerHTML = (w.src === nowSrc ? '<span class="nowtag">当前背景</span>' : "") +
        `<img src="${w.thumb || w.src}" alt="" loading="lazy">` +
        `<div class="cap"><span>${CHAR_NAME[w.char] || w.char || "壁纸"}</span><span>${w.res || ""}</span></div>`;
      d.addEventListener("click", () => openLight(i));
      grid.appendChild(d);
    });
  }

  function openLight(i) {
    view = list();
    if (!view.length) return;
    cur = (i + view.length) % view.length;
    const w = view[cur];
    $("gpBig").src = w.src;
    $("gpMeta").innerHTML = `<b>${CHAR_NAME[w.char] || w.char || "壁纸"}</b> · ${w.res || ""} ` +
      `· ${cur + 1} / ${view.length}`;
    light.classList.add("show");
  }
  const step = d => openLight(cur + d);

  /* ---------- 面板内轻提示 ---------- */
  let gpToastEl = null, gpToastTid = null;
  function gpToast(msg) {
    if (!gpToastEl) {
      gpToastEl = document.createElement("div");
      gpToastEl.style.cssText = "position:fixed;left:50%;bottom:92px;transform:translateX(-50%) translateY(16px);" +
        "z-index:150;background:rgba(34,25,66,.96);border:1px solid rgba(255,224,102,.45);color:#fff;" +
        "padding:8px 16px;border-radius:9px;font-size:13px;opacity:0;transition:all .25s;pointer-events:none;" +
        "font-family:'Segoe UI','Microsoft YaHei',system-ui,sans-serif";
      document.body.appendChild(gpToastEl);
    }
    gpToastEl.textContent = msg;
    gpToastEl.style.opacity = "1";
    gpToastEl.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(gpToastTid);
    gpToastTid = setTimeout(() => {
      gpToastEl.style.opacity = "0";
      gpToastEl.style.transform = "translateX(-50%) translateY(16px)";
    }, 2000);
  }

  /* ---------- 开关 ---------- */
  function open() {
    modal.classList.add("show");
    renderChips();
    renderGrid();
  }
  function close() {
    modal.classList.remove("show");
    light.classList.remove("show");
  }
  const closeLight = () => light.classList.remove("show");

  window.__openGallery = function (char) {
    filter = char && CHAR_ORDER.includes(char) ? char : "all";
    open();
  };

  /* ---------- 事件 ---------- */
  $("gpClose").addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  $("gpX").addEventListener("click", closeLight);
  $("gpCloseL").addEventListener("click", closeLight);
  $("gpPrevL").addEventListener("click", () => step(-1));
  $("gpNextL").addEventListener("click", () => step(1));
  $("gpOpenFull").addEventListener("click", () => { location.href = "gallery.html"; });
  $("gpSetBg").addEventListener("click", async () => {
    const w = view[cur];
    if (!w) return;
    if (typeof window.__bgShowSrc === "function") {
      const ok = await window.__bgShowSrc(w.src);
      renderGrid();   // 刷新「当前背景」标记
      if (ok) gpToast("已设为当前背景：" + (CHAR_NAME[w.char] || "壁纸"));
    } else {
      location.href = "gallery.html";
    }
  });
  // 灯箱内滚轮/左右键翻页
  light.addEventListener("wheel", e => { e.preventDefault(); step(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  // 面板打开时独占键盘：拦下事件，避免同时触发页面自身的快捷键（如观景页 ←/→ 换壁纸）
  document.addEventListener("keydown", e => {
    if (light.classList.contains("show")) {
      if (e.key === "Escape") { closeLight(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === "ArrowRight") { step(1); e.preventDefault(); e.stopImmediatePropagation(); return; }
      return;
    }
    if (modal.classList.contains("show")) {
      if (e.key === "Escape") { close(); e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    // 快捷键：G 打开图库（输入框内不触发）
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      open();
      e.stopImmediatePropagation();
    }
  });
})();
