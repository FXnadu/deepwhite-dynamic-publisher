/**
 * UI 工具函数
 * 包含 Toast、Modal、Dialog 等 UI 交互组件
 */

/**
 * 显示Toast通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型: 'success' | 'error' | 'warning'
 * @param {number} duration - 显示时长（毫秒）
 */
export function showToast(message, type = 'success', duration = 3000) {
  // Ensure a toast container exists for stacking multiple toasts
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    // Styles kept minimal here; main styling lives in CSS
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.bottom = '20px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.alignItems = 'flex-end';
    container.style.zIndex = '2000';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  // Initial state for animation
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(20px)';
  toast.style.transition = 'opacity 0.18s ease, transform 0.18s ease';

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  const removeToast = () => {
    // exit animation
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => {
      if (container && container.contains(toast)) container.removeChild(toast);
      // remove container when empty
      if (container && container.childElementCount === 0 && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 220);
  };

  const timer = setTimeout(removeToast, duration);
  // allow click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {string} confirmText - 确认按钮文字
 * @param {string} cancelText - 取消按钮文字
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, confirmText = '确认', cancelText = '取消') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '对话框');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer">
        <button class="btn" data-action="cancel">${cancelText}</button>
        <button class="btn btn-primary" data-action="confirm">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Accessibility: focus management
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (firstFocusable) firstFocusable.focus();

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
    };

    const handleAction = (action) => {
      cleanup();
      resolve(action === 'confirm');
    };

    const modalClickHandler = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        handleAction(action);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction('cancel');
        return;
      }
      if (e.key === 'Tab') {
        // trap focus inside modal
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 显示多选对话框（用于处理存在同名文件时的用户选择）
 * @param {string} title - 标题
 * @param {string} message - 消息内容（可以包含简短的已有文件预览）
 * @param {Array<{id:string,label:string,btnClass?:string}>} choices - 选项列表，返回所选项的 id
 * @returns {Promise<string>} - 解析为所选 choice.id，点击遮罩相当于取消并返回 'cancel'
 */
export function showChoice(title, message, choices = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal modal-choice';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '选择对话框');

    const buttonsHtml = choices.map(c => {
      const cls = c.btnClass ? ` ${c.btnClass}` : '';
      return `<button class="btn${cls}" data-choice="${c.id}">${c.label}</button>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer choice-footer">
        ${buttonsHtml}
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Accessibility: focus management
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (firstFocusable) firstFocusable.focus();

    const cleanup = (choiceId) => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
      resolve(choiceId);
    };

    const modalClickHandler = (e) => {
      const choiceId = e.target.dataset.choice;
      if (choiceId) {
        cleanup(choiceId);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        cleanup('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup('cancel');
        return;
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 显示带文本输入的模态对话框
 * @param {string} title
 * @param {string} message
 * @param {string} defaultValue
 * @param {string} confirmText
 * @param {string} cancelText
 * @returns {Promise<string|null>} - 确认返回输入值，取消返回 null
 */
export function showPrompt(title, message, defaultValue = '', confirmText = '确定', cancelText = '取消') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '输入对话框');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">
        <div class="prompt-message">${message}</div>
        <div style="margin-top:10px;"><input id="modal-input" class="input" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn" data-action="cancel">${cancelText}</button>
        <button class="btn btn-primary" data-action="confirm">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const inputEl = modal.querySelector('#modal-input');
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (inputEl) inputEl.focus();

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
    };

    const handleAction = (action) => {
      if (action === 'confirm') {
        const val = inputEl ? inputEl.value : '';
        cleanup();
        resolve(val);
      } else {
        cleanup();
        resolve(null);
      }
    };

    const modalClickHandler = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        handleAction(action);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction('cancel');
        return;
      }
      if (e.key === 'Enter') {
        // Enter should confirm if input is focused
        if (document.activeElement === inputEl) {
          e.preventDefault();
          handleAction('confirm');
        }
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 设置按钮加载状态
 * @param {HTMLElement} button - 按钮元素
 * @param {boolean} loading - 是否加载中
 */
export function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    try {
      // Force black spinner color and rely on CSS to hide button text
      button.style.setProperty('--btn-loading-color', '#000');
      button.dataset.loadingColor = '#000';
    } catch (e) { /* ignore color detection errors */ }
    button.classList.add('btn-loading');
  } else {
    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset && button.dataset.loadingColor) {
      try {
        button.style.removeProperty('--btn-loading-color');
      } catch (e) { /* ignore cleanup errors */ }
      delete button.dataset.loadingColor;
    }
  }
}

/**
 * 打开设置页面并激活标签页
 */
export async function openSettingsPage() {
  const optionsUrl = chrome.runtime.getURL("options.html");
  
  try {
    // 先查找是否已经打开了设置页面
    const tabs = await chrome.tabs.query({ url: optionsUrl });
    
    if (tabs && tabs.length > 0) {
      // 已经打开了，激活它
      const tab = tabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      // 聚焦窗口
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } else {
      // 没有打开，创建新标签页
      const tab = await chrome.tabs.create({ url: optionsUrl, active: true });
      // 聚焦窗口
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    }
  } catch (e) {
    // 回退方案：直接创建
    chrome.tabs.create({ url: optionsUrl, active: true });
  }
}
