import { tokiDownload } from './downloader.js';
import { detectSite } from './detector.js';
import { showConfigModal, getConfig } from './config.js';
import { LogBox, markDownloadedItems } from './ui.js';
import { fetchHistory } from './gas.js';
import { getListItems, parseListItem } from './parser.js';
import { getCommonPrefix } from './utils.js';

export function main() {
    console.log("🚀 TokiDownloader Loaded (New Core)");
    
    // 1. Global Settings (Always available)
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('설정', () => showConfigModal());
        GM_registerMenuCommand('로그창 토글', () => LogBox.getInstance().toggle());

        GM_registerMenuCommand('Viewer 열기 (설정 전송)', () => {
             const config = getConfig();
             const viewerUrl = "https://pray4skylark.github.io/tokiSync/";
             const win = window.open(viewerUrl, "_blank");
             
             if(win) {
                 // Try to send config periodically until success or timeout
                 let attempts = 0;
                 const interval = setInterval(() => {
                     attempts++;
                     win.postMessage({ type: 'TOKI_CONFIG', config: config }, '*');
                     if(attempts > 10) clearInterval(interval);
                 }, 500);
             } else {
                 alert("팝업 차단을 해제해주세요.");
             }
        });
    }

    const siteInfo = detectSite();
    if(!siteInfo) return; // Not a target page

    // 2. Site Specific Commands
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('전체 다운로드', () => {
            const config = getConfig();
            tokiDownload(undefined, undefined, config.policy);
        });
        
        GM_registerMenuCommand('N번째 회차부터', () => {
             const start = prompt('몇번째 회차부터 저장할까요?', 1);
             if(start) {
                 const config = getConfig();
                 tokiDownload(parseInt(start), undefined, config.policy);
             }
        });

        GM_registerMenuCommand('N번째 회차부터 N번째 까지', () => {
             const start = prompt('몇번째 회차부터 저장할까요?', 1);
             const end = prompt('몇번째 회차까지 저장할까요?', 2);
             if(start && end) {
                 const config = getConfig();
                 tokiDownload(parseInt(start), parseInt(end), config.policy);
             }
        });
    }

    // 3. History Sync (Async)
    console.log('[TokiSync] Starting history sync...');
    (async () => {
        try {
            const list = getListItems();
            console.log(`[TokiSync] Found ${list.length} list items`);
            if (list.length === 0) {
                console.warn('[TokiSync] No list items found, skipping history sync');
                return;
            }

            // Replicate RootFolder Logic (Series Title Resolution)
            const first = parseListItem(list[0]);
            const last = parseListItem(list[list.length - 1]);

            // Extract Series ID from URL
            const idMatch = document.URL.match(/\/(novel|webtoon|comic)\/([0-9]+)/);
            const seriesId = idMatch ? idMatch[2] : "0000";

            let seriesTitle = "";
            let rootFolder = "";

            if (list.length > 1) {
                seriesTitle = getCommonPrefix(first.title, last.title);
                if (seriesTitle.length > 2) {
                    rootFolder = `[${seriesId}] ${seriesTitle}`;
                } else {
                    rootFolder = `[${seriesId}] ${first.title} ~ ${last.title}`;
                }
            } else {
                rootFolder = `[${seriesId}] ${first.title}`;
            }

            // Determine Category
            let category = 'Webtoon';
            if (siteInfo.site === '북토끼') category = 'Novel';
            else if (siteInfo.site === '마나토끼') category = 'Manga';

            // Fetch & Mark
            console.log(`[TokiSync] Fetching history for: ${rootFolder} (${category})`);
            const history = await fetchHistory(rootFolder, category);
            console.log(`[TokiSync] Received ${history.length} history items:`, history);
            if (history.length > 0) {
                markDownloadedItems(history);
            } else {
                console.log('[TokiSync] No history items to mark');
            }
        } catch (e) {
            console.warn('[TokiSync] History check failed:', e);
        }
    })();
}

// Auto-run main if imported? Or let index.js call it.
// Since we are refactoring, likely index.js will just import and call main().
