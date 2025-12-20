const WIN_KEY = "dw_float_bounds_v1";
const WIN_ID_KEY = "dw_float_id_v1";

async function getWinId(){
  const obj = await chrome.storage.local.get([WIN_ID_KEY]);
  return obj[WIN_ID_KEY] ?? null;
}
async function setWinId(id){
  await chrome.storage.local.set({ [WIN_ID_KEY]: id });
}
async function clearWinId(){ await chrome.storage.local.remove([WIN_ID_KEY]); }
async function getBounds(){
  const obj = await chrome.storage.local.get([WIN_KEY]);
  return obj[WIN_KEY] ?? null;
}
async function saveBounds(b){
  await chrome.storage.local.set({ [WIN_KEY]: b });
}
async function clearBounds(){
  await chrome.storage.local.remove([WIN_KEY]);
}

function setMsg(t, isErr=false){
  const el=document.getElementById("msg");
  el.textContent=t;
  el.className = "hint " + (isErr ? "status-err":"");
}

async function focusExisting(){
  const id = await getWinId();
  if(id == null) return false;
  try{
    const w = await chrome.windows.get(id);
    if(w?.id != null){
      await chrome.windows.update(w.id, { focused: true });
      return true;
    }
  }catch(e){
    await clearWinId();
  }
  return false;
}

async function computeCreateData(){
  const saved = await getBounds();
  const width = Number.isFinite(saved?.width) ? saved.width : 520;
  const height = Number.isFinite(saved?.height) ? saved.height : 680;

  let left = Number.isFinite(saved?.left) ? saved.left : undefined;
  let top = Number.isFinite(saved?.top) ? saved.top : undefined;
  if(left === undefined || top === undefined){
    try{
      const cur = await chrome.windows.getCurrent();
      const pad=24;
      if(cur && typeof cur.left==="number" && typeof cur.width==="number"){
        left = Math.max(0, cur.left + cur.width - width - pad);
      }
      if(cur && typeof cur.top==="number"){
        top = Math.max(0, cur.top + pad);
      }
    }catch(e){}
  }

  const url = chrome.runtime.getURL("editor.html");
  const data = { url, type:"popup", width, height };
  if(typeof left==="number") data.left = left;
  if(typeof top==="number") data.top = top;
  return data;
}

let opening = false;
async function openWindow(){
  if(opening) return;
  opening = true;
  try{
    setMsg("正在打开…");
    await chrome.runtime.sendMessage({ type: "dw-open-floating" });
    setMsg("已请求打开浮窗，可直接关闭此页。");
  }finally{
    opening = false;
  }
}

document.getElementById("open").addEventListener("click", openWindow);
openWindow();
