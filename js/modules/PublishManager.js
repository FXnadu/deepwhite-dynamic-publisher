/**
 * PublishManager.js
 * 职责：发布管理（GitHub 推送、本地保存、发布流程）
 */

import { showToast, showChoice, showConfirm, showPrompt, githubPutFile, parseRepoUrl, 
         formatDate, encodeBase64Utf8, openSettingsPage } from '../utils/index.js';
import { setStatus, updateWordCount } from './UIManager.js';
import { writeLocalFile, checkExistingLocalFile } from './FileSystemManager.js';
import { saveDraft } from './DraftManager.js';
import { renderImageGalleryFromText } from './ImageGalleryManager.js';
import { updateHighlight } from './MarkdownRenderer.js';
import { getGitHubToken } from '../utils/storage.js';

async function promptRetryExportSettingsCancel(title, message, retryLabel = '重试') {
  return await showChoice(title, message, [
    { id: 'retry', label: `${retryLabel}`, btnClass: 'btn-primary' },
    { id: 'export', label: '导出草稿', btnClass: '' },
    { id: 'settings', label: '打开设置', btnClass: '' },
    { id: 'cancel', label: '取消', btnClass: '' }
  ]);
}

function exportMarkdownAsFile(filename, content) {
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error("导出文件失败:", error);
  }
}

// 清空编辑器（发布成功后）
async function clearEditorAfterPublish() {
  const editor = document.getElementById('editor');
  if (!editor) return;
  
  const backup = editor.value;
  try {
    editor.value = "";
    updateWordCount("");
    try { updateHighlight(editor, document.getElementById("editorHighlight"), ""); } catch (_) {}
    try { renderImageGalleryFromText(""); } catch (_) {}
    
    try {
      await saveDraft("");
      const { setDraftState } = await import('./UIManager.js');
      setDraftState("草稿：已发表并清空");
    } catch (saveErr) {
      console.error("保存空草稿失败，恢复原内容以避免数据丢失:", saveErr);
      editor.value = backup;
      updateWordCount(backup);
      try { updateHighlight(editor, document.getElementById("editorHighlight"), backup); } catch (_) {}
      try { renderImageGalleryFromText(backup); } catch (_) {}
      const { setDraftState } = await import('./UIManager.js');
      setDraftState("草稿：已保存（恢复原内容）");
    }
  } catch (clearErr) {
    console.error("清空编辑器时出错:", clearErr);
  }
}

async function publishToGitHub(content, filename, settings) {
  try {
    const token = await getGitHubToken();
    if (!token) {
      throw new Error('Missing GitHub token');
    }
    
    const { owner, repo } = parseRepoUrl(settings.repoUrl);
    const branch = settings.branch || 'main';
    const targetDir = settings.targetDir || '';
    const path = targetDir ? `${targetDir}/${filename}` : filename;
    const commitPrefix = settings.commitPrefix || 'dynamic:';
    const message = `${commitPrefix} ${filename}`;

    const contentBase64 = encodeBase64Utf8(content);
    const result = await githubPutFile({ owner, repo, path, branch, message, contentBase64, token });
    
    return { success: true, path };
  } catch (error) {
    console.error("推送到 GitHub 失败:", error);
    return { success: false, error: error.message };
  }
}

async function saveToLocal(content, filename, targetDir) {
  try {
    const existing = await checkExistingLocalFile(filename, targetDir);
    let writeFilename = filename;
    let writeBody = content;
    
    if (existing.exists) {
      // 显示已有内容预览
      const preview = (existing.content || '').slice(0, 800).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let resolved = false;
      
      while (!resolved) {
        const choice = await showChoice(
          '检测到同名文件',
          `目标路径已存在同名文件：<br/><code>${existing.path}</code><br/><div class="choice-preview">${preview}${(existing.content || '').length > 800 ? '\n\n…（已截断）' : ''}</div><br/>请选择操作：`,
          [
            { id: 'overwrite', label: '覆盖（直接替换）', btnClass: 'btn-danger' },
            { id: 'append', label: '追加到文件末尾', btnClass: '' },
            { id: 'newfile', label: '另存为新文件（保留原文件）', btnClass: 'btn-primary' },
            { id: 'viewdiff', label: '查看差异', btnClass: '' },
            { id: 'cancel', label: '取消操作', btnClass: '' }
          ]
        );

        if (!choice || choice === 'cancel') {
          return { success: false, cancelled: true };
        }

        if (choice === 'append') {
          writeBody = (existing.content || '') + '\n\n' + content;
          resolved = true;
        } else if (choice === 'newfile') {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const ss = String(now.getSeconds()).padStart(2, '0');
          const suggested = `${formatDate(now)}-${hh}${mm}${ss}.md`;
          
          try {
            const input = await showPrompt('另存为新文件', `请输入文件名（包含扩展名 .md）：`, suggested, '确定', '取消');
            if (input && input.trim()) {
              writeFilename = input.trim();
              resolved = true;
            } else {
              continue; // 返回上一级选择
            }
          } catch (e) {
            writeFilename = suggested;
            resolved = true;
          }
        } else if (choice === 'viewdiff') {
          // 显示差异预览
          const safeOriginal = (existing.content || '').slice(0, 1500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const safeNew = (content || '').slice(0, 1500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          await showConfirm(
            '差异预览', 
            `<div class="choice-preview"><strong>已存在文件（前1500字符）：</strong>\n\n${safeOriginal}\n\n<strong>当前草稿（前1500字符）：</strong>\n\n${safeNew}</div>`, 
            '返回', 
            '关闭'
          );
          // 继续循环让用户重新选择
        } else {
          // overwrite
          resolved = true;
        }
      }
    }

    const result = await writeLocalFile(writeFilename, writeBody, targetDir);
    
    if (result.ok) {
      return { success: true, path: result.path, content: writeBody };
    } else if (result.reason === 'no_folder') {
      return { success: false, reason: 'no_folder' };
    } else {
      throw new Error('写入失败');
    }
  } catch (error) {
    console.error("保存到本地失败:", error);
    return { success: false, error: error.message };
  }
}

export async function publish(content, settings) {
  const filename = `${formatDate()}.md`;
  const shouldPush = settings && settings.push;
  const targetDir = settings && settings.targetDir ? settings.targetDir : '';
  
  if (shouldPush) {
    // 启用推送时：先保存到本地，再推送到 GitHub（都使用 targetDir）
    setStatus("保存中…", "status-ok");
    const localResult = await saveToLocal(content, filename, targetDir);
    
    if (!localResult.success) {
      if (localResult.cancelled) {
        setStatus("就绪", "status-ok");
        return { success: false };
      } else if (localResult.reason === 'no_folder') {
        const choice = await showChoice(
          '未选择本地目录',
          '请先在设置中配置本地保存目录',
          [
            { id: 'settings', label: '打开设置', btnClass: 'btn-primary' },
            { id: 'export', label: '导出草稿', btnClass: '' },
            { id: 'cancel', label: '取消', btnClass: '' }
          ]
        );
        
        if (choice === 'settings') {
          openSettingsPage();
        } else if (choice === 'export') {
          exportMarkdownAsFile(filename, content);
          showToast("已导出草稿", "success", 1500);
        }
        
        setStatus("就绪", "status-ok");
        return { success: false };
      } else {
        setStatus("保存失败", "status-error");
        const choice = await promptRetryExportSettingsCancel(
          '保存失败',
          `保存到本地失败: ${localResult.error}`,
          '重试'
        );
        
        if (choice === 'retry') {
          return await publish(content, settings);
        } else if (choice === 'export') {
          exportMarkdownAsFile(filename, content);
          showToast("已导出草稿", "success", 1500);
        } else if (choice === 'settings') {
          openSettingsPage();
        }
        
        setStatus("就绪", "status-ok");
        return { success: false };
      }
    }
    
    // 本地保存成功，重新读取本地文件内容以确保与远程完全一致
    setStatus("读取本地文件…", "status-ok");
    const localFileContent = await checkExistingLocalFile(filename, targetDir);
    
    if (!localFileContent.exists || !localFileContent.content) {
      // 如果读取失败，回退到使用 saveToLocal 返回的内容
      console.warn("无法读取本地文件，使用保存时的内容");
    }
    
    const contentToPublish = (localFileContent.exists && localFileContent.content) 
      ? localFileContent.content 
      : (localResult.content || content);
    
    setStatus("推送中…", "status-ok");
    const result = await publishToGitHub(contentToPublish, filename, settings);
    
    if (result.success) {
      // 推送成功，清空编辑器
      await clearEditorAfterPublish();
      showToast(`已保存到本地并推送到 GitHub: ${result.path}`, "success", 2000);
      setStatus("就绪", "status-ok");
      return { success: true };
    } else {
      setStatus("推送失败", "status-error");
      const choice = await promptRetryExportSettingsCancel(
        '推送失败',
        `已保存到本地，但推送到 GitHub 失败: ${result.error}`,
        '重试推送'
      );
      
      if (choice === 'retry') {
        // 重试推送前，重新读取本地文件确保内容一致
        setStatus("读取本地文件…", "status-ok");
        const retryLocalContent = await checkExistingLocalFile(filename, targetDir);
        const retryContent = (retryLocalContent.exists && retryLocalContent.content) 
          ? retryLocalContent.content 
          : contentToPublish;
        
        setStatus("推送中…", "status-ok");
        const retryResult = await publishToGitHub(retryContent, filename, settings);
        if (retryResult.success) {
          // 推送成功，清空编辑器
          await clearEditorAfterPublish();
          showToast(`已推送到 GitHub: ${retryResult.path}`, "success", 2000);
          setStatus("就绪", "status-ok");
          return { success: true };
        } else {
          showToast(`推送失败: ${retryResult.error}`, "error", 2000);
          setStatus("就绪", "status-ok");
          return { success: false };
        }
      } else if (choice === 'export') {
        exportMarkdownAsFile(filename, content);
        showToast("已导出草稿", "success", 1500);
      } else if (choice === 'settings') {
        openSettingsPage();
      }
      
      setStatus("就绪", "status-ok");
      return { success: false };
    }
  } else {
    // 不推送时：只保存到本地（使用 targetDir）
    setStatus("保存中…", "status-ok");
    const result = await saveToLocal(content, filename, targetDir);

    if (result.success) {
      // 保存成功，清空编辑器
      await clearEditorAfterPublish();
      showToast(`已保存到本地: ${result.path}`, "success", 2000);
      setStatus("就绪", "status-ok");
      return { success: true };
    } else if (result.cancelled) {
      setStatus("就绪", "status-ok");
      return { success: false };
    } else if (result.reason === 'no_folder') {
      const choice = await showChoice(
        '未选择本地目录',
        '请先在设置中配置本地保存目录',
        [
          { id: 'settings', label: '打开设置', btnClass: 'btn-primary' },
          { id: 'export', label: '导出草稿', btnClass: '' },
          { id: 'cancel', label: '取消', btnClass: '' }
        ]
      );
      
      if (choice === 'settings') {
        openSettingsPage();
      } else if (choice === 'export') {
        exportMarkdownAsFile(filename, content);
        showToast("已导出草稿", "success", 1500);
      }
      
      setStatus("就绪", "status-ok");
      return { success: false };
    } else {
      setStatus("保存失败", "status-error");
      const choice = await promptRetryExportSettingsCancel(
        '保存失败',
        `保存到本地失败: ${result.error}`,
        '重试'
      );
      
      if (choice === 'retry') {
        return await publish(content, settings);
      } else if (choice === 'export') {
        exportMarkdownAsFile(filename, content);
        showToast("已导出草稿", "success", 1500);
      } else if (choice === 'settings') {
        openSettingsPage();
      }
      
      setStatus("就绪", "status-ok");
      return { success: false };
    }
  }
}
