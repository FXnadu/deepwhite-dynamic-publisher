/**
 * ImageHandler.js
 * 职责：图片处理（粘贴、上传、PicGo 集成、本地保存）
 */

import { showToast, showConfirm, uploadToPicGo, formatDate } from '../utils/index.js';
import { setStatus } from './UIManager.js';
import { writeBlobToLocalFile, writeBlobToUserPickedDirectory, exportBlobAsFile } from './FileSystemManager.js';
import { insertTextAtCursor, renderImageGalleryFromText } from './ImageGalleryManager.js';

function generateImageFilename(file) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  
  let ext = '';
  try {
    const m = (file && file.name) ? String(file.name).match(/(\.[^.\s]+)$/) : null;
    if (m && m[1]) ext = m[1];
    else if (file && file.type) {
      if (file.type.includes('jpeg')) ext = '.jpg';
      else if (file.type.includes('png')) ext = '.png';
      else if (file.type.includes('gif')) ext = '.gif';
      else ext = '.png';
    } else {
      ext = '.png';
    }
  } catch (e) { ext = '.png'; }
  
  return `${formatDate(now)}-${hh}${mm}${ss}${ext}`;
}

async function uploadImageToPicGo(file, settings, imgName) {
  try {
    console.log('[uploadImageToPicGo] 开始上传', { file, settings, imgName });
    showToast("检测到图片，开始上传到 PicGo…", "success", 900);
    setStatus("图片上传中…", "status-ok");
    
    const endpoint = settings.picgoEndpoint;
    const token = settings.picgoToken || '';
    const preferJson = (settings.picgoUploadFormat === 'json' || settings.picgoUploadFormat === 'JSON');
    
    console.log('[uploadImageToPicGo] 调用 uploadToPicGo', { endpoint, token: token ? '***' : '', preferJson });
    const url = await uploadToPicGo(endpoint, file, token, { preferJson });
    console.log('[uploadImageToPicGo] uploadToPicGo 返回', { url });
    
    if (url) {
      return { success: true, url };
    } else {
      throw new Error('PicGo 未返回图片 URL');
    }
  } catch (e) {
    console.error("[uploadImageToPicGo] PicGo 上传失败:", e);
    setStatus("就绪", "status-ok");
    return { success: false, error: e.message || 'PicGo 上传失败' };
  }
}

async function saveImageLocally(file, imgName, targetDir, settings) {
  if (settings && settings.promptForSave) {
    const pick = await showConfirm('请选择保存位置', 
      '你已选择在设置中始终选择保存目录。现在请选择一个本地文件夹以保存图片：', 
      '选择并保存', '取消');
    
    if (pick) {
      try {
        const pickRes = await writeBlobToUserPickedDirectory(imgName, file, `${targetDir}/images`);
        if (pickRes && pickRes.ok) {
          return { success: true, path: `./images/${imgName}` };
        } else {
          showToast("未保存图片（用户取消或保存失败）", "warning", 1400);
          return { success: false };
        }
      } catch (e) {
        console.error("写入用户选定目录失败:", e);
        showToast("保存失败，已导出为文件", "error", 1400);
        exportBlobAsFile(imgName, file);
        return { success: false };
      }
    } else {
      showToast("未保存图片（用户取消）", "warning", 1200);
      return { success: false };
    }
  }

  try {
    const saveRes = await writeBlobToLocalFile(imgName, file, targetDir);
    if (saveRes && saveRes.ok) {
      return { success: true, path: `./images/${imgName}` };
    }

    if (saveRes && saveRes.reason === 'no_folder') {
      const pickSave = await showConfirm('请选择保存位置', 
        '当前未选择本地目录，请选择保存目录以将图片保存在文章目录的 images 文件夹中。', 
        '选择并保存', '取消');
      
      if (pickSave) {
        try {
          const pickRes = await writeBlobToUserPickedDirectory(imgName, file, `${targetDir}/images`);
          if (pickRes && pickRes.ok) {
            return { success: true, path: `./images/${imgName}` };
          } else {
            showToast("未保存图片（用户取消或保存失败）", "warning", 1400);
            return { success: false };
          }
        } catch (e) {
          console.error("写入用户选定目录失败:", e);
          showToast("保存失败，已导出为文件", "error", 1400);
          exportBlobAsFile(imgName, file);
          return { success: false };
        }
      } else {
        showToast("未保存图片（用户取消）", "warning", 1200);
        return { success: false };
      }
    }

    const pickSave2 = await showConfirm('保存图片失败 - 请选择保存方式', 
      '保存到已配置的本地目录失败，是否手动选择目录保存图片？', 
      '选择并保存', '取消');
    
    if (pickSave2) {
      try {
        const pickRes2 = await writeBlobToUserPickedDirectory(imgName, file, `${targetDir}/images`);
        if (pickRes2 && pickRes2.ok) {
          return { success: true, path: `./images/${imgName}` };
        } else {
          showToast("未保存图片（用户取消或保存失败）", "warning", 1400);
          return { success: false };
        }
      } catch (e) {
        console.error("写入用户选定目录失败:", e);
        exportBlobAsFile(imgName, file);
        return { success: false };
      }
    } else {
      showToast("未保存图片（用户取消）", "warning", 1200);
      return { success: false };
    }
  } catch (e) {
    console.error("保存图片到本地时出错:", e);
    showToast("保存图片失败，已导出为文件", "error", 1400);
    exportBlobAsFile(imgName, file);
    return { success: false };
  }
}

export async function handleImageFile(file, settings, opts = {}) {
  if (!file) return;
  
  try {
    const imgName = generateImageFilename(file);
    // 总是尝试使用 PicGo，除非明确指定不使用
    const usePicgo = !(opts && opts.skipPicgo);
    
    console.log('[ImageHandler] 处理图片:', {
      imgName,
      usePicgo,
      skipPicgo: opts?.skipPicgo,
      picgoEndpoint: settings?.picgoEndpoint
    });
    
    // 如果需要使用 PicGo
    if (usePicgo) {
      // 检查 PicGo 配置
      if (!settings || !settings.picgoEndpoint) {
        console.log('[ImageHandler] PicGo 未配置');
        // PicGo 未配置
        if (opts && opts.preferPicgo) {
          // 粘贴操作：询问用户如何处理
          console.log('[ImageHandler] 粘贴操作 + PicGo 未配置 → 询问用户');
          const choice = await showConfirm(
            'PicGo 未配置', 
            'PicGo 未配置，无法上传图片。<br/><br/>是否保存图片到本地？', 
            '选择保存位置', 
            '放弃'
          );
          
          if (choice) {
            // 用户选择保存，让用户选择保存位置
            try {
              const pickRes = await writeBlobToUserPickedDirectory(imgName, file, '');
              if (pickRes && pickRes.ok) {
                showToast("图片已保存到你选择的位置", "success", 1400);
              } else {
                showToast("未保存图片（用户取消）", "warning", 1400);
              }
            } catch (e) {
              console.error("保存图片失败:", e);
              showToast("保存失败", "error", 1400);
            }
          } else {
            showToast("已放弃保存图片", "info", 1200);
          }
          setStatus("就绪", "status-ok");
          return;
        }
        // 其他操作：降级到本地保存
        console.log('[ImageHandler] 非粘贴操作 + PicGo 未配置 → 继续保存本地');
        showToast("PicGo 未配置，将保存到本地", "warning", 1500);
        // 继续执行到最后的本地保存逻辑
      } else {
        console.log('[ImageHandler] PicGo 已配置，尝试上传');
        // PicGo 已配置，尝试上传
        const result = await uploadImageToPicGo(file, settings, imgName);
        if (result.success) {
          console.log('[ImageHandler] PicGo 上传成功');
          const ta = document.getElementById('editor');
          insertTextAtCursor(ta, `![](${result.url})\n`);
          renderImageGalleryFromText(ta.value);
          showToast("图片已上传到 PicGo 并插入文档", "success", 1400);
          setStatus("就绪", "status-ok");
          return;
        }
        
        console.log('[ImageHandler] PicGo 上传失败:', result.error);
        // PicGo 上传失败
        if (opts && opts.preferPicgo) {
          // 粘贴操作：询问用户如何处理
          console.log('[ImageHandler] 粘贴操作 + 上传失败 → 询问用户');
          const choice = await showConfirm(
            'PicGo 上传失败', 
            `上传失败：${result.error || '未知错误'}<br/><br/>图片无法上传，是否保存到本地？`, 
            '选择保存位置', 
            '放弃'
          );
          
          if (choice) {
            // 用户选择保存，让用户选择保存位置
            try {
              const pickRes = await writeBlobToUserPickedDirectory(imgName, file, '');
              if (pickRes && pickRes.ok) {
                showToast("图片已保存到你选择的位置", "success", 1400);
              } else {
                showToast("未保存图片（用户取消）", "warning", 1400);
              }
            } catch (e) {
              console.error("保存图片失败:", e);
              showToast("保存失败", "error", 1400);
            }
          } else {
            showToast("已放弃保存图片", "info", 1200);
          }
          setStatus("就绪", "status-ok");
          return;
        }
        
        console.log('[ImageHandler] 非粘贴操作 + 上传失败 → 询问用户');
        // 其他操作：询问用户是否保存到本地
        const fallbackChoice = await showConfirm(
          'PicGo 上传失败', 
          `上传失败：${result.error || '未知错误'}<br/><br/>是否保存图片到本地目录？`, 
          '保存到本地', 
          '导出文件'
        );
        
        if (!fallbackChoice) {
          // 用户选择导出文件
          console.log('[ImageHandler] 用户选择导出文件');
          exportBlobAsFile(imgName, file);
          showToast("图片已导出为文件", "success", 1400);
          setStatus("就绪", "status-ok");
          return;
        }
        console.log('[ImageHandler] 用户选择保存本地 → 继续');
        // 用户选择保存到本地，继续执行下面的本地保存逻辑
      }
    }

    // 保存到本地（不使用 PicGo 或 PicGo 失败后用户选择保存本地）
    console.log('[ImageHandler] 执行本地保存');
    const targetDir = settings && settings.targetDir ? settings.targetDir : '';
    const result = await saveImageLocally(file, imgName, targetDir, settings);
    
    if (result.success) {
      console.log('[ImageHandler] 本地保存成功:', result.path);
      const ta = document.getElementById('editor');
      insertTextAtCursor(ta, `![](${result.path})\n`);
      renderImageGalleryFromText(ta.value);
      showToast("图片已保存到本地文章目录的 images 文件夹", "success", 1400);
    } else {
      console.log('[ImageHandler] 本地保存失败');
    }
    
    setStatus("就绪", "status-ok");
  } catch (e) {
    console.error("处理图片时出错:", e);
    setStatus("就绪", "status-ok");
  }
}

export function setupPasteHandler(editor, settingsLoader) {
  editor.addEventListener('paste', async (e) => {
    try {
      const items = (e.clipboardData && e.clipboardData.items) 
        ? Array.from(e.clipboardData.items) 
        : [];
      if (!items.length) return;
      
      for (const item of items) {
        if (item && item.type && item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const settings = await settingsLoader();
          await handleImageFile(file, settings, { preferPicgo: true });
          break;
        }
      }
    } catch (e) {
      console.error("处理粘贴图片时出错:", e);
    }
  });
}
