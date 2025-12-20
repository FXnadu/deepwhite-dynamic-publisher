chrome.runtime.onInstalled.addListener(() => {
  // noop
});

const WIN_KEY = "dw_float_bounds_v1";
const WIN_ID_KEY = "dw_float_id_v1";

async function getStoredWinId(){
  const obj = await chrome.storage.local.get([WIN_ID_KEY]);
  return obj[WIN_ID_KEY] ?? null;
}

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
      await chrome.storage.local.set({ [WIN_KEY]: bounds });
    }
  }
});
