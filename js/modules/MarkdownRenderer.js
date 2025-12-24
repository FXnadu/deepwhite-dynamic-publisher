/**
 * MarkdownRenderer.js
 * 职责：Markdown 语法高亮渲染、滚动同步
 */

import { renderImageGalleryFromText } from './ImageGalleryManager.js';

const HIGHLIGHT_MAX_CHARS = 50000;
let __cachedLineHeight = null;
let __timers = {
  inputUpdateTimer: null,
  idleCallbackId: null,
  lastInputValue: ""
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getLineHeight(editor) {
  if (__cachedLineHeight) return __cachedLineHeight;
  
  try {
    const style = window.getComputedStyle(editor);
    let lh = parseFloat(style.lineHeight);
    if (Number.isFinite(lh) && lh > 0) {
      __cachedLineHeight = lh;
      return lh;
    }
  } catch (e) { /* ignore */ }
  
  try {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre';
    div.style.font = window.getComputedStyle(editor).font;
    div.textContent = 'A';
    document.body.appendChild(div);
    const measured = div.getBoundingClientRect().height;
    document.body.removeChild(div);
    __cachedLineHeight = measured || 16;
    return __cachedLineHeight;
  } catch (e) {
    __cachedLineHeight = 16;
    return 16;
  }
}

function renderHighlight(text) {
  if (!text && text !== "") return "";
  
  let escaped = escapeHtml(text);
  if (escaped.endsWith("\n")) escaped = escaped.replace(/\n$/," \n");

  // Headings
  escaped = escaped.replace(/^([ \t]*)(#{1,6})(?=\s)/gm, (_, p1, hashes) => {
    return p1 + `<span class="md-sym md-heading">${hashes}</span>`;
  });

  // Inline code
  escaped = escaped.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<span class="md-code">\`${escapeHtml(code)}\`</span>`;
  });

  // Bold
  escaped = escaped.replace(/\*\*([^\*\n]+)\*\*/g, (_, inner) => {
    return `<span class="md-sym md-bold">**</span>${escapeHtml(inner)}<span class="md-sym md-bold">**</span>`;
  });

  // Links
  escaped = escaped.replace(/\[([^\]\n]+)\]\(([^\)\n]+)\)/g, (_, t, u) => {
    return `<span class="md-link">[${escapeHtml(t)}](${escapeHtml(u)})</span>`;
  });

  // Images (must come after links to avoid conflicts)
  escaped = escaped.replace(/!\[([^\]\n]*)\]\(([^\)\n]+)\)/g, (_, alt, url) => {
    return `<span class="md-image">![${escapeHtml(alt)}](${escapeHtml(url)})</span>`;
  });

  escaped = escaped.replace(/\n/g, "<br/>");
  return escaped;
}

// 渲染大文件时的虚拟滚动高亮（提取公共逻辑）
function renderVirtualHighlight(editor, highlightEl, text) {
  const lineHeight = getLineHeight(editor);
  const totalLines = text.split('\n').length;
  const startLine = Math.max(0, Math.floor(editor.scrollTop / lineHeight));
  const visibleLines = Math.max(1, Math.ceil(editor.clientHeight / lineHeight) + 2);
  const endLine = Math.min(totalLines, startLine + visibleLines);
  const lines = text.split('\n');
  const chunk = lines.slice(startLine, endLine).join('\n');
  const topPad = startLine * lineHeight;
  const bottomPad = Math.max(0, (totalLines - endLine) * lineHeight);
  const rendered = renderHighlight(chunk || "");
  highlightEl.innerHTML = `<div style="height:${topPad}px"></div>${rendered}<div style="height:${bottomPad}px"></div>`;
}

function updateHighlight(editor, highlightEl, value) {
  if (!highlightEl) return;
  const text = value || "";
  
  if (text.length <= HIGHLIGHT_MAX_CHARS) {
    highlightEl.innerHTML = renderHighlight(text);
    return;
  }

  try {
    renderVirtualHighlight(editor, highlightEl, text);
  } catch (e) {
    highlightEl.textContent = "";
  }
}

function updateVisibleHighlightNow(editor, highlightEl, value) {
  if (!highlightEl) return;
  
  try {
    const text = (typeof value === 'string') ? value : (editor && editor.value) || "";
    
    if (text.length <= HIGHLIGHT_MAX_CHARS) {
      highlightEl.innerHTML = renderHighlight(text);
      return;
    }
    
    renderVirtualHighlight(editor, highlightEl, text);
  } catch (e) {
    // swallow errors
  }
}

export function scheduleInputUpdate(editor, highlightEl, value, onUpdate) {
  __timers.lastInputValue = value;
  
  if (__timers.inputUpdateTimer) {
    clearTimeout(__timers.inputUpdateTimer);
  }
  
  __timers.inputUpdateTimer = setTimeout(() => {
    __timers.inputUpdateTimer = null;
    
    requestAnimationFrame(() => {
      if (onUpdate) onUpdate(__timers.lastInputValue);
    });

    const doHighlight = () => {
      try {
        if (!highlightEl) return;
        if (__timers.lastInputValue.length <= HIGHLIGHT_MAX_CHARS) {
          updateHighlight(editor, highlightEl, __timers.lastInputValue);
        } else {
          const truncated = escapeHtml(__timers.lastInputValue.slice(0, 2000)).replace(/\n/g, "<br/>");
          highlightEl.innerHTML = `${truncated}<br/><div style="color:var(--color-meta);font-size:12px;margin-top:6px;">（高亮已禁用：文件过大）</div>`;
        }
      } catch (e) {
        // ignore
      }
    };

    if (typeof requestIdleCallback === 'function') {
      if (__timers.idleCallbackId) {
        cancelIdleCallback(__timers.idleCallbackId);
        __timers.idleCallbackId = null;
      }
      __timers.idleCallbackId = requestIdleCallback(() => {
        __timers.idleCallbackId = null;
        doHighlight();
        renderImageGalleryFromText(__timers.lastInputValue);
      }, { timeout: 600 });
    } else {
      requestAnimationFrame(() => { 
        doHighlight(); 
        renderImageGalleryFromText(__timers.lastInputValue);
      });
    }
  }, 150);
}

export function initHighlight(editor, highlightEl, initialValue) {
  updateHighlight(editor, highlightEl, initialValue);
  return { updateHighlight, updateVisibleHighlightNow };
}

export function setupScrollSync(editor, highlightEl) {
  if (!highlightEl) return;
  
  let __scrolling = false;
  let __lastScrollTop = -1;
  let __lastScrollLeft = -1;
  let __lastVisibleStartLine = -1;
  const SCROLL_EPSILON = 1;
  
  editor.addEventListener("scroll", () => {
    if (__scrolling) return;
    __scrolling = true;
    
    requestAnimationFrame(() => {
      try {
        const scrollTop = editor.scrollTop;
        const scrollLeft = editor.scrollLeft;
        
        if (Math.abs(scrollTop - __lastScrollTop) >= SCROLL_EPSILON) {
          highlightEl.scrollTop = scrollTop;
          __lastScrollTop = scrollTop;
        }
        if (Math.abs(scrollLeft - __lastScrollLeft) >= SCROLL_EPSILON) {
          highlightEl.scrollLeft = scrollLeft;
          __lastScrollLeft = scrollLeft;
        }

        if (editor.value && editor.value.length > HIGHLIGHT_MAX_CHARS) {
          try {
            const lineHeight = getLineHeight(editor);
            const startLine = Math.max(0, Math.floor(scrollTop / lineHeight));
            if (startLine !== __lastVisibleStartLine) {
              __lastVisibleStartLine = startLine;
              updateHighlight(editor, highlightEl, editor.value);
            }
          } catch (e) {
            // ignore
          }
        }
      } finally {
        __scrolling = false;
      }
    });
  }, { passive: true });
}

export { updateHighlight, updateVisibleHighlightNow };
