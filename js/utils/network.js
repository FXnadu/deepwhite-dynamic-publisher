/**
 * 网络请求工具函数
 * 包含 GitHub API 和 PicGo 上传功能
 */

import { formatDate } from './format.js';

/**
 * Create or update a file in a repo via GitHub Contents API.
 * @param {Object} params - { owner, repo, path, branch, message, contentBase64, token }
 * @returns {Promise<Object>}
 */
export async function githubPutFile({ owner, repo, path, branch = 'main', message, contentBase64, token }) {
  if (!token) throw new Error('Missing GitHub token');
  // Encode each path segment but preserve '/' so GitHub API receives proper path
  const encodedPath = String(path || '').split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  // Helper function to get current file SHA
  const getCurrentSha = async () => {
    try {
      const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (getRes.ok) {
        const json = await getRes.json();
        return json.sha;
      }
    } catch (e) {
      // ignore - file might not exist
    }
    return null;
  };

  // Try fetch existing file to get sha (if exists)
  let sha = await getCurrentSha();

  const body = {
    message: message || `Add ${path}`,
    content: contentBase64,
    branch
  };
  if (sha) body.sha = sha;

  let res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  // If we get a 409 conflict, retry once with fresh SHA
  if (res.status === 409) {
    console.log('GitHub API 409 conflict detected, retrying with fresh SHA...');
    sha = await getCurrentSha();
    body.sha = sha;
    
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  if (!res.ok) {
    // Try to parse JSON error body for clearer messaging, fallback to text.
    let bodyText = '';
    try {
      const txt = await res.text();
      bodyText = txt || '';
      try {
        const parsedErr = bodyText ? JSON.parse(bodyText) : null;
        if (parsedErr && parsedErr.message) {
          throw new Error(`GitHub API error: ${res.status} ${parsedErr.message}`);
        }
      } catch (parseErr) {
        // not JSON or no message field - fall through to using raw text
      }
    } catch (readErr) {
      bodyText = String(readErr);
    }
    // Provide common status hints
    if (res.status === 401) {
      throw new Error(`GitHub API error: 401 Unauthorized. 请检查 token 是否有效.`);
    } else if (res.status === 403) {
      throw new Error(`GitHub API error: 403 Forbidden. 可能是权限不足或速率限制.`);
    } else if (res.status === 404) {
      throw new Error(`GitHub API error: 404 Not Found. 仓库或路径不存在或无权限访问.`);
    } else if (res.status === 409) {
      throw new Error(`GitHub API error: 409 Conflict. 文件已被修改，请重试.`);
    }
    throw new Error(`GitHub API error: ${res.status} ${bodyText}`);
  }
  return await res.json();
}

/**
 * Parse repository identifier into owner and repo.
 * Accepts formats:
 * - owner/repo
 * - https://github.com/owner/repo(.git)?
 * - git@github.com:owner/repo.git
 * Returns { owner, repo } or null if invalid.
 */
export function parseRepoUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  // owner/repo
  const m1 = s.match(/^([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/);
  if (m1) return { owner: m1[1], repo: m1[2] };
  // https://github.com/owner/repo or with .git
  const m2 = s.match(/^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\.git)?(?:\/)?$/i);
  if (m2) return { owner: m2[1], repo: m2[2] };
  // git@github.com:owner/repo.git
  const m3 = s.match(/^git@github\.com:([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/i);
  if (m3) return { owner: m3[1], repo: m3[2] };
  return null;
}

/**
 * Encode a UTF-8 string into base64 safely (handles large inputs).
 * @param {string} str
 * @returns {string}
 */
export function encodeBase64Utf8(str) {
  if (typeof str !== 'string') str = String(str || '');
  // Preferred approach: use TextEncoder to get UTF-8 bytes and btoa over binary string
  try {
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }
  } catch (e) {
    // fallback to legacy transform
  }
  // Fallback for older environments (avoid deprecated unescape)
  const utf8Bytes = [];
  const encoded = encodeURIComponent(str);
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      utf8Bytes.push(parseInt(encoded.substr(i + 1, 2), 16));
      i += 2;
    } else {
      utf8Bytes.push(encoded.charCodeAt(i));
    }
  }
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

/**
 * Upload an image Blob to a PicGo HTTP endpoint.
 * @param {string} endpoint - PicGo HTTP upload endpoint, e.g. http://localhost:36677/upload
 * @param {Blob|File} blob - image blob
 * @param {string} token - optional token to send as Authorization Bearer
 * @returns {Promise<string>} - resolved image URL
 */
export async function uploadToPicGo(endpoint, blob, token, options = {}) {
  if (!endpoint) throw new Error('PicGo endpoint 未配置');
  const forceJson = !!options.forceJson;
  // Auto-prefer JSON when targeting a local PicGo server or when explicitly requested.
  let preferJsonAuto = forceJson || !!options.preferJson || /(^https?:\/\/(?:localhost|127\.0\.0\.1)|:36677)/i.test(endpoint);
  // Avoid creating very large base64 strings in-memory for big files — prefer multipart/form-data fallback.
  try {
    const LARGE_JSON_THRESHOLD = 5 * 1024 * 1024; // 5 MB
    if (preferJsonAuto && blob && typeof blob.size === 'number' && blob.size > LARGE_JSON_THRESHOLD) {
      try { console.warn('uploadToPicGo: skipping JSON/base64 upload for large blob (>5MB), using form-data fallback'); } catch (e) {}
      preferJsonAuto = false;
    }
  } catch (e) {}
  try {
    console.log('uploadToPicGo:start', { endpoint, name: blob && blob.name, type: blob && blob.type, size: blob && blob.size, forceJson, preferJsonAuto });
  } catch (e) {}

  const headersAuth = {};
  if (token) headersAuth['Authorization'] = `Bearer ${token}`;

  const blobToBase64 = async (b) => {
    const arr = await b.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arr);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  };

  const extractUrl = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string' && obj.startsWith('http')) return obj;
    if (obj.result && Array.isArray(obj.result) && obj.result.length > 0 && typeof obj.result[0] === 'string' && obj.result[0].startsWith('http')) {
      return obj.result[0];
    }
    if (typeof obj === 'object') {
      if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) return obj.url;
      if (obj.data) {
        if (typeof obj.data === 'string' && obj.data.startsWith('http')) return obj.data;
        if (Array.isArray(obj.data) && obj.data.length && typeof obj.data[0] === 'string' && obj.data[0].startsWith('http')) return obj.data[0];
        if (obj.data.url && typeof obj.data.url === 'string' && obj.data.url.startsWith('http')) return obj.data.url;
      }
    }
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const u = extractUrl(it);
        if (u) return u;
      }
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        try {
          const u = extractUrl(obj[k]);
          if (u) return u;
        } catch (e) {}
      }
    }
    return null;
  };

  const attemptJsonUploads = async () => {
    const b64 = await blobToBase64(blob);
    const dataUrl = `data:${blob.type || 'image/png'};base64,${b64}`;
    // Try a wide range of JSON field shapes that different PicGo versions/plugins accept.
    const jsonVariants = [
      { base64: b64 },
      { img: dataUrl },
      { images: [dataUrl] },
      { images: [b64] },
      { files: [dataUrl] },
      { files: [b64] },
      { data: dataUrl },
      { data: [dataUrl] }
    ];
    let lastRespSnippet = '';
    console.log('PicGo: attempting JSON upload variants', { variants: jsonVariants.length });
    for (const variant of jsonVariants) {
      try {
        // Log a safe summary of the variant being sent
        const safeVariantSummary = Object.keys(variant).reduce((acc, k) => {
          const v = variant[k];
          if (typeof v === 'string') {
            acc[k] = v.length > 200 ? `${v.slice(0,120)}... (len:${v.length})` : v;
          } else if (Array.isArray(v) && v.length && typeof v[0] === 'string') {
            acc[k] = `${String(v[0]).slice(0,120)}... (arr len:${v.length})`;
          } else {
            acc[k] = v;
          }
          return acc;
        }, {});
        console.log('PicGo: JSON attempt payload summary', safeVariantSummary);
        const headersJson = { 'Content-Type': 'application/json', ...headersAuth };
        const jres = await fetch(endpoint, { method: 'POST', headers: headersJson, body: JSON.stringify(variant) });
        const jbodyText = await jres.text().catch(() => null);
        let jbody = null;
        try { jbody = jbodyText ? JSON.parse(jbodyText) : null; } catch (e) { jbody = jbodyText; }
        console.log('PicGo JSON upload response', { status: jres.status, body: jbody, rawTextLen: jbodyText ? jbodyText.length : 0 });
        console.log('PicGo JSON upload response body 完整内容:', JSON.stringify(jbody, null, 2));
        const found = extractUrl(jbody);
        if (found) {
          console.log('uploadToPicGo:found url via JSON upload', found);
          return { url: found, snippet: null };
        }
        lastRespSnippet = jbody ? (typeof jbody === 'string' ? jbody.slice(0,1000) : JSON.stringify(jbody).slice(0,1000)) : '(no-json-response)';
      } catch (e) {
        lastRespSnippet = String(e).slice(0, 1000);
      }
    }
    return { url: null, snippet: lastRespSnippet };
  };

  // PicGo 2.4+ 的 HTTP Server 对 form-data 支持不好，返回 "File upload failed"
  // 优先使用 JSON 格式上传（base64）
  const isLocalPicGo = /(^https?:\/\/(?:localhost|127\.0\.0\.1)|:36677)/i.test(endpoint);
  
  // 对于本地 PicGo 或明确要求 JSON 格式，优先尝试 JSON 上传
  if (forceJson || options.preferJson || isLocalPicGo) {
    console.log('uploadToPicGo: 优先尝试 JSON 上传');
    const jsonOnly = await attemptJsonUploads();
    if (jsonOnly.url) return jsonOnly.url;
    if (forceJson) {
      throw new Error(`PicGo JSON 上传未返回图片 URL，响应：${jsonOnly.snippet || '(empty)'}`);
    }
    console.log('uploadToPicGo: JSON 上传未返回 URL，尝试 form-data');
    // fallthrough to form-data attempt if JSON didn't produce a URL
  }

  const fd = new FormData();
  const filename = (blob && blob.name) ? blob.name : `${formatDate()}-pasted.png`;
  // PicGo 2.4+ HTTP Server 使用 'list' 字段名接收文件
  fd.append('list', blob, filename);

  let res;
  try {
    console.log('PicGo: form-data upload', { endpoint, filename, blobSize: blob?.size, blobType: blob?.type });
    res = await fetch(endpoint, { method: 'POST', body: fd, headers: headersAuth });
  } catch (e) {
    console.error('uploadToPicGo fetch error', e);
    throw new Error(`PicGo 连接失败: ${e.message || String(e)}`);
  }
  console.log('uploadToPicGo:fetch result', { status: res.status, ok: res.ok });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // If PicGo responded with an error that indicates it expected clipboard data,
    // try JSON variants as a fallback (some PicGo server handlers treat missing file
    // as "upload from clipboard" and will fail).
    const lower = String(txt || '').toLowerCase();
    if (lower.includes('clipboard') || lower.includes('image not found') || lower.includes('upload clipboard')) {
      try {
        const jsonFallback = await attemptJsonUploads();
        if (jsonFallback.url) return jsonFallback.url;
      } catch (e) {
        // fall through to throwing original error below
      }
    }
    // 提供更友好的错误信息
    if (res.status === 401) {
      throw new Error(`PicGo 认证失败 (401)，请检查 Token 是否正确`);
    } else if (res.status === 404) {
      throw new Error(`PicGo 端点不存在 (404)，请检查 Endpoint 地址是否正确`);
    } else if (res.status === 500) {
      throw new Error(`PicGo 服务器错误 (500): ${txt.slice(0, 200)}`);
    }
    throw new Error(`PicGo API error: ${res.status} ${txt.slice(0, 200)}`);
  }

  let json = null;
  let rawText = null;
  try {
    rawText = await res.text();
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      json = null;
    }
  } catch (e) {
    json = await res.json().catch(() => null);
  }
  console.log('uploadToPicGo:response json', json, 'rawTextLen', rawText ? rawText.length : 0);
  console.log('uploadToPicGo:response 完整内容:', rawText);

  let url = extractUrl(json) || null;
  
  // PicGo 2.4+ 可能返回 success 字段和 result 数组
  if (!url && json) {
    if (json.success && json.result && Array.isArray(json.result) && json.result.length > 0) {
      url = typeof json.result[0] === 'string' ? json.result[0] : json.result[0]?.url || null;
    }
  }
  
  if (!url && rawText) {
    try {
      const m = rawText.match(/https?:\/\/[^\s"']+/i);
      if (m && m[0]) {
        url = m[0].replace(/[,;)]$/, '');
        console.log('uploadToPicGo:found url in raw text fallback', url);
      }
    } catch (e) { /* ignore */ }
  }

  if (url) return url;

  const msgLower = json && json.message ? String(json.message).toLowerCase() : '';
  const jsonAttempt = await attemptJsonUploads();
  if (jsonAttempt.url) return jsonAttempt.url;
  const snippet = jsonAttempt.snippet || (json ? JSON.stringify(json).slice(0, 1000) : rawText ? rawText.slice(0, 1000) : '(empty)');
  const prefix = msgLower && msgLower.includes('json') ? 'PicGo 要求 JSON 上传，但' : '无法从 PicGo 响应中解析图片 URL，响应：';
  throw new Error(`${prefix}${snippet}`);
}
