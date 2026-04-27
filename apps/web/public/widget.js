(function () {
  "use strict";

  // Prevent double-init
  if (window.__supportiq_loaded) return;
  window.__supportiq_loaded = true;

  var config = window.SupportIQConfig || {};
  if (!config.apiKey || !config.orgId) {
    console.warn("[SupportIQ] Missing apiKey or orgId in window.SupportIQConfig");
    return;
  }

  var APP_URL = config.appUrl || "https://app.supportiq.ai";
  var orgId = config.orgId;
  var apiKey = config.apiKey;

  // ─── Styles ─────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#__supportiq-btn {",
    "  position: fixed; bottom: 24px; right: 24px; z-index: 99998;",
    "  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;",
    "  box-shadow: 0 4px 24px rgba(0,0,0,0.18);",
    "  display: flex; align-items: center; justify-content: center;",
    "  transition: transform 0.2s, box-shadow 0.2s;",
    "}",
    "#__supportiq-btn:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(0,0,0,0.22); }",
    "#__supportiq-btn svg { width: 24px; height: 24px; fill: white; }",
    "#__supportiq-frame-wrap {",
    "  position: fixed; bottom: 96px; right: 24px; z-index: 99999;",
    "  width: 380px; height: 600px; border-radius: 16px;",
    "  box-shadow: 0 8px 48px rgba(0,0,0,0.18);",
    "  overflow: hidden; border: 1px solid rgba(0,0,0,0.08);",
    "  transform-origin: bottom right;",
    "  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;",
    "}",
    "#__supportiq-frame-wrap.closed {",
    "  transform: scale(0.7); opacity: 0; pointer-events: none;",
    "}",
    "#__supportiq-frame-wrap iframe { width: 100%; height: 100%; border: none; }",
    "@media (max-width: 480px) {",
    "  #__supportiq-frame-wrap {",
    "    width: 100vw; height: 100dvh; bottom: 0; right: 0;",
    "    border-radius: 0; border: none;",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  // ─── Launcher button ─────────────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "__supportiq-btn";
  btn.setAttribute("aria-label", "Open support chat");
  btn.style.backgroundColor = config.color || "#6366f1";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 21l3.94-.867A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.073-1.114l-.29-.174-3.007.663.671-2.944-.19-.302A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>' +
    "</svg>";

  // ─── iframe wrapper ──────────────────────────────────────────────────────────
  var wrap = document.createElement("div");
  wrap.id = "__supportiq-frame-wrap";
  wrap.classList.add("closed");

  var iframe = document.createElement("iframe");
  var iframeSrc =
    APP_URL +
    "/widget/" +
    encodeURIComponent(orgId) +
    "?key=" +
    encodeURIComponent(apiKey);
  iframe.src = iframeSrc;
  iframe.title = "Support Chat";
  iframe.allow = "clipboard-write";
  wrap.appendChild(iframe);

  // ─── Toggle logic ─────────────────────────────────────────────────────────────
  var open = false;

  function toggle() {
    open = !open;
    if (open) {
      wrap.classList.remove("closed");
      btn.setAttribute("aria-label", "Close support chat");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>' +
        "</svg>";
      btn.style.fill = "none";
    } else {
      wrap.classList.add("closed");
      btn.setAttribute("aria-label", "Open support chat");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 21l3.94-.867A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>' +
        "</svg>";
    }
  }

  btn.addEventListener("click", toggle);

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) toggle();
  });

  // ─── Mount ────────────────────────────────────────────────────────────────────
  document.body.appendChild(btn);
  document.body.appendChild(wrap);
})();
