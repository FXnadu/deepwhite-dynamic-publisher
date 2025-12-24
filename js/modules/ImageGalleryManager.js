/**
 * ImageGalleryManager.js
 * 职责：图片画廊渲染、交互、预览
 */

import { showToast, showConfirm } from '../utils/index.js';
import { saveDraft } from './DraftManager.js';
import { updateWordCount } from './UIManager.js';

// 缓存对象 URL 以便清理
let __galleryObjectUrls = [];
let __galleryOutsideHandler = null;

// 在光标位置插入文本
export function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const newValue = val.slice(0, start) + text + val.slice(end);
  const cursorPos = start + text.length;
  
  // 使用 execCommand 插入文本（如果支持），这样可以保持撤销历史
  // 并且不会触发某些浏览器的光标重置问题
  textarea.focus();
  textarea.setSelectionRange(start, end);
  
  if (document.execCommand) {
    // execCommand 会自动把光标放在插入文本的末尾
    document.execCommand('insertText', false, text);
  } else {
    // 回退方案
    textarea.value = newValue;
    textarea.setSelectionRange(cursorPos, cursorPos);
  }
  
  // 确保光标在正确位置
  setTimeout(() => {
    textarea.setSelectionRange(cursorPos, cursorPos);
  }, 0);
}

// 从文本中解析图片 URL
function parseImageUrlsFromText(text) {
  if (!text) return [];
  const urls = [];
  const re = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\n]+?))(?:\s+"[^"]*")?\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const raw = (m[1] || m[2] || '').trim();
      if (raw) {
        urls.push(raw);
      }
    } catch (e) { /* ignore */ }
  }
  return urls;
}

// 从文本中移除指定图片的 Markdown
function removeImageMarkdownFromText(text, url) {
  if (!text || !url) return text;
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`!\\[[^\\]]*\\]\\(\\s*${escaped}\\s*\\)`, 'g'),
    new RegExp(`!\\[[^\\]]*\\]\\(\\s*<${escaped}>\\s*\\)`, 'g'),
    new RegExp(`!\\[[^\\]]*\\]\\(\\s*${escaped}\\s+"[^"]*"\\s*\\)`, 'g')
  ];
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

// 显示图片预览模态框
function showImagePreview(url) {
  try {
    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.tabIndex = -1;

    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    modal.appendChild(img);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const remove = () => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
    };

    overlay.addEventListener('click', remove);
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') remove();
    });
    overlay.focus();
  } catch (e) {
    console.error('显示图片预览失败', e);
  }
}

// 禁用画廊外部点击关闭
function disableGalleryOutsideClose() {
  if (!__galleryOutsideHandler) return;
  try { document.removeEventListener('click', __galleryOutsideHandler); } catch (e) {}
  __galleryOutsideHandler = null;
}

// 渲染图片画廊
export function renderImageGalleryFromText(text) {
  try {
    const gallery = document.getElementById('imageGallery');
    if (!gallery) return;
    
    try { gallery.style.height = ''; } catch (_) {}
    const urls = parseImageUrlsFromText(text);
    
    // 去重
    const seen = new Set();
    const unique = [];
    for (const u of urls) {
      if (!seen.has(u)) {
        seen.add(u);
        unique.push(u);
      }
    }
    
    // 限制最多 40 张
    const list = unique.slice(-40);
    
    // 清理旧的对象 URL
    try {
      for (const u of __galleryObjectUrls) {
        try { URL.revokeObjectURL(u); } catch (e) {}
      }
    } catch (e) {}
    __galleryObjectUrls = [];
    gallery.innerHTML = '';

    if (list.length === 0) {
      gallery.classList.add('empty');
      
      if (!gallery.classList.contains('open')) {
        gallery.classList.remove('open');
        gallery.innerHTML = '';
        const trigger = document.createElement('div');
        trigger.className = 'empty-trigger';
        trigger.style.height = '18px';
        trigger.style.width = '100%';
        trigger.style.cursor = 'pointer';
        trigger.title = '添加图片';
        
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          if (gallery.classList.contains('open')) {
            gallery.classList.remove('open');
            try { disableGalleryOutsideClose(); } catch (_) {}
            try { renderImageGalleryFromText((document.getElementById('editor') || {}).value || ""); } catch (_) {}
          } else {
            try {
              const desired = (window.__galleryDesiredOpenHeight && Number(window.__galleryDesiredOpenHeight)) ? Number(window.__galleryDesiredOpenHeight) : 154;
              gallery.style.setProperty('--dw-gallery-open-height', desired + 'px');
            } catch (e) { /* ignore */ }
            gallery.classList.add('open');
            renderImageGalleryFromText(text);
          }
        });
        
        gallery.appendChild(trigger);
        return;
      }

      // 画廊打开但为空
      gallery.innerHTML = '';
      try {
        const desired = (window.__galleryDesiredOpenHeight && Number(window.__galleryDesiredOpenHeight)) ? Number(window.__galleryDesiredOpenHeight) : 154;
        gallery.style.setProperty('--dw-gallery-open-height', desired + 'px');
      } catch (e) {
        gallery.style.setProperty('--dw-gallery-open-height', '154px');
      }

      const emptyHintEl = document.createElement('div');
      emptyHintEl.className = 'empty-hint';
      emptyHintEl.textContent = '暂无图片，按 Ctrl/Cmd+V 粘贴以添加';
      gallery.appendChild(emptyHintEl);

      const uploadPanel = document.createElement('div');
      uploadPanel.className = 'upload-panel';
      uploadPanel.innerHTML = `<div id="uploadStatus" style="color:var(--color-text-subtle);font-size:13px;"></div>`;
      gallery.appendChild(uploadPanel);

      emptyHintEl.addEventListener('click', (ev) => {
        ev.preventDefault();
        try { gallery.classList.remove('open'); } catch (_) {}
        try { disableGalleryOutsideClose(); } catch (_) {}
        try { renderImageGalleryFromText((document.getElementById('editor') || {}).value || ""); } catch (_) {}
      });

      uploadPanel.addEventListener('click', (ev) => {
        try {
          if (ev.target === uploadPanel) {
            gallery.classList.remove('open');
            disableGalleryOutsideClose();
            try { renderImageGalleryFromText((document.getElementById('editor') || {}).value || ""); } catch (_) {}
          }
        } catch (err) { /* ignore */ }
      });

      gallery.classList.add('empty');
      return;
    } else {
      gallery.classList.remove('empty');
      gallery.classList.remove('open');
    }

    // 渲染图片列表
    for (const u of list) {
      const item = document.createElement('div');
      item.className = 'image-item';
      const a = document.createElement('a');
      a.href = u;
      a.target = '_blank';
      const img = document.createElement('img');
      img.src = '';
      
      if (/^https?:\/\//i.test(u)) {
        img.src = u;
      } else {
        // 尝试加载本地文件
        (async () => {
          try {
            const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') ? await window.getSavedDirectoryHandle() : null;
            if (!dirHandle) return;
            
            const parts = String(u).replace(/^\/+/, '').split('/').filter(Boolean);
            if (parts.length === 0) return;
            const filename = parts.pop();
            let current = dirHandle;
            
            for (const seg of parts) {
              try {
                current = await current.getDirectoryHandle(seg, { create: false });
              } catch (e) {
                current = null;
                break;
              }
            }
            if (!current) return;
            
            try {
              const fileHandle = await current.getFileHandle(filename, { create: false });
              const file = await fileHandle.getFile();
              const objUrl = URL.createObjectURL(file);
              img.src = objUrl;
              __galleryObjectUrls.push(objUrl);
            } catch (e) { /* ignore */ }
          } catch (e) { /* ignore */ }
        })();
      }
      
      img.alt = '';
      a.appendChild(img);
      
      const meta = document.createElement('div');
      meta.className = 'meta';
      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.marginTop = '6px';

      // 复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-icon';
      copyBtn.title = '复制图片链接';
      copyBtn.setAttribute('aria-label', '复制图片链接');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      copyBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        try {
          if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(u);
          } else {
            const ta = document.createElement('textarea');
            ta.value = u;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showToast('图片链接已复制', 'success', 1200);
        } catch (err) {
          console.error('复制图片链接失败', err);
          showToast('复制失败', 'error', 1500);
        }
      });

      // 删除按钮
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-icon btn-text-danger';
      delBtn.title = '从文档中删除该图片';
      delBtn.setAttribute('aria-label', '删除图片链接');
      delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-label="delete"><path fill="#E53935" d="M9 4.5c0-.55.45-1 1-1h4c.55 0 1 .45 1 1V5h2.2c.66 0 1.1.44 1.1 1.1 0 .39-.31.7-.7.7H6.4a.7.7 0 0 1-.7-.7c0-.66.44-1.1 1.1-1.1H9v-.5z"/><path fill="#E53935" d="M7.4 8.2h9.2l-.6 10.6c-.05.9-.8 1.6-1.7 1.6H9.7c-.9 0-1.65-.7-1.7-1.6l-.6-10.6z"/><rect x="10.2" y="10" width="1.2" height="7.6" rx=".6" fill="#fff"/><rect x="12.4" y="10" width="1.2" height="7.6" rx=".6" fill="#fff"/></svg>`;
      delBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const ok = await showConfirm('删除图片', '确定要从文档中删除该图片链接吗？此操作可恢复（撤销）', '删除', '取消');
        if (!ok) return;
        try {
          const ta = document.getElementById('editor');
          if (!ta) return;
          const original = ta.value;
          const updated = removeImageMarkdownFromText(original, u);
          ta.value = updated;
          updateWordCount(updated);
          renderImageGalleryFromText(updated);
          await saveDraft(updated);
          showToast('图片链接已从文档中移除', 'success', 1400);
        } catch (e) {
          console.error('删除图片失败', e);
          showToast('删除失败', 'error', 1500);
        }
      });

      controls.appendChild(copyBtn);
      controls.appendChild(delBtn);
      meta.appendChild(controls);
      
      // 点击图片预览
      img.addEventListener('click', (ev) => {
        ev.preventDefault();
        showImagePreview(u);
      });
      
      item.appendChild(a);
      item.appendChild(meta);
      gallery.appendChild(item);
    }
    
    // 记住画廊高度
    try {
      try { gallery.style.height = ''; } catch (_) {}
      const measured = (gallery.getBoundingClientRect && gallery.getBoundingClientRect().height) || gallery.offsetHeight || 0;
      if (measured && measured > 0) {
        window.__galleryDesiredOpenHeight = Math.round(measured);
        try {
          gallery.style.setProperty('--dw-gallery-open-height', String(window.__galleryDesiredOpenHeight) + 'px');
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.error('渲染图片画廊失败', e);
  }
}
