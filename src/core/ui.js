import { getConfig, CFG_FOLDER_ID, CFG_URL_KEY, CFG_DASH_KEY, CFG_DEBUG_KEY, switchDebug, saveConfig } from './config.js';
import { log } from './logger.js';
import { tokiDownloadSingle } from './downloader.js';

let GM = null;
export function initUI(gmContext) {
    GM = gmContext;
}

export function initStatusUI() {
    const oldUI = document.getElementById('tokiStatusDisplay');
    if (oldUI) oldUI.remove();
    const statusUI = document.createElement('div');
    statusUI.id = 'tokiStatusDisplay';
    statusUI.style.cssText = "position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.8); color:white; padding:15px; border-radius:10px; z-index:99999; font-family:sans-serif; font-size:14px; max-width:300px;";
    
    // Initial Render
    renderStatus(statusUI, "준비 중...");

    document.body.appendChild(statusUI);
}

function renderStatus(el, msg) {
    const config = getConfig();
    const debugBadge = config.debug ? '<span style="color:yellow; font-weight:bold;">[DEBUG]</span> ' : '';
    el.innerHTML = `
        <button id="tokiCloseBtn" style="position:absolute; top:5px; right:5px; background:none; border:none; color:white; font-weight:bold; cursor:pointer;">X</button>
        <p id="tokiStatusText" style="margin:0 0 10px 0;">${debugBadge}${msg}</p>
        <button id="tokiAudioBtn" style="display:none; width:100%; margin-bottom:5px; padding:8px; background:#ff5252; color:white; border:none; border-radius:5px; cursor:pointer;">🔊 백그라운드 켜기 (필수)</button>
        <button id="tokiResumeButton" style="display:none; width:100%; padding:8px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">캡차 해결 완료</button>
    `;
    const closeBtn = el.querySelector('#tokiCloseBtn');
    if(closeBtn) closeBtn.onclick = () => el.remove();
}

export async function openSettings() {
    const currentConfig = getConfig();
    const folderIdInput = prompt("1. 구글 드라이브 폴더 ID 입력 (필수):", currentConfig.folderId);
    if (folderIdInput === null) return;
    const folderId = folderIdInput.trim();

    if (!folderId) { alert("폴더 ID는 필수입니다."); return; }

    saveConfig(CFG_FOLDER_ID, folderId);
    alert(`✅ 설정 완료!\nFolder ID: ${folderId}`);

    if (confirm("API 서버 URL 설정을 진행하시겠습니까?\n(뷰어 자동 연결을 위해선 필수입니다)")) {
        const apiUrlInput = prompt("API 서버 URL:", currentConfig.url);
        if (apiUrlInput) saveConfig(CFG_URL_KEY, apiUrlInput.trim());

        const dashUrlInput = prompt("대시보드 URL:", currentConfig.dashUrl);
        if (dashUrlInput) saveConfig(CFG_DASH_KEY, dashUrlInput.trim());
    }
}

export async function openDashboard() {
    let config = getConfig();
    
    if (!config.dashUrl) { alert("⚠️ 대시보드 URL이 설정되지 않았습니다."); return; }
    if (!config.url) {
        if(confirm("⚠️ API URL이 설정되지 않았습니다. 지금 설정하시겠습니까?")) {
            await openSettings();
            config = getConfig(); 
            if(!config.url && !confirm("여전히 API URL이 없습니다. 그래도 여시겠습니까?")) return;
        }
    }
    
    const newWindow = window.open(config.dashUrl, '_blank');
    
    if (newWindow && config.url && config.folderId) {
        let deployId = "";
        const match = config.url.match(/\/s\/([^\/]+)\/exec/);
        if (match) deployId = match[1];

        let tries = 0;
        const timer = setInterval(() => {
            newWindow.postMessage({
                type: 'TOKI_CONFIG',
                url: config.url,
                folderId: config.folderId,
                deployId: deployId
            }, "*");
            tries++;
            if(tries > 5) clearInterval(timer);
        }, 1000);
    }
}

export function injectDashboard() {
    // 1. Hide Body Content
    const style = document.createElement('style');
    style.innerHTML = `
        body > *:not(#tokiDashboardOverlay) { display: none !important; }
        html, body { background: #1a1a1a; color: white; margin: 0; padding: 0; height: 100%; overflow: hidden; }
    `;
    document.head.appendChild(style);

    // 2. Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tokiDashboardOverlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#1a1a1a; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center;";
    overlay.innerHTML = `
        <h1>🚀 TokiSync Worker</h1>
        <div id="tokiStatusText" style="font-size:24px; margin:20px; text-align:center;">준비 중...</div>
        <div id="tokiQueueList" style="width:80%; height:300px; background:#333; overflow-y:auto; padding:20px; border-radius:10px;"></div>
        <button id="tokiResumeButton" style="display:none; margin-top:20px; padding:15px 30px; font-size:18px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">캡차 해결 완료</button>
    `;
    document.body.appendChild(overlay);
}



import { fetchHistoryFromCloud } from './network.js';

export function injectDownloadButtons(siteInfo) {
    const listItems = document.querySelectorAll('.list-body > li, .list-item'); 
    
    if (listItems.length === 0) {
        log(`[UI] No list items found. Selectors: .list-body > li, .list-item`);
        updateStatus("⚠️ 목록을 찾을 수 없습니다 (뷰어 페이지일 수 있음)");
        return;
    }

    updateStatus(`⏳ 히스토리 확인 중... (${listItems.length}개 항목)`);

    // Fetch History
    fetchHistoryFromCloud(siteInfo).then(history => {
        log(`[UI] Cloud History Loaded: ${history.length} items`);
        
        let downloadedCount = 0;
        
        listItems.forEach((li, index) => {
            const link = li.querySelector('a');
            if (!link) return;
            
            // Clean Title Extraction (remove date/count spans)
            // Clone node to safely manipulate
            const linkClone = link.cloneNode(true);
            Array.from(linkClone.children).forEach(child => child.remove());
            const title = linkClone.innerText.trim();
            
            // Simple fuzzy check: checks if title is in history list (assuming history contains titles or partials)
            // history returns array of { title: "..." } usually or just strings depending on GAS.
            // Looking at network.js, it returns `json.body`. Assuming body is array of Objects or Strings.
            // Let's assume Objects with `title` property or `name`.
            // But usually history cloud returns list of folder names or similar.
            // Let's assume strict title match or includes.
            
            // Strategy: Match based on Board Number (wr-num)
            // Downloader saves as: "0123 - Title.cbz" (padded to 4 digits usually)
            
            const numEl = li.querySelector('.wr-num');
            const numText = numEl ? numEl.innerText.trim() : null;
            let isDownloaded = false;
            let matchedName = "";

            if (numText && /^\d+$/.test(numText)) {
                // Pad to match commonly saved format, but also check raw number
                const num = parseInt(numText); 
                // Possible prefixes in Drive: "123 -", "0123 -", "123.cbz"
                
                isDownloaded = history.some(h => {
                    const hName = String((typeof h === 'object' && h.name) ? h.name : h).trim();
                    // Check if file starts with the number
                    // e.g. hName="0123 - Title.cbz", numText="123"
                    
                    // Simple regex: Starts with number followed by non-digit or end
                    // But we must handle padding. "0123" vs "123"
                    const hMatch = hName.match(/^(\d+)/);
                    if (hMatch) {
                        const hNum = parseInt(hMatch[1]);
                        return hNum === num;
                    }
                    return false;
                });
                if (isDownloaded) matchedName = `No.${num}`;
            } else {
                // Fallback: Title matching if no number column (e.g. mobile view sometimes hides it, or different layout)
                // But user requested specific column usage.
                const cleanTitle = title.replace(/\s/g, '');
                isDownloaded = history.some(h => {
                    const hName = String((typeof h === 'object' && h.name) ? h.name : h).trim();
                    const cleanH = hName.replace(/\s/g, '');
                    return cleanTitle.includes(cleanH) || cleanH.includes(cleanTitle);
                });
            }

            if (li.querySelector('.toki-down-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'toki-down-btn';
            
            if (isDownloaded) {
                btn.innerText = '✅';
                btn.style.cssText = "margin-left: 10px; padding: 2px 8px; cursor: default; border: 1px solid #4CAF50; background: #E8F5E9; color: #2E7D32;";
                btn.title = `이미 다운로드됨 (${matchedName || numText || "Found"})`;
                downloadedCount++;
            } else {
                btn.innerText = '⬇️';
                btn.style.cssText = "margin-left: 10px; padding: 2px 8px; cursor: pointer; border: 1px solid #ccc; background: #fff;";
                btn.innerText = '⬇️';
                btn.style.cssText = "margin-left: 10px; padding: 2px 8px; cursor: pointer; border: 1px solid #ccc; background: #fff;";
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if(confirm(`[${title}] 다운로드 대기열에 추가하시겠습니까?`)) {
                        import('./queue.js').then(q => {
                            // Prepare Metadata
                            const info = siteInfo; 
                            const folderName = `[${info.workId}] ${info.cleanTitle}`;
                            
                            q.enqueueTask({
                                id: siteInfo.site + "_" + siteInfo.workId + "_" + numText, 
                                title: title,
                                url: link.href,
                                site: siteInfo.site,
                                category: siteInfo.detectedCategory,
                                folderName: folderName, 
                                seriesTitle: info.cleanTitle,
                                wrNum: numText 
                            });
                             const btnEl = e.target;
                             btnEl.innerText = "⏳";
                             btnEl.disabled = true;

                        });
                    }
                };
            }

            const targetContainer = li.querySelector('.wr-subject') || li;
            targetContainer.appendChild(btn);
        });

        updateStatus(`✅ 준비 완료: ${siteInfo.site} (총 ${listItems.length}개, 다운로드됨 ${downloadedCount}개)`);
    });
}

function updateStatus(msg) {
    const el = document.getElementById('tokiStatusText');
    if (el) el.innerText = msg;
    log(msg);
}
