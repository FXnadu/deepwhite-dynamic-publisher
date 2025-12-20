const DRAFT_KEY = "dw_draft_v1";
const SETTINGS_KEY = "dw_settings_v1";

function ymd(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function setStatus(text, cls="status-ok"){
  const el=document.getElementById("status");
  el.textContent=text;
  el.className=cls;
}

function setDraftState(text){
  document.getElementById("draftState").textContent=text;
}

async function loadSettings(){
  const obj = await chrome.storage.sync.get([SETTINGS_KEY]);
  return obj[SETTINGS_KEY] || {
    repoOwner: "FXnadu",
    repoName: "deepwhite-11ty",
    branch: "main",
    targetDir: "src/content/posts/dynamic/journals",
    commitPrefix: "dynamic:",
    simulate: true
  };
}

async function saveDraft(value){
  await chrome.storage.local.set({[DRAFT_KEY]: value});
}

async function loadDraft(){
  const obj = await chrome.storage.local.get([DRAFT_KEY]);
  return obj[DRAFT_KEY] || "";
}

function tick(){
  const el=document.getElementById("clock");
  const d=new Date();
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  el.textContent = `${ymd(d)} ${hh}:${mm}`;
}
setInterval(tick, 1000);
tick();

(async function init(){
  const editor=document.getElementById("editor");
  editor.value = await loadDraft();

  let timer=null;
  editor.addEventListener("input", ()=>{
    setDraftState("草稿：已修改（自动保存中…）");
    setStatus("编辑中");
    if(timer) clearTimeout(timer);
    timer=setTimeout(async ()=>{
      await saveDraft(editor.value);
      setDraftState("草稿：已保存到本地");
      setStatus("就绪");
    }, 350);
  });

  document.getElementById("clearDraft").addEventListener("click", async ()=>{
    editor.value="";
    await saveDraft("");
    setDraftState("草稿：已清空");
    setStatus("就绪");
  });

  document.getElementById("openSettings").addEventListener("click", ()=>{
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("publish").addEventListener("click", async ()=>{
    const settings = await loadSettings();
    const filename = `${ymd()}.md`;
    const path = `${settings.targetDir}/${filename}`.replace(/\/+/g,'/');

    // This build is a mock: only shows what would be committed.
    const body = editor.value.trim();
    if(!body){
      setStatus("内容为空", "status-warn");
      return;
    }

    const preview = `将创建：${path}\n提交信息：${settings.commitPrefix} ${filename}\n\n---\n${body.substring(0, 280)}${body.length>280?"…":""}`;
    setStatus("已模拟发表（未推送）", "status-ok");

    // lightweight modal using alert for now
    alert(preview);

    // clear draft after publish (matches朋友圈心智)
    await saveDraft("");
    editor.value="";
    setDraftState("草稿：已发表并清空（模拟）");
  });
})();
