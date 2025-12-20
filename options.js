const SETTINGS_KEY = "dw_settings_v1";

async function load(){
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

async function save(settings){
  await chrome.storage.sync.set({[SETTINGS_KEY]: settings});
}

(async function init(){
  const s = await load();
  repoOwner.value = s.repoOwner || "";
  repoName.value = s.repoName || "";
  branch.value = s.branch || "main";
  targetDir.value = s.targetDir || "src/content/posts/dynamic/journals";
  commitPrefix.value = s.commitPrefix || "dynamic:";
  simulate.value = String(!!s.simulate);

  document.getElementById("save").addEventListener("click", async ()=>{
    const next = {
      repoOwner: repoOwner.value.trim() || "FXnadu",
      repoName: repoName.value.trim() || "deepwhite-11ty",
      branch: branch.value.trim() || "main",
      targetDir: targetDir.value.trim() || "src/content/posts/dynamic/journals",
      commitPrefix: commitPrefix.value.trim() || "dynamic:",
      simulate: simulate.value === "true"
    };
    await save(next);
    const el=document.getElementById("savedHint");
    el.textContent="已保存。";
    setTimeout(()=>{el.textContent="";}, 1200);
  });
})();
