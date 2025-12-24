/**
 * PathManager - 负责路径处理、规范化和建议
 */
import { showToast } from '../../utils/index.js';
import { HANDLE_CLEARED_KEY } from '../../constants.js';

const ABSOLUTE_PATH_REGEX = /^([A-Za-z]:[\\/]|\\\\|\/)/;

export class PathManager {
  constructor() {
    this.currentRootName = '';
    this.SUGGEST_DISMISS_KEY = 'dw_target_suggestion_dismissed_v1';
  }

  setCurrentRootName(name) {
    this.currentRootName = name || '';
  }

  getCurrentRootName() {
    return this.currentRootName;
  }

  normalizeRelativePath(value) {
    if (!value) return '';
    return String(value)
      .trim()
      .replace(/\\+/g, '/')
      .replace(/\/{2,}/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  convertAbsoluteToRelative(rawPath) {
    if (!rawPath) return '';
    let normalized = String(rawPath).trim().replace(/\\/g, '/');
    
    if (this.currentRootName) {
      const marker = `/${this.currentRootName}/`;
      const idx = normalized.lastIndexOf(marker);
      if (idx >= 0) {
        normalized = normalized.slice(idx + marker.length);
      }
    }
    
    const markerCandidates = ['/src/', '/content/', '/posts/'];
    for (const marker of markerCandidates) {
      const idx = normalized.indexOf(marker);
      if (idx >= 0) {
        normalized = normalized.slice(idx + 1);
        break;
      }
    }
    
    normalized = normalized.replace(/^([A-Za-z]:\/|\/)+/i, '');
    return this.normalizeRelativePath(normalized);
  }

  sanitizePathValue(value, { silent } = {}) {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    const normalized = this.normalizeRelativePath(trimmed);
    
    if (ABSOLUTE_PATH_REGEX.test(trimmed)) {
      const relative = this.convertAbsoluteToRelative(trimmed) || normalized;
      if (!silent && relative !== normalized) {
        showToast("已将绝对路径转换为相对路径", "warning");
      }
      return relative;
    }
    
    return normalized;
  }

  async shouldShowSuggestionFor(suggested) {
    try {
      if (!suggested) return false;
      const obj = await chrome.storage.local.get([this.SUGGEST_DISMISS_KEY]);
      const dismissed = obj && obj[this.SUGGEST_DISMISS_KEY] ? String(obj[this.SUGGEST_DISMISS_KEY]) : '';
      if (dismissed && dismissed === suggested) return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  async showTargetSuggestionBanner(suggested, targetDirInput, updateCallback) {
    try {
      if (!suggested) return;
      
      let banner = document.getElementById('targetDirSuggestion');
      if (!banner) {
        const container = document.createElement('div');
        container.id = 'targetDirSuggestion';
        container.style.display = 'none';
        container.style.marginTop = '8px';
        container.innerHTML = `
          <div class="hint suggestion-banner" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
            <div id="targetDirSuggestionText" style="flex:1;"></div>
            <div style="display:flex;gap:8px;margin-left:12px;">
              <button id="applySuggestionBtn" class="btn btn-primary">采纳</button>
              <button id="dismissSuggestionBtn" class="btn">忽略</button>
            </div>
          </div>
        `;
        const parent = targetDirInput?.closest('.field') || document.querySelector('.container');
        if (parent) parent.appendChild(container);
        banner = container;
      }

      if (!(await this.shouldShowSuggestionFor(suggested))) {
        banner.style.display = 'none';
        return;
      }

      const textEl = document.getElementById('targetDirSuggestionText');
      const applyBtn = document.getElementById('applySuggestionBtn');
      const dismissBtn = document.getElementById('dismissSuggestionBtn');
      
      if (textEl) textEl.textContent = `建议将保存路径设为：${suggested}`;
      banner.style.display = 'block';

      const cleanup = () => {
        try { banner.style.display = 'none'; } catch (e) { /* ignore */ }
        if (applyBtn) applyBtn.removeEventListener('click', onApply);
        if (dismissBtn) dismissBtn.removeEventListener('click', onDismiss);
      };

      const onApply = () => {
        try {
          const normalized = this.sanitizePathValue(suggested) || suggested;
          targetDirInput.value = normalized;
          if (updateCallback) updateCallback();
          try { chrome.storage.local.remove(this.SUGGEST_DISMISS_KEY); } catch (e) { /* ignore */ }
        } finally {
          cleanup();
          showToast('已应用建议的保存路径', 'success');
        }
      };

      const onDismiss = async () => {
        try {
          const payload = String(suggested);
          try { await chrome.storage.local.set({ [this.SUGGEST_DISMISS_KEY]: payload }); } catch (e) { /* ignore */ }
        } finally {
          cleanup();
          showToast('已忽略该建议', 'warning');
        }
      };

      if (applyBtn) {
        applyBtn.removeEventListener('click', onApply);
        applyBtn.addEventListener('click', onApply);
      }
      if (dismissBtn) {
        dismissBtn.removeEventListener('click', onDismiss);
        dismissBtn.addEventListener('click', onDismiss);
      }
    } catch (e) {
      // fail silently
    }
  }
}
