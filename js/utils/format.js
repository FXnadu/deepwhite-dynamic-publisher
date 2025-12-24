/**
 * 格式化工具函数
 * 包含日期、时间、文本等格式化功能
 */

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD格式
 */
export function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {string} HH:MM格式
 */
export function formatTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 计算字符数（中文算1个字符）
 * @param {string} text - 文本
 * @returns {number}
 */
export function countChars(text) {
  return text.length;
}

/**
 * 计算字数（中文算1个字，英文单词算1个字）
 * @param {string} text - 文本
 * @returns {number}
 */
export function countWords(text) {
  if (!text) return 0;
  const s = String(text || '');
  if (!s.trim()) return 0;
  // 中文字符
  const chineseChars = s.match(/[\u4e00-\u9fa5]/g) || [];
  // 英文单词
  const englishWords = s.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0);
  return chineseChars.length + englishWords.length;
}
