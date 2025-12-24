/**
 * GitHubManager - 负责 GitHub 相关功能（连接测试、Token 管理）
 */
import { showToast, setButtonLoading, parseRepoUrl } from '../../utils/index.js';
import { getGitHubToken, setGitHubToken } from '../../utils/storage.js';

export class GitHubManager {
  constructor() {
    this.tokenInput = null;
    this.testButton = null;
    this.testResultEl = null;
  }

  init(tokenInput, testButton, testResultEl) {
    this.tokenInput = tokenInput;
    this.testButton = testButton;
    this.testResultEl = testResultEl;

    // Show GitHub Token on focus, hide on blur
    if (this.tokenInput) {
      this.tokenInput.addEventListener('focus', () => {
        this.tokenInput.type = 'text';
      });
      this.tokenInput.addEventListener('blur', () => {
        this.tokenInput.type = 'password';
      });
    }
  }

  async loadToken() {
    try {
      const token = await getGitHubToken();
      if (this.tokenInput) {
        this.tokenInput.value = token;
      }
      return token;
    } catch (e) {
      console.error("无法加载 GitHub token:", e);
      return '';
    }
  }

  async saveToken(token) {
    try {
      await setGitHubToken(token || "");
    } catch (e) {
      console.error("保存 GitHub Token 失败:", e);
      throw e;
    }
  }

  async testConnection(repoUrl, branch, pathManager, targetDirInput, updateCallback) {
    if (!this.testResultEl) return;
    
    setButtonLoading(this.testButton, true);
    this.testResultEl.textContent = '';
    this.testResultEl.className = 'hint';
    
    try {
      const token = await getGitHubToken();
      if (!token) {
        this.testResultEl.textContent = '缺少 Token';
        this.testResultEl.className = 'hint status-err';
        return;
      }
      
      const parsed = parseRepoUrl(repoUrl.trim());
      if (!parsed) {
        this.testResultEl.textContent = '仓库地址格式错误';
        this.testResultEl.className = 'hint status-err';
        return;
      }
      
      const branchName = (branch || '').trim() || 'main';
      const repoApi = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      const repoRes = await fetch(repoApi, { headers: { Authorization: `token ${token}` } });
      
      if (!repoRes.ok) {
        if (repoRes.status === 404) {
          this.testResultEl.textContent = '仓库未找到或无权限';
        } else if (repoRes.status === 401) {
          this.testResultEl.textContent = 'Token 无效';
        } else {
          this.testResultEl.textContent = `错误: ${repoRes.status}`;
        }
        this.testResultEl.className = 'hint status-err';
        return;
      }
      
      const branchApi = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches/${encodeURIComponent(branchName)}`;
      const branchRes = await fetch(branchApi, { headers: { Authorization: `token ${token}` } });
      
      if (!branchRes.ok) {
        if (branchRes.status === 404) {
          this.testResultEl.textContent = `分支 ${branchName} 不存在`;
        } else {
          this.testResultEl.textContent = `分支检查失败: ${branchRes.status}`;
        }
        this.testResultEl.className = 'hint status-err';
        return;
      }
      
      this.testResultEl.textContent = `仓库 ${parsed.owner}/${parsed.repo} · 分支 ${branchName} 可用`;
      this.testResultEl.className = 'hint status-success';
      
      const DEFAULT_TARGET_DIR = "src/content/posts/dynamic/journals";
      const currentTarget = pathManager.normalizeRelativePath(targetDirInput.value || '');
      if (!currentTarget || currentTarget === DEFAULT_TARGET_DIR) {
        targetDirInput.value = DEFAULT_TARGET_DIR;
        if (updateCallback) updateCallback();
        showToast(`已检测到仓库 ${parsed.owner}/${parsed.repo}，内容目录已自动设为：${DEFAULT_TARGET_DIR}`, 'success', 4000);
      }
    } catch (e) {
      console.error('测试连接失败', e);
      this.testResultEl.textContent = '测试失败（查看控制台）';
      this.testResultEl.className = 'hint status-err';
    } finally {
      setButtonLoading(this.testButton, false);
    }
  }
}
