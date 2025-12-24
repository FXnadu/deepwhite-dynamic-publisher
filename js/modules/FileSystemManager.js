/**
 * FileSystemManager.js
 * 职责：本地文件系统操作（读写文件、目录管理）
 */

export async function ensureWritableDirectory(dirHandle) {
  if (typeof dirHandle.requestPermission === 'function') {
    const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      return { ok: false, reason: 'permission_denied' };
    }
  }
  return { ok: true };
}

export async function getTargetDirectory(dirHandle, targetDirPath) {
  const segments = (targetDirPath || '').split('/').map(s => s.trim()).filter(Boolean);
  let current = dirHandle;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return { dir: current, subPath: segments.join('/') };
}

export async function checkExistingLocalFile(filename, targetDirPath) {
  const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') 
    ? await window.getSavedDirectoryHandle() 
    : null;
  if (!dirHandle) return { exists: false };
  
  try {
    const { dir: targetDir, subPath } = await getTargetDirectory(dirHandle, targetDirPath);
    try {
      const fileHandle = await targetDir.getFileHandle(filename, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const relativePath = subPath ? `${subPath}/${filename}` : filename;
      return { exists: true, content: text, path: relativePath };
    } catch (e) {
      return { exists: false };
    }
  } catch (e) {
    return { exists: false };
  }
}

export async function writeLocalFile(filename, content, targetDirPath) {
  const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') 
    ? await window.getSavedDirectoryHandle() 
    : null;
  if (!dirHandle) return { ok: false, reason: 'no_folder' };
  
  try {
    const writableCheck = await ensureWritableDirectory(dirHandle);
    if (!writableCheck.ok) {
      return writableCheck;
    }

    const { dir: targetDir, subPath } = await getTargetDirectory(dirHandle, targetDirPath);
    const fileHandle = await targetDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    const relativePath = subPath ? `${subPath}/${filename}` : filename;
    return { ok: true, path: relativePath };
  } catch (error) {
    console.error("写入本地文件失败:", error);
    return { ok: false, reason: 'write_failed', error };
  }
}

export async function writeBlobToLocalFile(filename, blob, localDirPath) {
  const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') 
    ? await window.getSavedDirectoryHandle() 
    : null;
  if (!dirHandle) return { ok: false, reason: 'no_folder' };
  
  try {
    const writableCheck = await ensureWritableDirectory(dirHandle);
    if (!writableCheck.ok) {
      return writableCheck;
    }

    const imagesPath = localDirPath ? `${localDirPath}/images` : 'images';
    const { dir: imagesDir } = await getTargetDirectory(dirHandle, imagesPath);
    const fileHandle = await imagesDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true };
  } catch (error) {
    console.error("写入 Blob 到本地失败:", error);
    return { ok: false, reason: 'write_failed', error };
  }
}

export async function writeBlobToUserPickedDirectory(filename, blob, suggestedPath) {
  try {
    const dirHandle = await window.showDirectoryPicker();
    const writableCheck = await ensureWritableDirectory(dirHandle);
    if (!writableCheck.ok) {
      return writableCheck;
    }

    const segments = (suggestedPath || '').split('/').map(s => s.trim()).filter(Boolean);
    let current = dirHandle;
    for (const segment of segments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }

    const fileHandle = await current.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, reason: 'user_cancelled' };
    }
    console.error("写入用户选择的目录失败:", error);
    return { ok: false, reason: 'write_failed', error };
  }
}

export function exportBlobAsFile(filename, blob) {
  try {
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
