
import { initConfig, getConfig, migrateConfig, toggleDebug } from './config.js';
import { initNetwork, fetchHistoryFromCloud } from './network.js';
import { initUI, initStatusUI, openDashboard, openSettings, injectDownloadButtons } from './ui.js';
import { getSeriesInfo } from './parser.js';
import { initDownloader, tokiDownload } from './downloader.js';
import { initQueue, getQueue, enqueueTask } from './queue.js';
import { CLIENT_VERSION, MIN_LOADER_VERSION } from './config.js';
import { log, updateStatus } from './logger.js';

// Entry Point
function main(GM_context) {
    'use strict';
    
    // 0. Init Modules with GM Context
    // Normalize GM Interface (Adapter)
    const GM = {
        ...GM_context,
        getValue: GM_context.GM_getValue,
        setValue: GM_context.GM_setValue,
        deleteValue: GM_context.GM_deleteValue,
        xmlhttpRequest: GM_context.GM_xmlhttpRequest,
        registerMenuCommand: GM_context.GM_registerMenuCommand
    };

    initConfig(GM);
    initNetwork(GM);
    initUI(GM);
    initDownloader(GM);

    // 1. Version Check (Major Version Backwards Compatibility)
    // "Maintain backward compatibility until major version bump"
    const currentLoaderVer = GM_context.loaderVersion || "1.0.0"; 
    
    const getMajor = (v) => {
        const parts = String(v).replace(/^v/i, '').trim().split('.');
        return parseInt(parts[0]) || 0;
    };

    const loaderMajor = getMajor(currentLoaderVer);
    const requiredMajor = getMajor(MIN_LOADER_VERSION);

    // Only Fail if Loader is OLDER Major version (e.g. Loader v1 vs Core v2)
    // If Loader is v2 and Core is v1, that's usually fine (forward compat?). 
    // Usually Core requires Loader features.
    if (loaderMajor < requiredMajor) {
        const msg = `❌ Loader is outdated! (Current: ${currentLoaderVer}, Required Major: v${requiredMajor}.x)`;
        console.error(msg);
        alert(`⚠️ 로더(Tampermonkey 스크립트) 업데이트가 필요합니다.\n필수 버전: v${requiredMajor}.x 이상\n현재 버전: ${currentLoaderVer}\n\nGitHub에서 최신 버전을 설치해주세요.`);
        return; 
    }
    
    // Log warning for Minor mismatch but proceed (Normalize 'v' prefix first)
    const normalizeVer = (v) => String(v).replace(/^v/i, '').trim();
    if (normalizeVer(currentLoaderVer) !== normalizeVer(MIN_LOADER_VERSION)) {
        console.warn(`⚠️ Version Mismatch (Soft): Loader ${currentLoaderVer} / Core wants ${MIN_LOADER_VERSION}. Proceeding due to Major match.`);
    }

    console.log(`🚀 TokiSync ${CLIENT_VERSION} Loaded (Modular)`);

    // 2. Migration
    migrateConfig();

    // 3. Site Detection
    const currentURL = document.URL;
    let site = 'Unknown';
    let detectedCategory = 'Webtoon';
    let workId = '00000';

    if (currentURL.match(/booktoki/)) { site = "북토끼"; detectedCategory = "Novel"; }
    else if (currentURL.match(/newtoki/)) { site = "뉴토끼"; detectedCategory = "Webtoon"; }
    else if (currentURL.match(/manatoki/)) { site = "마나토끼"; detectedCategory = "Manga"; }

    // Try to extract Work/Series ID
    // Patterns:
    // /webtoon/12345/title...
    // /comic/123456
    // /novel/123
    const idMatch = currentURL.match(/\/(?:webtoon|comic|novel)\/([0-9]+)/);
    if (idMatch) workId = idMatch[1];
    
    // Parse Full Series Info (Title, etc.)
    const parsedSeries = getSeriesInfo(workId, detectedCategory);

    // Merge basic info with parsed details
    const siteInfo = { 
        site, 
        workId, 
        detectedCategory,
        ...parsedSeries // includes fullTitle, cleanTitle, etc.
    };

    console.log(`[TokiSync] Info: ${siteInfo.cleanTitle} (ID: ${siteInfo.workId})`);

    // 4. UI Injection (Menu Command) - Handled by Loader via returned API
    // GM_context.GM_registerMenuCommand("⚙️ 설정 열기", openSettings);

    // 5. Auto Start Logic
    initStatusUI();
    
    // Check Content
    if (site !== 'Unknown') {
         console.log(`[TokiSync] Site detected: ${site}. Checking for list...`);
         injectDownloadButtons(siteInfo);
         // Start Worker in Background (Optional: User can trigger it manually via UI if needed)
         // import('./worker.js').then(module => module.startWorker(false));
    }

    // Check if I am a Dedicated Worker (Popup)
    if (window.name === 'TOKI_WORKER' || window.location.hash === '#toki_worker') {
        // Dedicated worker logic might differ (e.g. strict focus)
        import(/* webpackMode: "eager" */ './worker.js').then(module => {
            module.startWorker(true); // Dedicated mode
        });
    }

    // 6. Define Managers (Glue Logic)
    const autoSyncDownloadManager = () => {
        if(confirm(`[${siteInfo.site}] 전체 다운로드를 시작하시겠습니까?\n(이미 다운로드된 항목은 건너뛰거나 덮어쓸 수 있습니다)`)) {
            tokiDownload(null, null, null, siteInfo);
        }
    };

    const batchDownloadManager = () => {
        const input = prompt("다운로드할 범위를 입력하세요 (예: 1-10 또는 5,7,9):");
        if (!input) return;
        
        // Simple Parse
        // Defaulting to passing range to tokiDownload if it supports it, 
        // OR parsing here. tokiDownload supports (start, end, targetList).
        
        // For now, simple strict start/end or list
        if (input.includes('-')) {
            const [start, end] = input.split('-').map(Number);
            tokiDownload(start, end, null, siteInfo);
        } else if (input.includes(',')) {
            const targets = input.split(',').map(Number);
            tokiDownload(null, null, targets, siteInfo);
        } else {
            const num = parseInt(input);
            if(num) tokiDownload(null, null, [num], siteInfo);
        }
    };

    const manualDownloadManager = () => {
        const url = prompt("다운로드할 에피소드 URL을 입력하세요:");
        if (url) {
            import('./downloader.js').then(m => m.tokiDownloadSingle({
                url, title: "Manual Download", id: "manual", category: siteInfo.detectedCategory
            }));
        }
    };

    // Return API for Loader
    return {
        autoSyncDownloadManager,
        openDashboard,
        openSettings,
        batchDownloadManager,
        toggleDebugMode: toggleDebug,
        manualDownloadManager
    };
}

export default main;
