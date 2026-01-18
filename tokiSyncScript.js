// ==UserScript==
// @name         TokiSync (Link to Drive)
// @namespace    http://tampermonkey.net/
// @version      1.1.3
// @description  Toki series sites -> Google Drive syncing tool (Loader) (GitHub CDN)
// @author       pray4skylark
// @updateURL    https://github.com/pray4skylark/tokiSync/raw/main/tokiSyncScript.js
// @downloadURL  https://github.com/pray4skylark/tokiSync/raw/main/tokiSyncScript.js
// @supportURL   https://github.com/pray4skylark/tokiSync/issues
// @match        https://*.com/webtoon/*
// @match        https://*.com/novel/*
// @match        https://*.net/comic/*
// @match        https://script.google.com/*
// @match        https://*.github.io/tokiSync/*
// @match        https://pray4skylark.github.io/tokiSync/*
// @match        http://127.0.0.1:5500/*
// @match        http://localhost:*


// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      127.0.0.1
// @connect      localhost
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip-utils/0.1.0/jszip-utils.js
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    console.log("🚀 TokiSync Loader Initialized (GitHub CDN)");

    const CFG_FOLDER_ID = 'TOKI_FOLDER_ID';


    //    // GitHub API Config
    // ----------------------------------------------------------------
    const GITHUB_OWNER = 'pray4skylark';
    const GITHUB_REPO = 'tokiSync';
    const CORE_FILENAME = 'tokiSyncCore.js';
    const CACHE_KEY_VER = 'TOKI_CACHE_VERSION_LEGACY';
    const CACHE_KEY_TIME = 'TOKI_CACHE_TIME';
    const CACHE_KEY_SCRIPT = 'TOKI_CACHED_SCRIPT_CONTENT';
    const STORED_CORE_KEY = "TOKI_CORE_SCRIPT";
    const PINNED_VER_KEY = "TOKI_PINNED_VERSION";
    const CACHE_DURATION = 60 * 60 * 1000; // 1시간
    const CFG_DEBUG_KEY = "TOKI_DEBUG_MODE";
    const FALLBACK_VERSION = "v1.1.2";



    // #region 1-B. GitHub Pages (New Frontend) Integration
    if (location.hostname.includes('github.io') || location.hostname.includes('localhost') || location.hostname.includes('127.0.0.1')) {
        console.log("📂 TokiView (GitHub Pages) detected. Injecting Config...");

        const folderId = GM_getValue(CFG_FOLDER_ID);
        // Custom Deploy ID (Personal)
        const customDeployId = GM_getValue("TOKI_DEPLOY_ID", ""); 
        
        // [Fix] Fallback: Try to extract ID from saved GAS URL if DeployID is missing
        let derivedId = "";
        const savedGasUrl = GM_getValue("TOKI_GAS_URL", "");
        if (!customDeployId && savedGasUrl) {
            const match = savedGasUrl.match(/\/s\/([^\/]+)\/exec/);
            if (match) derivedId = match[1];
        }

        // Default Deploy ID (Shared/Auto-Update) - v3.1.0 Safe JSDoc
        const DEFAULT_ID = ""; 

        const targetId = customDeployId || derivedId || DEFAULT_ID;
        const apiUrl = `https://script.google.com/macros/s/${targetId}/exec`;

        if (folderId) {
            // Wait slightly for page load
            setTimeout(() => {
                window.postMessage({ 
                    type: 'TOKI_CONFIG', 
                    url: apiUrl, 
                    folderId: folderId,
                    deployId: targetId
                }, '*');
                console.log("✅ Config Injected to Frontend:", targetId);
            }, 500);
        }
    }
    // #endregion ================================================================


    // #region 2. Core Script Loading (Content Caching) ==========================
    // [moved to executeScript for correct ordering]

    /**
     * 1. 저장된 스크립트 버전과 GitHub 최신 버전을 비교합니다.
     * 2. 업데이트가 필요하면 사용자에게 알림을 표시합니다.
     * 3. 최신 스크립트 또는 캐시된 스크립트를 로드합니다.
     */
    async function checkAndLoadCore() {
        const pinnedVer = GM_getValue(PINNED_VER_KEY);
        
        // [MODIFIED] Disable Version Check requested by User
        // const latestVer = await fetchLatestVersion();
        const latestVer = pinnedVer || FALLBACK_VERSION;
        console.log("🚫 Version Check Disabled (User Request) - Using Pinned/Fallback");

        // 1. 저장된 스크립트 확인
        const storedScript = GM_getValue(STORED_CORE_KEY, "");
        
        // [Verified] Manual Injection Support
        // [Verified] Manual Injection Support
        if (pinnedVer === "MANUAL_DEBUG" && storedScript) {
             console.log("🛠 Loading Manually Injected Core Script");
             executeScript(storedScript);
             return;
        }

        // [Enabled] Cached Execution Logic
        if (pinnedVer && pinnedVer === latestVer && storedScript) {
            // 버전 변경 없음 & 스크립트 보유 -> 즉시 실행
            console.log(`⚡️ Loading stored Core (${pinnedVer}) - No Network`);
            executeScript(storedScript);
            return;
        }

        // 2. 최초 실행 또는 업데이트 필요
        if (!pinnedVer) {
            console.log(`📌 First run: Pinning to ${latestVer}`);
            GM_setValue(PINNED_VER_KEY, latestVer);
            fetchAndStoreScript(latestVer);
            return;
        }

        if (pinnedVer !== latestVer) {
            console.log(`✨ Update Available: ${pinnedVer} -> ${latestVer}`);
            GM_registerMenuCommand(`✨ 업데이트 가능 (${latestVer})`, () => {
                if (confirm(`새 버전(${latestVer})으로 업데이트하시겠습니까?`)) {
                    GM_setValue(PINNED_VER_KEY, latestVer);
                    GM_deleteValue(STORED_CORE_KEY); // 구버전 삭제
                    alert("업데이트를 진행합니다. 잠시 후 새로고침됩니다.");
                    fetchAndStoreScript(latestVer, true); // true = reload after
                }
            });
            // 업데이트 전까지는 구버전(pinnedVer) 로드
            if (storedScript) {
                executeScript(storedScript);
            } else {
                fetchAndStoreScript(pinnedVer); // 구버전이라도 받아옴 (하지만 만약 태그가 지워졌다면?)
            }
        } else {
             // pinned === latest but no storedScript (Reached here because storedScript was false in condition above)
             // Or cached block was skipped/commented out previously. Now it's enabled.
             console.log(`⚠️ Version matches (${pinnedVer}) but script missing. Re-fetching...`);
             fetchAndStoreScript(pinnedVer);
        }
    }

    /**
     * GitHub API를 통해 최신 릴리스 태그(버전)를 조회합니다.
     * API 호출 제한을 피하기 위해 캐시(1시간)를 사용합니다.
     * @returns {Promise<string>} 최신 버전 태그 (e.g. "v3.1.0")
     */
    function fetchLatestVersion() {
        return new Promise((resolve) => {
            const cachedVer = GM_getValue(CACHE_KEY_VER);
            const cachedTime = GM_getValue(CACHE_KEY_TIME, 0);
            const isDebug = GM_getValue(CFG_DEBUG_KEY, false);
            const now = Date.now();

            if (isDebug) console.log("🐛 Debug Mode: Cache Skipped");
            else if (cachedVer && (now - cachedTime < CACHE_DURATION)) {
                resolve(cachedVer);
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags`,
                onload: (res) => {
                    if (res.status === 200) {
                        try {
                            const tags = JSON.parse(res.responseText);
                            if (tags.length > 0) {
                                const latestVer = tags[0].name;
                                GM_setValue(CACHE_KEY_VER, latestVer);
                                GM_setValue(CACHE_KEY_TIME, now);
                                resolve(latestVer);
                            } else resolve(cachedVer || FALLBACK_VERSION);
                        } catch (e) { resolve(cachedVer || FALLBACK_VERSION); }
                    } else resolve(cachedVer || FALLBACK_VERSION);
                },
                onerror: () => resolve(cachedVer || FALLBACK_VERSION)
            });
        });
    }

    /**
     * GitHub Raw 서버에서 실제 스크립트 파일을 다운로드하고 저장합니다.
     * @param {string} version - 다운로드할 버전
     * @param {boolean} [reloadAfter=false] - 다운로드 후 페이지 새로고침 여부
     */
    const CFG_USE_LOCAL = "TOKI_USE_LOCAL_SOURCE";

    function fetchAndStoreScript(version, reloadAfter = false) {
        const useLocal = GM_getValue(CFG_USE_LOCAL, false);
        const sourceName = useLocal ? "Localhost" : "GitHub Raw";
        
        let cdnUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${version}/${CORE_FILENAME}?t=${Date.now()}`;
        
        if (useLocal) {
            cdnUrl = `http://127.0.0.1:8080/${CORE_FILENAME}?t=${Date.now()}`;
        }

        console.log(`☁️ Fetching Core Script from [${sourceName}]: ${cdnUrl}`);

        GM_xmlhttpRequest({
            method: "GET",
            url: cdnUrl,
            onload: function (response) {
                if (response.status === 200) {
                    const scriptContent = response.responseText;
                    
                    if (!scriptContent.includes("window.TokiSyncCore")) {
                        console.error("❌ Invalid Script Content");
                        alert("스크립트 내용이 올바르지 않습니다.");
                        return;
                    }

                    console.log(`✅ Core Updated (${sourceName})`);
                    GM_setValue(STORED_CORE_KEY, scriptContent);
                    
                    if(reloadAfter) {
                        alert(`[TokiSync] ${version} (${sourceName}) 업데이트 완료! 새로고침합니다.`);
                        location.reload();
                    } else {
                        executeScript(scriptContent);
                    }
                } else {
                    console.error("❌ Fetch Failed:", response.status);
                    alert(`스크립트 다운로드 실패: ${response.status}\nURL: ${cdnUrl}\n(로컬 서버가 켜져있는지 확인하세요: npx http-server docs --cors)`);
                }
            },
            onerror: (e) => {
                console.error("❌ Network Error", e);
                alert(`네트워크 오류 발생\nURL: ${cdnUrl}`);
            }
        });
    }

    // [Dev Menu]
    GM_registerMenuCommand("🔄 소스 전환 (GitHub <-> Localhost)", () => {
        const current = GM_getValue(CFG_USE_LOCAL, false);
        const next = !current;
        GM_setValue(CFG_USE_LOCAL, next);
        alert(`소스가 변경되었습니다: ${current ? "Localhost" : "GitHub"} -> ${next ? "Localhost" : "GitHub"}\n페이지를 새로고침하면 적용됩니다.`);
        GM_deleteValue(STORED_CORE_KEY); // 강제 재다운로드 유도
        location.reload();
    });

    /**
     * 저장된 스크립트 문자열을 `new Function`으로 실행합니다.
     * GM_* 함수들을 Core 스크립트로 전달합니다 (Sandboxing 우회).
     * @param {string} scriptContent - 실행할 JS 코드 문자열
     */
    function executeScript(scriptContent) {
        try {
            const runScript = new Function("window", scriptContent);
            runScript(window);

            if (typeof window.TokiSyncCore === 'function') {
                const coreApi = window.TokiSyncCore({
                    loaderVersion: (typeof GM_info !== 'undefined' ? GM_info.script.version : "1.1.3"),
                    GM_registerMenuCommand: GM_registerMenuCommand,
                    GM_xmlhttpRequest: GM_xmlhttpRequest,
                    GM_setValue: GM_setValue,
                    GM_getValue: GM_getValue,
                    GM_deleteValue: GM_deleteValue,
                    GM_addValueChangeListener: typeof GM_addValueChangeListener !== 'undefined' ? GM_addValueChangeListener : undefined,
                    JSZip: JSZip
                });

                // [New] Centralized Menu Registration
                if (coreApi) {
                    GM_registerMenuCommand('☁️ 자동 동기화', coreApi.autoSyncDownloadManager);
                    GM_registerMenuCommand('📊 서재 열기', coreApi.openDashboard);
                    GM_registerMenuCommand('🔢 범위 다운로드', coreApi.batchDownloadManager);
                    GM_registerMenuCommand('⚙️ 설정 (URL/FolderID)', coreApi.openSettings);
                    GM_registerMenuCommand('🐞 디버그 모드', coreApi.toggleDebugMode);

                    if (GM_getValue(CFG_DEBUG_KEY, false)) {
                        GM_registerMenuCommand('🧪 1회성 다운로드', coreApi.manualDownloadManager);

                        // [Loader Debug Menus]
                        GM_registerMenuCommand('⚡️ 강제 업데이트 확인', () => {
                            GM_setValue(CACHE_KEY_TIME, 0);
                            GM_setValue(PINNED_VER_KEY, "");
                            GM_deleteValue(STORED_CORE_KEY);
                            alert("캐시를 초기화했습니다. 최신 버전을 확인합니다.");
                            location.reload();
                        });

                        GM_registerMenuCommand('🛠 [Debug] Core 직접 입력', () => {
                            const oldUI = document.getElementById('tokiDebugInputUI');
                            if (oldUI) oldUI.remove();

                            const div = document.createElement('div');
                            div.id = 'tokiDebugInputUI';
                            div.style.cssText = "position:fixed; top:10%; left:10%; width:80%; height:80%; background:white; z-index:999999; border:2px solid red; padding:20px; box-shadow:0 0 20px rgba(0,0,0,0.5); display:flex; flex-direction:column;";
                            
                            div.innerHTML = `
                                <h2 style="margin:0 0 10px 0; color:red;">🛠 Core Script Manual Injection</h2>
                                <p style="font-size:12px; color:#666;">여기에 tokiSyncCore.js 전체 코드를 붙여넣으세요. (기존 캐시 덮어씀)</p>
                                <textarea id="tokiDebugTextarea" style="flex:1; width:100%; margin-bottom:10px; font-family:monospace; font-size:11px;"></textarea>
                                <div style="display:flex; gap:10px;">
                                    <button id="tokiDebugSaveBtn" style="flex:1; padding:10px; background:red; color:white; font-weight:bold; border:none; cursor:pointer;">💾 저장 및 실행</button>
                                    <button id="tokiDebugCloseBtn" style="flex:0 0 100px; padding:10px; background:#ccc; border:none; cursor:pointer;">닫기</button>
                                </div>
                            `;
                            document.body.appendChild(div);

                            document.getElementById('tokiDebugCloseBtn').onclick = () => div.remove();
                            document.getElementById('tokiDebugSaveBtn').onclick = () => {
                                const content = document.getElementById('tokiDebugTextarea').value;
                                if (!content.trim()) { alert("내용이 비어있습니다."); return; }
                                
                                if (!content.includes("window.TokiSyncCore")) {
                                    if(!confirm("⚠️ Core 스크립트 형식이 아닌 것 같습니다 (window.TokiSyncCore 미포함).\n그래도 저장하시겠습니까?")) return;
                                }

                                GM_setValue(STORED_CORE_KEY, content);
                                GM_setValue(PINNED_VER_KEY, "MANUAL_DEBUG"); // 버전 고정
                                alert("💾 Core 스크립트가 저장되었습니다.\n페이지를 새로고침하여 적용합니다.");
                                location.reload();
                            };
                        });
                    }
                }

            } else {
                throw new Error("window.TokiSyncCore missing");
            }
        } catch (e) {
            console.error("❌ Execution Failed:", e);
            // 실행 실패 시 캐시 삭제 (손상 가능성)
            GM_deleteValue(STORED_CORE_KEY);
        }
    }

    checkAndLoadCore();
    // #endregion
})();