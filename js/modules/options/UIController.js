/**
 * UIController - 负责 UI 交互逻辑（折叠展开、显示隐藏、按钮状态）
 */
import { showToast, setButtonLoading } from '../../utils/index.js';

export class UIController {
  constructor(pathManager) {
    this.pathManager = pathManager;
    this.targetDirSummaryRootEl = null;
    this.targetDirSummaryFullEl = null;
    this.targetDirInput = null;
    this.repoUrlInput = null;
  }

  init(elements) {
    this.targetDirSummaryRootEl = elements.targetDirSummaryRootEl;
    this.targetDirSummaryFullEl = elements.targetDirSummaryFullEl;
    this.targetDirInput = elements.targetDirInput;
    this.repoUrlInput = elements.repoUrlInput;
    this.pushToGithub = elements.pushToGithub;
    this.advancedToggle = elements.advancedToggle;
    this.advancedSection = elements.advancedSection;
  }

  updateTargetDirSummary() {
    const rel = this.pathManager.sanitizePathValue(this.targetDirInput.value, { silent: true });
    const currentRootName = this.pathManager.getCurrentRootName();
    
    if (this.targetDirSummaryRootEl) {
      if (currentRootName) {
        const display = rel ? `/${rel}` : '';
        const localPath = `${currentRootName}${display}`;
        this.targetDirSummaryRootEl.textContent = `本地根目录：${currentRootName} → 存放文件本地路径：${localPath}`;
      } else {
        this.targetDirSummaryRootEl.textContent = "本地根目录：未选择";
      }
    }
    
    if (this.targetDirSummaryFullEl) {
      // 获取仓库信息用于显示 GitHub 路径
      const repoUrl = this.repoUrlInput ? this.repoUrlInput.value.trim() : '';
      let repoName = '';
      if (repoUrl) {
        // 简单提取仓库名
        const match = repoUrl.match(/([^/]+\/[^/]+?)(?:\.git)?$/);
        if (match) {
          repoName = match[1];
        }
      }
      
      if (repoName) {
        const githubPath = rel || '(根目录)';
        this.targetDirSummaryFullEl.textContent = `GitHub 上传路径：${repoName}/${githubPath}`;
      } else {
        this.targetDirSummaryFullEl.textContent = '';
      }
    }
  }

  setupAdvancedToggle() {
    if (!this.advancedToggle || !this.advancedSection) return;
    
    this.advancedToggle.addEventListener('click', () => {
      this.advancedSection.style.display = this.advancedSection.style.display === 'none' ? 'block' : 'none';
    });
  }

  setupInputValidation(inputs) {
    inputs.forEach(input => {
      input.addEventListener("blur", () => {
        if (!input.value.trim()) {
          input.style.borderColor = "var(--color-error)";
        } else {
          input.style.borderColor = "";
        }
      });
      
      input.addEventListener("input", () => {
        if (input.style.borderColor) {
          input.style.borderColor = "";
        }
      });
    });
  }

  setupTestControls(pushControlsEl, testConnectionBtn, testResultEl) {
    try {
      if (!pushControlsEl && this.pushToGithub) {
        const importantToggle = document.querySelector('.important-toggle');
        if (importantToggle) {
          const newDiv = document.createElement('div');
          newDiv.id = 'pushControls';
          newDiv.style.marginLeft = 'auto';
          newDiv.style.display = 'flex';
          newDiv.style.gap = '8px';
          newDiv.style.alignItems = 'center';
          importantToggle.appendChild(newDiv);
          pushControlsEl = newDiv;
        }
      }

      if (pushControlsEl && testConnectionBtn && testResultEl) {
        if (testConnectionBtn.parentElement !== pushControlsEl) {
          pushControlsEl.appendChild(testConnectionBtn);
        }
        if (testResultEl.parentElement !== pushControlsEl) {
          pushControlsEl.appendChild(testResultEl);
        }

        const setEnabled = (enabled) => {
          testConnectionBtn.disabled = !enabled;
          testConnectionBtn.classList.toggle('btn-disabled', !enabled);
          if (!enabled) {
            testResultEl.textContent = '';
            testResultEl.className = 'hint';
          }
        };
        
        setEnabled(!!(this.pushToGithub && this.pushToGithub.checked));
        
        if (this.pushToGithub) {
          this.pushToGithub.addEventListener('change', () => {
            setEnabled(this.pushToGithub.checked);
          });
        }
      }
    } catch (e) {
      // noop
    }
  }

  showSaveSuccess(savedHint) {
    if (savedHint) {
      savedHint.textContent = "已保存";
      savedHint.className = "hint status-success";
    }
    showToast("设置已保存", "success");
    
    setTimeout(() => {
      if (savedHint) {
        savedHint.textContent = "";
        savedHint.className = "hint";
      }
    }, 2000);
  }

  showSaveError(savedHint, error) {
    if (savedHint) {
      savedHint.textContent = "保存失败";
      savedHint.className = "hint status-err";
    }
    showToast("保存失败: " + error.message, "error");
  }
}
