/**
 * PicGoManager - 负责 PicGo 图床配置和连接测试
 */
import { setButtonLoading } from '../../utils/index.js';

export class PicGoManager {
  constructor() {
    this.endpointInput = null;
    this.tokenInput = null;
    this.autoUploadInput = null;
    this.uploadFormatSelect = null;
    this.testButton = null;
    this.testResultEl = null;
  }

  init(endpointInput, tokenInput, autoUploadInput, uploadFormatSelect, testButton, testResultEl) {
    this.endpointInput = endpointInput;
    this.tokenInput = tokenInput;
    this.autoUploadInput = autoUploadInput;
    this.uploadFormatSelect = uploadFormatSelect;
    this.testButton = testButton;
    this.testResultEl = testResultEl;
  }

  loadSettings(settings) {
    if (this.endpointInput) this.endpointInput.value = settings.picgoEndpoint || "";
    if (this.uploadFormatSelect) this.uploadFormatSelect.value = settings.picgoUploadFormat || 'auto';
    if (this.tokenInput) this.tokenInput.value = settings.picgoToken || "";
  }

  getSettings() {
    return {
      picgoEndpoint: this.endpointInput ? (this.endpointInput.value || '').trim() : '',
      picgoUploadFormat: this.uploadFormatSelect ? (this.uploadFormatSelect.value || 'auto') : 'auto',
      picgoToken: this.tokenInput ? (this.tokenInput.value || '').trim() : ''
    };
  }

  async testConnection() {
    if (!this.testResultEl) return;
    
    const endpoint = this.endpointInput ? (this.endpointInput.value || '').trim() : '';
    const token = this.tokenInput ? (this.tokenInput.value || '').trim() : '';
    
    this.testResultEl.textContent = '';
    this.testResultEl.className = 'hint';
    
    if (!endpoint) {
      this.testResultEl.textContent = '请先填写 PicGo Endpoint';
      this.testResultEl.className = 'hint status-err';
      return;
    }
    
    setButtonLoading(this.testButton, true);
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      // First try a lightweight OPTIONS probe
      let probeOk = false;
      try {
        const probeRes = await fetch(endpoint, { method: 'OPTIONS', signal: controller.signal });
        if (probeRes && (probeRes.status >= 200 && probeRes.status < 400)) {
          probeOk = true;
          this.testResultEl.textContent = `可访问（HTTP ${probeRes.status}）`;
          this.testResultEl.className = 'hint status-success';
        }
      } catch (probeErr) {
        // probe may fail if server disallows OPTIONS; ignore and fall back to POST probe
      } finally {
        clearTimeout(timeout);
      }

      if (!probeOk) {
        // Fallback: try a small POST with synthetic blob
        const fd = new FormData();
        const blob = new Blob(['ping'], { type: 'image/png' });
        fd.append('file', blob, 'dw-ping.png');
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 8000);
        
        try {
          const headers = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(endpoint, { method: 'POST', body: fd, headers, signal: controller2.signal });
          
          if (res.ok) {
            this.testResultEl.textContent = `可上传（HTTP ${res.status}）`;
            this.testResultEl.className = 'hint status-success';
          } else {
            const txt = await res.text().catch(() => '');
            this.testResultEl.textContent = `错误 ${res.status}: ${txt ? txt.slice(0, 200) : res.statusText}`;
            this.testResultEl.className = 'hint status-err';
          }
        } finally {
          clearTimeout(timeout2);
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') {
        this.testResultEl.textContent = '请求超时（服务器未响应）';
      } else {
        this.testResultEl.textContent = `测试失败：${e && e.message ? e.message : String(e)}`;
      }
      this.testResultEl.className = 'hint status-err';
      console.error('PicGo 测试连接失败:', e);
    } finally {
      setButtonLoading(this.testButton, false);
    }
  }
}
