function ensureActionHasNoPopup() {
  try {
    chrome.action.setPopup({ popup: "" });
  } catch (e) {
    // noop
  }
}

ensureActionHasNoPopup();

chrome.runtime.onInstalled.addListener(() => {
  ensureActionHasNoPopup();
});

const WIN_KEY = "dw_float_bounds_v1";
const WIN_ID_KEY = "dw_float_id_v1";

const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 680;
const PAD = 24;

async function getStoredWinId(){
  const obj = await chrome.storage.local.get([WIN_ID_KEY]);
  return obj[WIN_ID_KEY] ?? null;
}

async function setStoredWinId(id){
  await chrome.storage.local.set({ [WIN_ID_KEY]: id });
}

async function getStoredBounds(){
  const obj = await chrome.storage.local.get([WIN_KEY]);
  return obj[WIN_KEY] ?? null;
}

async function saveBounds(bounds){
  await chrome.storage.local.set({ [WIN_KEY]: bounds });
}

async function focusExisting(){
  const id = await getStoredWinId();
  if(id == null) return false;
  try{
    const win = await chrome.windows.get(id);
    if(win?.id != null){
      await chrome.windows.update(win.id, { focused: true });
      return true;
    }
  }catch(e){
    await chrome.storage.local.remove([WIN_ID_KEY]);
  }
  return false;
}

async function computeCreateData(){
  const saved = await getStoredBounds();
  const width = Number.isFinite(saved?.width) ? saved.width : DEFAULT_WIDTH;
  const height = Number.isFinite(saved?.height) ? saved.height : DEFAULT_HEIGHT;

  let left = Number.isFinite(saved?.left) ? saved.left : undefined;
  let top = Number.isFinite(saved?.top) ? saved.top : undefined;
  if(left === undefined || top === undefined){
    try{
      const cur = await chrome.windows.getLastFocused();
      if(cur && typeof cur.left === "number" && typeof cur.width === "number"){
        left = Math.max(0, cur.left + cur.width - width - PAD);
      }
      if(cur && typeof cur.top === "number"){
        top = Math.max(0, cur.top + PAD);
      }
    }catch(e){ /* noop */ }
  }

  const url = chrome.runtime.getURL("editor.html");
  const data = { url, type: "popup", width, height };
  if(typeof left === "number") data.left = left;
  if(typeof top === "number") data.top = top;
  return data;
}

let opening = false;
async function openFloatingWindow(){
  if(opening) return;
  opening = true;
  try{
    if(await focusExisting()) return;
    const createData = await computeCreateData();
    const win = await chrome.windows.create(createData);
    if(win?.id == null) throw new Error("windows.create returned no id");
    await setStoredWinId(win.id);
    try{
      const info = await chrome.windows.get(win.id);
      await saveBounds({ left: info.left, top: info.top, width: info.width, height: info.height });
    }catch(e){ /* ignore */ }
  }finally{
    opening = false;
  }
}

chrome.action.onClicked.addListener(() => {
  openFloatingWindow();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if(message && message.type === "dw-open-floating"){
    openFloatingWindow();
    sendResponse({ ok: true });
    return;
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const storedId = await getStoredWinId();
  if(storedId === windowId){
    await chrome.storage.local.remove([WIN_ID_KEY]);
  }
});

chrome.windows.onBoundsChanged.addListener(async (window) => {
  const storedId = await getStoredWinId();
  if(storedId === window.id){
    const { left, top, width, height } = window;
    if([left, top, width, height].every(Number.isFinite)){
      const bounds = { left, top, width, height };
      await saveBounds(bounds);
    }
  }
});
