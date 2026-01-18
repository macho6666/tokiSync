export const SCRIPT_NAME = "TokiSync Core";
export const CLIENT_VERSION = "v1.1.3"; // Imp: Version Check & Whitelist
export const MIN_LOADER_VERSION = "v1.1.3";
export const PROTOCOL_VERSION = 3;

// Config Keys
export const CFG_URL_KEY = "TOKI_GAS_URL";
export const CFG_DASH_KEY = "TOKI_DASH_URL";
export const CFG_FOLDER_ID = "TOKI_FOLDER_ID";
export const CFG_DEBUG_KEY = "TOKI_DEBUG_MODE";
export const CFG_AUTO_SYNC_KEY = "TOKI_AUTO_SYNC";
export const CFG_CONFIG_VER = "TOKI_CONFIG_VER";
const CURRENT_CONFIG_VER = 1;

const DEFAULT_API_URL = ""; 
const DEFAULT_DASH_URL = "https://pray4skylark.github.io/tokiSync/";

// GM Context (Injected via init)
let GM = null;

export function initConfig(gmContext) {
    GM = gmContext;
}

export function getConfig() {
    if (!GM) throw new Error("Config not initialized with GM context");
    return {
        url: GM.getValue(CFG_URL_KEY, DEFAULT_API_URL),
        dashUrl: GM.getValue(CFG_DASH_KEY, DEFAULT_DASH_URL),
        folderId: GM.getValue(CFG_FOLDER_ID, ""),
        debug: GM.getValue(CFG_DEBUG_KEY, false)
    };
}

export function migrateConfig() {
    const savedVer = GM.getValue(CFG_CONFIG_VER, 0);
    if (savedVer < CURRENT_CONFIG_VER) {
        console.log(`♻️ Migrating config from v${savedVer} to v${CURRENT_CONFIG_VER}`);
        GM.deleteValue(CFG_URL_KEY);
        GM.deleteValue(CFG_FOLDER_ID);
        GM.setValue(CFG_CONFIG_VER, CURRENT_CONFIG_VER);
        alert(`TokiSync ${CLIENT_VERSION} 업데이트: 설정을 초기화했습니다.\n새로운 서버 연결을 위해 설정을 다시 진행해주세요.`);
        location.reload();
    }
}

export function saveConfig(key, value) {
    GM.setValue(key, value);
}

export function toggleDebug() {
    const current = GM.getValue(CFG_DEBUG_KEY, false);
    const next = !current;
    GM.setValue(CFG_DEBUG_KEY, next);
    return next;
}
