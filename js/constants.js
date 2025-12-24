// Shared string constants used across modules
export const SETTINGS_KEY = "dw_settings_v1";
export const DRAFT_KEY = "dw_draft_v1";
export const DRAFT_META_KEY = "dw_draft_meta_v1";
export const TOKEN_KEY = "dw_github_token_v1";
export const PICGO_TOKEN_KEY = "dw_picgo_token_v1";
export const FOLDER_DB_KEY = "dw_folder_handle_v1";
export const HANDLE_CLEARED_KEY = "dw_handle_cleared_v1";
export const TARGET_SUGGEST_DISMISS_KEY = "dw_target_suggestion_dismissed_v1";

// Default settings - single source of truth
export const DEFAULT_SETTINGS = {
  repoUrl: "FXnadu/deepwhite-11ty",
  branch: "main",
  targetDir: "src/content/posts/dynamic/journals",
  commitPrefix: "dynamic:",
  push: false,
  picgoEndpoint: "http://localhost:36677/upload",
  picgoToken: "",
  picgoUploadFormat: "auto"
};


