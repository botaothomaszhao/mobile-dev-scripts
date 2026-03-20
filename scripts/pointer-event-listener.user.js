// ==UserScript==
// @name         mobile-dev-指针事件面板
// @namespace    https://tampermonkey.net/
// @version      1.6
// @description  仅显示调试面板并记录所有 pointer/touch 系列事件，支持暂停/继续记录，忽略面板上的事件。
// @author       AI
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // recording 开关：true 表示记录，false 表示暂停记录（仍保留面板功能）
  let recording = true;

  // =============== Debug Panel UI (visible on mobile) ===============
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'tm-input-debug-panel';
    panel.style.position = 'fixed';
    panel.style.top = '8px';
    panel.style.right = '8px';
    panel.style.zIndex = '2147483647';
    panel.style.width = '78vw';
    panel.style.maxWidth = '520px';
    panel.style.background = 'rgba(0,0,0,0.75)';
    panel.style.color = '#fff';
    panel.style.fontSize = '12px';
    panel.style.lineHeight = '1.35';
    panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    panel.style.padding = '8px';
    panel.style.borderRadius = '6px';
    panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
    panel.style.maxHeight = '45vh';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.pointerEvents = 'auto'; // allow interaction with buttons

    // Header (fixed within panel)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.style.flex = '0 0 auto';
    header.style.position = 'relative';

    const title = document.createElement('div');
    title.textContent = 'Input Debug (Pointer/Touch)';
    title.style.fontWeight = '700';
    title.style.flex = '1';
    header.appendChild(title);

    const btnClear = document.createElement('button');
    btnClear.textContent = 'Clear';
    btnClear.style.fontSize = '12px';
    btnClear.style.padding = '4px 8px';
    btnClear.style.borderRadius = '4px';
    btnClear.style.border = '1px solid rgba(255,255,255,0.35)';
    btnClear.style.background = 'rgba(255,255,255,0.08)';
    btnClear.style.color = '#fff';
    btnClear.addEventListener('click', () => {
      log.textContent = '';
      // also reset scroll
      logContainer.scrollTop = 0;
    });
    header.appendChild(btnClear);

    const btnToggle = document.createElement('button');
    btnToggle.id = 'tm-input-debug-toggle';
    btnToggle.textContent = 'Pause';
    btnToggle.style.fontSize = '12px';
    btnToggle.style.padding = '4px 8px';
    btnToggle.style.borderRadius = '4px';
    btnToggle.style.border = '1px solid rgba(255,255,255,0.35)';
    btnToggle.style.background = 'rgba(255,255,255,0.08)';
    btnToggle.style.color = '#fff';
    btnToggle.addEventListener('click', () => {
      recording = !recording;
      btnToggle.textContent = recording ? 'Pause' : 'Resume';
      hint.textContent = recording
        ? '记录：pointer* / touch*（capture=true）。不阻止事件。输出精简信息，忽略面板上的事件。状态：记录中。'
        : '记录：已暂停（Resume 恢复）。忽略面板上的事件。';
    });
    header.appendChild(btnToggle);

    panel.appendChild(header);

    // hint (non-scrolling)
    const hint = document.createElement('div');
    hint.textContent = '记录：pointer* / touch*（capture=true）。不阻止事件。输出精简信息，忽略面板上的事件。状态：记录中。';
    hint.style.opacity = '0.85';
    hint.style.margin = '6px 0';
    hint.style.flex = '0 0 auto';
    panel.appendChild(hint);

    // Log container (scrollable)
    const logContainer = document.createElement('div');
    logContainer.style.flex = '1 1 auto';
    logContainer.style.overflow = 'auto';
    logContainer.style.maxHeight = '36vh';
    logContainer.style.whiteSpace = 'pre-wrap';
    logContainer.style.paddingRight = '4px';

    const log = document.createElement('div');
    log.id = 'tm-input-debug-log';
    log.textContent = '';
    logContainer.appendChild(log);
    panel.appendChild(logContainer);

    function append(line) {
      const now = new Date();
      const ts =
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0') + '.' +
        String(now.getMilliseconds()).padStart(3, '0');

      log.textContent += `[${ts}] ${line}\n`;

      const lines = log.textContent.split('\n');
      const MAX = 220;
      if (lines.length > MAX) {
        log.textContent = lines.slice(lines.length - MAX).join('\n');
      }

      // scroll log container to bottom
      logContainer.scrollTop = logContainer.scrollHeight;
    }

    return { panel, append, hint, panelHeader: header, logContainer };
  }

  const ui = createPanel();

  function mountPanel() {
    if (document.body) {
      document.body.appendChild(ui.panel);
    } else {
      setTimeout(mountPanel, 50);
    }
  }
  mountPanel();

  // Helper: robustly detect whether an event originated on/inside the panel
  function isEventOnPanel(e) {
    try {
      if (!ui || !ui.panel) return false;
      // Prefer composedPath() which works with Shadow DOM; fall back to contains
      if (typeof e.composedPath === 'function') {
        const path = e.composedPath();
        for (let i = 0; i < path.length; i++) {
          if (path[i] === ui.panel) return true;
        }
      }
      // Fallback
      return ui.panel.contains ? ui.panel.contains(e.target) : false;
    } catch (err) {
      return false;
    }
  }

  // =============== Pointer Events Logging (精简) ===============
  const pointerEvents = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerover',
    'pointerout',
    'pointerenter',
    'pointerleave',
    'gotpointercapture',
    'lostpointercapture',
  ];

  function onPointer(e) {
    // 忽略面板上的交互
    if (isEventOnPanel(e)) return;
    if (!recording) return;

    const parts = [];
    parts.push(`POINTER ${e.type}`);
    parts.push(`pt=${e.pointerType}`);
    parts.push(`id=${e.pointerId}`);

    if (typeof e.buttons === 'number') parts.push(`buttons=${e.buttons}`);
    if (typeof e.button === 'number') parts.push(`button=${e.button}`);

    ui.append(parts.join(' | '));
  }

  // =============== Touch Events Logging (精简) ===============
  const touchEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];

  function listTouchIds(list) {
    if (!list) return '';
    const ids = [];
    for (let i = 0; i < list.length; i++) {
      ids.push(list[i].identifier);
    }
    return ids.length ? `{${ids.join(',')}}` : '{}';
  }

  function onTouch(e) {
    // 忽略面板上的交互
    if (isEventOnPanel(e)) return;
    if (!recording) return;

    const parts = [];
    parts.push(`TOUCH ${e.type}`);
    parts.push(`touches=${e.touches ? e.touches.length : 'n/a'}`);
    parts.push(`targetTouches=${e.targetTouches ? e.targetTouches.length : 'n/a'}`);
    parts.push(`ids=${listTouchIds(e.touches)}`);
    ui.append(parts.join(' | '));
  }

  // =============== Install listeners (capture=true) ===============
  const opts = { capture: true, passive: true }; // passive=true：确保不影响默认行为
  pointerEvents.forEach((type) => document.addEventListener(type, onPointer, opts));
  touchEvents.forEach((type) => document.addEventListener(type, onTouch, opts));

  // Mouse（简化输出），同时忽略面板交互与暂停状态
  const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];
  mouseEvents.forEach((type) => {
    document.addEventListener(type, (e) => {
      if (isEventOnPanel(e)) return;
      if (!recording) return;
      const parts = [];
      parts.push(`MOUSE ${e.type}`);
      if (typeof e.buttons === 'number') parts.push(`buttons=${e.buttons}`);
      if (typeof e.button === 'number') parts.push(`button=${e.button}`);
      ui.append(parts.join(' | '));
    }, opts);
  });
})();
