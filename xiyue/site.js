(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const theme = document.querySelector(".theme-toggle");
  const resolvedDark = () => root.dataset.theme === "dark" ||
    (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  function themeLabel() { theme.setAttribute("aria-label", resolvedDark() ? "切换浅色模式" : "切换深色模式"); }
  themeLabel();
  theme.addEventListener("click", () => {
    const next = resolvedDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("xiyue-wiki-theme", next); } catch (_) {}
    themeLabel();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeLabel);

  const dialogs = [...document.querySelectorAll("dialog")];
  let previousFocus = null;
  function show(dialog) {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add("modal-open");
  }
  for (const d of dialogs) {
    d.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", e => { if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    } });
    d.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false");
      previousFocus?.focus();
    });
  }
  const drawer = document.querySelector("#nav-drawer");
  const menu = document.querySelector(".menu-toggle");
  menu.addEventListener("click", () => { show(drawer); menu.setAttribute("aria-expanded", "true"); });

  const lightbox = document.querySelector("#lightbox");
  for (const b of document.querySelectorAll("[data-lightbox]")) {
    b.addEventListener("click", () => {
      lightbox.querySelector("img").src = b.dataset.lightbox;
      lightbox.querySelector("img").alt = b.querySelector("img").alt;
      show(lightbox);
    });
  }
  const search = document.querySelector("#search-dialog");
  const input = document.querySelector("#site-query");
  const results = document.querySelector("#search-results");
  const entries = window.XIYUE_SEARCH_INDEX || [];
  const prefix = document.body.dataset.page === "home" ? "" : "../";
  function renderSearch() {
    const q = input.value.trim().toLocaleLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const list = tokens.length ? entries.filter(e =>
      tokens.every(t => `${e.title} ${e.page} ${e.text}`.toLocaleLowerCase().includes(t))).slice(0, 30)
      : entries.filter(e => e.page !== "更新日志").slice(0, 6);
    results.replaceChildren();
    if (!list.length) {
      const p = document.createElement("p"); p.className = "search-empty"; p.textContent = "没有找到，试试换个关键词。";
      results.append(p); return;
    }
    for (const e of list) {
      const a = document.createElement("a"); a.className = "search-result"; a.href = prefix + e.url;
      const small = document.createElement("small"); small.textContent = e.page;
      const strong = document.createElement("strong"); strong.textContent = e.title;
      const p = document.createElement("p"); p.textContent = e.text.slice(0, 105) + (e.text.length > 105 ? "…" : "");
      a.append(small, strong, p); results.append(a);
    }
  }
  function openSearch() { renderSearch(); show(search); input.focus(); }
  document.querySelector(".search-open").addEventListener("click", openSearch);
  input.addEventListener("input", renderSearch);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const current = dialogs.filter(d => d.open).at(-1);
      if (current) { e.preventDefault(); current.close(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (search.open && e.key === "ArrowDown" && e.target === input) {
      e.preventDefault(); results.querySelector("a")?.focus();
    }
  }, { capture: true });
  for (const button of document.querySelectorAll(".code-copy")) {
    button.addEventListener("click", async () => {
      const block = button.closest(".code-block");
      const text = block.querySelector("code").textContent;
      const status = block.querySelector(".copy-status");
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else {
          const field = document.createElement("textarea"); field.value = text;
          field.style.cssText = "position:fixed;opacity:0;pointer-events:none"; document.body.append(field);
          field.select(); const ok = document.execCommand("copy"); field.remove();
          if (!ok) throw new Error("copy unavailable");
        }
        status.textContent = "已复制，可以粘贴到自己的 compose 文件。";
      } catch (_) { status.textContent = "复制不可用，请选中代码手动复制。"; }
    });
  }
  const seriesButtons = [...document.querySelectorAll("[data-series]")];
  seriesButtons.forEach(b => b.addEventListener("click", () => {
    seriesButtons.forEach(x => { const active = x === b; x.classList.toggle("is-active", active); x.setAttribute("aria-pressed", active); });
    document.querySelectorAll("[data-release-group]").forEach(g => { g.hidden = b.dataset.series !== "all" && g.dataset.releaseGroup !== b.dataset.series; });
  }));
  // 从搜索 / 外部锚点打开旧版本时，先展开对应的原生 details。
  function openHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    for (let p = target.parentElement; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
    const group = target.closest("[data-release-group]");
    if (group?.hidden) seriesButtons.find(b => b.dataset.series === "all")?.click();
    if (id) target.scrollIntoView({ behavior: "instant", block: "start" });
  }
  addEventListener("hashchange", openHash);
  if (location.hash) requestAnimationFrame(openHash);

  const reveal = document.querySelectorAll(".reveal");
  if (!reduce.matches && "IntersectionObserver" in window) {
    root.classList.add("motion-ready");
    const observer = new IntersectionObserver(items => {
      for (const item of items) if (item.isIntersecting) { item.target.classList.add("is-visible"); observer.unobserve(item.target); }
    }, { threshold: .08 });
    reveal.forEach(e => observer.observe(e));
  }
  const storyImages = [...document.querySelectorAll("[data-story-image]")];
  const storySteps = [...document.querySelectorAll("[data-story]")];
  // rootMargin 的百分比按宽度计算；用视口高度换算，避免宽屏下观察区变空。
  const viewportBand = (top, bottom) => `-${Math.round(innerHeight * top)}px 0px -${Math.round(innerHeight * bottom)}px 0px`;
  if (storySteps.length) {
    let observer;
    function observeStory() {
      observer?.disconnect();
      observer = new IntersectionObserver(items => {
        if (reduce.matches) return;
        for (const item of items) if (item.isIntersecting) {
          storyImages.forEach(img => img.classList.toggle("is-current", img.dataset.storyImage === item.target.dataset.story));
        }
      }, { rootMargin: viewportBand(.25, .35), threshold: 0 });
      storySteps.forEach(s => observer.observe(s));
    }
    observeStory();
    addEventListener("resize", observeStory);
  }
  const sections = document.querySelectorAll(".doc-section, .release-group");
  const tocLinks = [...document.querySelectorAll(".toc a")];
  let tocObserver;
  const visibleSections = new Set();
  function observeToc() {
    tocObserver?.disconnect();
    visibleSections.clear();
    tocObserver = new IntersectionObserver(items => {
      for (const item of items) {
        if (item.isIntersecting) visibleSections.add(item.target);
        else visibleSections.delete(item.target);
      }
      const active = [...visibleSections].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (!active) return;
      tocLinks.forEach(a => { const yes = a.hash === "#" + active.id; a.classList.toggle("is-active", yes); if (yes) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    }, { rootMargin: viewportBand(.25, .6), threshold: 0 });
    sections.forEach(s => tocObserver.observe(s));
  }
  observeToc();
  addEventListener("resize", observeToc);

  const videos = [...document.querySelectorAll("video[data-video]")];
  const inView = new WeakSet(), manualPause = new WeakSet();
  function load(v) { if (!v.getAttribute("src")) { v.src = v.dataset.video; v.load(); } }
  function label(v) {
    const b = v.parentElement.querySelector(".video-toggle");
    b.firstElementChild.textContent = v.paused ? "▷" : "Ⅱ";
    b.setAttribute("aria-label", (v.paused ? "播放：" : "暂停：") + v.getAttribute("aria-label"));
  }
  videos.forEach(v => {
    v.addEventListener("play", () => label(v)); v.addEventListener("pause", () => label(v));
    v.parentElement.querySelector("button").addEventListener("click", () => {
      load(v);
      if (v.paused) { manualPause.delete(v); v.play().catch(() => {}); }
      else { manualPause.add(v); v.pause(); }
    });
  });
  const videoObserver = new IntersectionObserver(items => {
    for (const i of items) {
      const v = i.target;
      if (i.isIntersecting) { inView.add(v); if (!reduce.matches && !manualPause.has(v) && !document.hidden) { load(v); v.play().catch(() => {}); } }
      else { inView.delete(v); v.pause(); }
    }
  }, { threshold: .4 });
  videos.forEach(v => videoObserver.observe(v));
  document.addEventListener("visibilitychange", () => {
    videos.forEach(v => { if (document.hidden) v.pause(); else if (inView.has(v) && !reduce.matches && !manualPause.has(v)) v.play().catch(() => {}); });
  });
  reduce.addEventListener("change", () => {
    if (reduce.matches) {
      root.classList.remove("motion-ready");
      videos.forEach(v => v.pause());
      storyImages.forEach((img, i) => img.classList.toggle("is-current", i === 0));
    }
  });
})();
