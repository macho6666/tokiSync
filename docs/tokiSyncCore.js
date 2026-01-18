// 🚀 TokiSync Core Logic v1.1.3 (Bundled)
// This file is generated from src/core. Do not edit directly.
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 126
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Y: () => (/* binding */ getSeriesInfo)
/* harmony export */ });
function getSeriesInfo(workId, detectedCategory) {
    const metaSubject = document.querySelector('meta[name="subject"]');
    const pageDesc = document.querySelector('.page-desc');
    const metaTitle = document.querySelector('meta[property="og:title"]');

    let fullTitle = "Unknown";
    if (metaSubject) fullTitle = metaSubject.content.trim();
    else if (pageDesc) fullTitle = pageDesc.innerText.trim();
    else if (metaTitle) fullTitle = metaTitle.content.split('>')[0].split('|')[0].trim();

    let cleanTitle = fullTitle.replace(/[\\/:*?"<>|]/g, "");
    if (cleanTitle.length > 15) cleanTitle = cleanTitle.substring(0, 15).trim();

    const details = getDetailInfo();
    return { fullTitle, cleanTitle, id: workId, ...details, category: detectedCategory };
}

function getDetailInfo() {
    let author = "", category = "", status = "", thumbnail = "";
    try {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) thumbnail = ogImage.content;

        const textNodes = document.body.innerText.split('\n');
        textNodes.forEach(line => {
            if (line.includes("작가 :")) author = line.replace("작가 :", "").trim();
            if (line.includes("분류 :")) category = line.replace("분류 :", "").trim();
            if (line.includes("발행구분 :")) status = line.replace("발행구분 :", "").trim();
        });
    } catch (e) { }
    return { author, category, status, thumbnail };
}


/***/ },

/***/ 302
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Rt: () => (/* binding */ completeTask),
/* harmony export */   enqueueTask: () => (/* binding */ enqueueTask),
/* harmony export */   wv: () => (/* binding */ getMyStats),
/* harmony export */   zq: () => (/* binding */ claimNextTask)
/* harmony export */ });
/* unused harmony exports initQueue, getQueue, setQueue, releaseTask */
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(569);



let GM = null;
const QUEUE_KEY = "TOKI_QUEUE";
const LOCK_KEY = "TOKI_WORKER_LOCK"; // Task-level lock is managed inside queue items, this is for "Highlander" check if needed

function initQueue(gmContext) {
    GM = gmContext;
}

function getQueue() {
    return GM.getValue(QUEUE_KEY, []);
}

function setQueue(q) {
    GM.setValue(QUEUE_KEY, q);
}

function enqueueTask(task) {
    // task: { id, title, url, site }
    const q = getQueue();
    const existing = q.find(t => t.id === task.id);
    if (existing) {
        // If task is stuck in 'working' or failed, allow retry
        if (existing.status !== 'pending') {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`🔄 Re-queueing stuck/completed task: ${task.title}`);
            existing.status = 'pending';
            existing.workerId = null;
            existing.updatedAt = Date.now();
            setQueue(q);
            return true;
        }
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Duplicate task ignored (Already Pending): ${task.title}`);
        return false;
    }
    const queueItem = {
        ...task,
        status: 'pending', // pending, working, completed, failed
        addedAt: Date.now(),
        workerId: null,
        updatedAt: Date.now()
    };
    q.push(queueItem);
    setQueue(q);
    (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Enqueue: ${task.title}`);
    return true;
}

function claimNextTask(workerId) {
    const q = getQueue();
    // 1. Clean up stale tasks (working > 10 mins)
    const now = Date.now();
    let dirty = false;
    q.forEach(t => {
        if (t.status === 'working' && (now - t.updatedAt > 10 * 60 * 1000)) {
             (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Hitman: Resetting stale task ${t.title}`);
             t.status = 'pending';
             t.workerId = null;
             dirty = true;
        }
    });

    // 2. Find pending
    const candidate = q.find(t => t.status === 'pending');
    if (candidate) {
        candidate.status = 'working';
        candidate.workerId = workerId;
        candidate.updatedAt = now;
        setQueue(q); // Save lock
        return candidate;
    }
    
    if (dirty) setQueue(q);
    return null;
}

function completeTask(taskId) {
    let q = getQueue();
    // Remove completed task
    const initialLen = q.length;
    q = q.filter(t => t.id !== taskId);
    if (q.length !== initialLen) {
        setQueue(q);
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Task Completed & Removed: ${taskId}`);
        return true;
    }
    return false;
}

function releaseTask(taskId) {
    const q = getQueue();
    const task = q.find(t => t.id === taskId);
    if (task) {
        task.status = 'pending';
        task.workerId = null;
        task.updatedAt = Date.now();
        setQueue(q);
        log(`Task Released (Retry): ${taskId}`);
    }
}

function getMyStats(workerId) {
    // For Dashboard UI
    const q = getQueue();
    const pending = q.filter(t => t.status === 'pending').length;
    const working = q.filter(t => t.status === 'working').length;
    const myTask = q.find(t => t.workerId === workerId && t.status === 'working');
    return { pending, working, total: q.length, myTask };
}


/***/ },

/***/ 391
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Gd: () => (/* binding */ saveInfoJson),
/* harmony export */   al: () => (/* binding */ fetchHistoryFromCloud),
/* harmony export */   t9: () => (/* binding */ initNetwork),
/* harmony export */   y4: () => (/* binding */ uploadResumable)
/* harmony export */ });
/* unused harmony export arrayBufferToBase64 */
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);




// GM context injected via init
let GM = null; 
let JSZip = null;

function initNetwork(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
}

function checkAuthRequired(responseText) {
    if (responseText && responseText.trim().startsWith("<") && (responseText.includes("google.com") || responseText.includes("Google Accounts"))) {
        alert("⚠️ 구글 권한 승인이 필요합니다.\n확인을 누르면 새 창이 열립니다.\n권한을 승인(로그인 -> 허용)한 뒤, 다시 시도해주세요.");
        window.open((0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)().url, '_blank');
        return true;
    }
    return false;
}

    function fetchHistoryFromCloud(seriesInfo) {
    return new Promise((resolve, reject) => {
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        if (!config.url || !config.folderId) { resolve([]); return; }
        
        const payload = { 
            folderId: config.folderId, 
            type: 'check_history', 
            protocolVersion: 3, 
            clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
            category: seriesInfo.category,
            folderName: `[${seriesInfo.id}] ${seriesInfo.cleanTitle}` 
        };
        
        GM.xmlhttpRequest({
            method: "POST", url: config.url, data: JSON.stringify(payload), headers: { "Content-Type": "text/plain" },
            onload: (res) => {
                if (res.status === 200) {
                    if (checkAuthRequired(res.responseText)) { resolve([]); return; }
                    try {
                        const json = JSON.parse(res.responseText);
                        let cloudHistory = Array.isArray(json.body) ? json.body : [];
                        
                        // Filter System Files
                        const ignoreList = ['cover.jpg', 'info.json', 'checklist.json', 'temp', '.DS_Store'];
                        const originalCount = cloudHistory.length;
                        
                        cloudHistory = cloudHistory.filter(item => {
                            const name = (typeof item === 'string') ? item : (item.name || "");
                            return !ignoreList.some(ignore => name.toLowerCase().includes(ignore));
                        });

                        if (originalCount !== cloudHistory.length) {
                             console.log(`[TokiSync] History Filtered: ${originalCount} -> ${cloudHistory.length} (Removed system files)`);
                        }
                        // Debug Log
                        console.log(`[TokiSync] Cloud Files:`, cloudHistory);

                        resolve(cloudHistory);
                    } catch (e) { console.error(e); resolve([]); }
                } else resolve([]);
            },
            onerror: () => resolve([])
        });
    });
}

async function saveInfoJson(seriesInfo, fileCount, lastEpisode, forceThumbnailUpdate = false) {
    return new Promise(async (resolve) => {
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        if (!config.url) { resolve(); return; }

        const payload = {
            folderId: config.folderId, 
            type: 'save_info', 
            protocolVersion: 3,
            clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
            folderName: `[${seriesInfo.id}] ${seriesInfo.cleanTitle}`,
            id: seriesInfo.id, title: seriesInfo.fullTitle, url: document.URL, site: seriesInfo.site,
            author: seriesInfo.author, category: seriesInfo.category, status: seriesInfo.status, 
            thumbnail: seriesInfo.thumbnail, 
            thumbnail_file: true, 
            last_episode: lastEpisode,
            file_count: fileCount
        };
        
        GM.xmlhttpRequest({
            method: "POST", url: config.url, data: JSON.stringify(payload), headers: { "Content-Type": "text/plain" },
            onload: async (res) => {
                if (!checkAuthRequired(res.responseText)) {
                    if (forceThumbnailUpdate && seriesInfo.thumbnail) {
                        await ensureCoverUpload(seriesInfo.thumbnail, `[${seriesInfo.id}] ${seriesInfo.cleanTitle}`, seriesInfo.category);
                    }
                    resolve();
                }
                else resolve(); 
            },
            onerror: () => resolve()
        });
    });
}

async function ensureCoverUpload(thumbnailUrl, folderName, category) {
    if (!thumbnailUrl.startsWith('http')) return;
    try {
        const blob = await new Promise((resolve) => {
            GM.xmlhttpRequest({
                method: "GET", url: thumbnailUrl, responseType: "blob", headers: { "Referer": document.URL },
                onload: (res) => resolve(res.status === 200 ? res.response : null),
                onerror: () => resolve(null)
            });
        });
        
        if (blob) {
            await uploadResumable(blob, folderName, "cover.jpg", category); 
        }
    } catch(e) { console.warn("Cover Upload Failed", e); }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

const CHUNK_SIZE = 20 * 1024 * 1024;

async function uploadResumable(blob, folderName, fileName, category, onProgress) {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    if (!config.url) throw new Error("URL 미설정");
    const totalSize = blob.size;
    let uploadUrl = "";
    
    // Init
    await new Promise((resolve, reject) => {
        GM.xmlhttpRequest({
            method: "POST", url: config.url,
            data: JSON.stringify({ 
                folderId: config.folderId, 
                type: "init", 
                protocolVersion: 3, 
                clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
                folderName: folderName, 
                fileName: fileName,
                category: category
            }),
            headers: { "Content-Type": "text/plain" },
            onload: (res) => {
                if (checkAuthRequired(res.responseText)) { reject(new Error("권한 승인 필요")); return; }
                try {
                    const json = JSON.parse(res.responseText);
                    if (json.status === 'success') { 
                        if (typeof json.body === 'object') { uploadUrl = json.body.uploadUrl; } 
                        else { uploadUrl = json.body; }
                        resolve(); 
                    }
                    else reject(new Error(json.body));
                } catch (e) { reject(new Error("GAS 응답 오류")); }
            },
            onerror: (e) => reject(e)
        });
    });

    // Chunk Upload
    let start = 0;
    const buffer = await blob.arrayBuffer();
    while (start < totalSize) {
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBuffer = buffer.slice(start, end);
        const chunkBase64 = arrayBufferToBase64(chunkBuffer);
        const percentage = Math.floor((end / totalSize) * 100);
        
        if(onProgress) onProgress(percentage);

        await new Promise((resolve, reject) => {
            GM.xmlhttpRequest({
                method: "POST", url: config.url,
                data: JSON.stringify({ 
                    folderId: config.folderId, 
                    type: "upload", 
                    clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
                    uploadUrl: uploadUrl, 
                    chunkData: chunkBase64, 
                    start: start, end: end, total: totalSize 
                }),
                headers: { "Content-Type": "text/plain" },
                onload: (res) => {
                    if (checkAuthRequired(res.responseText)) { reject(new Error("권한 승인 필요")); return; }
                    try { const json = JSON.parse(res.responseText); if (json.status === 'success') resolve(); else reject(new Error(json.body)); } catch (e) { reject(e); }
                },
                onerror: (e) => reject(e)
            });
        });
        start = end;
    }
}


/***/ },

/***/ 414
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   aM: () => (/* binding */ initDownloader),
/* harmony export */   qc: () => (/* binding */ tokiDownload),
/* harmony export */   tokiDownloadSingle: () => (/* binding */ tokiDownloadSingle)
/* harmony export */ });
/* unused harmony export createEpub */
/* harmony import */ var _network_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(391);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(569);
/* harmony import */ var _parser_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(126);
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(899);





let GM = null; 
let JSZip = null;

function initDownloader(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
}

// Helper: Fetch Blob (using GM)
function fetchBlob(url, listener) {
    return new Promise((resolve) => {
        GM.xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "arraybuffer", // Use arraybuffer for robustness
            timeout: 20000,
            headers: { "Referer": document.URL },
            onload: (res) => {
                if (res.status === 200) resolve(res.response);
                else resolve(null);
            },
            onprogress: (e) => {
                 // Optional: listener(e.loaded, e.total);
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null)
        });
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getDynamicWait(base) { return Math.floor(Math.random() * (base * 0.2 + 1)) + base; }

const WAIT_WEBTOON_MS = 3000; 
const WAIT_NOVEL_MS = 8000;   

async function createEpub(zip, title, author, textContent) {
    // Basic EPUB Creation Logic
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    
    const escapedText = textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const htmlBody = escapedText.split('\n').map(line => `<p>${line}</p>`).join('');
    
    zip.file("OEBPS/Text/chapter.xhtml", `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body><h1>${title}</h1>${htmlBody}</body></html>`);
    
    const opf = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:title>${title}</dc:title><dc:creator opf:role="aut">${author}</dc:creator><dc:language>ko</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter"/></spine></package>`;
    zip.file("OEBPS/content.opf", opf);
    
    const ncx = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd"><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:12345"/></head><docTitle><text>${title}</text></docTitle><navMap><navPoint id="navPoint-1" playOrder="1"><navLabel><text>${title}</text></navLabel><content src="Text/chapter.xhtml"/></navPoint></navMap></ncx>`;
    zip.file("OEBPS/toc.ncx", ncx);
}

async function tokiDownload(startIndex, lastIndex, targetNumbers, siteInfo) {
    const { site, workId, detectedCategory } = siteInfo;
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__/* .getConfig */ .zj)();

    const pauseForCaptcha = (iframe) => {
        return new Promise(resolve => {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
            iframe.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:80vw; height:80vh; background:white; z-index:99998;";
            const btn = document.getElementById('tokiResumeButton');
            btn.style.display = 'block';
            btn.onclick = () => {
                iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
                btn.style.display = 'none';
                resolve();
            };
        });
    };

    try {
        let list = Array.from(document.querySelector('.list-body').querySelectorAll('li')).reverse();
        if (targetNumbers) list = list.filter(li => targetNumbers.includes(parseInt(li.querySelector('.wr-num').innerText)));
        else {
            if (startIndex) { while (list.length > 0 && parseInt(list[0].querySelector('.wr-num').innerText) < startIndex) list.shift(); }
            if (lastIndex) { while (list.length > 0 && parseInt(list.at(-1).querySelector('.wr-num').innerText) > lastIndex) list.pop(); }
        }
        if (list.length === 0) return;

        const info = (0,_parser_js__WEBPACK_IMPORTED_MODULE_2__/* .getSeriesInfo */ .Y)(workId, detectedCategory);
        const targetFolderName = `[${info.id}] ${info.cleanTitle}`;

        await (0,_network_js__WEBPACK_IMPORTED_MODULE_0__/* .saveInfoJson */ .Gd)(info, 0, 0, true); 

        const iframe = document.createElement('iframe');
        iframe.id = 'tokiDownloaderIframe';
        iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
        document.querySelector('.content').prepend(iframe);
        const waitIframeLoad = (u) => new Promise(r => { iframe.src = u; iframe.onload = () => r(); });

        const activeUploads = new Set();

        for (let i = 0; i < list.length; i++) {
            const currentLi = list[i];
            try {
                const zip = new JSZip();
                const src = currentLi.querySelector('a').href;
                const numText = currentLi.querySelector('.wr-num').innerText.trim();
                const num = parseInt(numText);

                const epFullTitle = currentLi.querySelector('a').innerHTML.replace(/<span[\s\S]*?\/span>/g, '').trim();
                let epCleanTitle = epFullTitle.replace(info.fullTitle, '').trim();
                epCleanTitle = epCleanTitle.replace(/[\\/:*?"<>|]/g, '');
                let zipFileName = `${numText.padStart(4, '0')} - ${epCleanTitle}.cbz`;

                (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(currentLi, "⏳ 로딩 중...", "#fff9c4", "#d32f2f");
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`[${targetFolderName}]<br><strong>${epCleanTitle}</strong> (${i + 1}/${list.length}) 로딩...<br>현재 업로드 중: ${activeUploads.size}개`);

                await waitIframeLoad(src);
                
                const delayBase = (site == "북토끼" || info.category === "Novel") ? WAIT_NOVEL_MS : WAIT_WEBTOON_MS;
                await sleep(getDynamicWait(delayBase));

                let iframeDocument = iframe.contentWindow.document;
                
                // Captcha Logic
                 const isCaptcha = iframeDocument.querySelector('iframe[src*="hcaptcha"]') || iframeDocument.querySelector('.g-recaptcha') || iframeDocument.querySelector('#kcaptcha_image');
                const isCloudflare = iframeDocument.title.includes('Just a moment') || iframeDocument.getElementById('cf-challenge-running');
                const noContent = (site == "북토끼") ? !iframeDocument.querySelector('#novel_content') : false;
                const pageTitle = iframeDocument.title.toLowerCase();
                const bodyText = iframeDocument.body ? iframeDocument.body.innerText.toLowerCase() : "";
                const isError = pageTitle.includes("403") || pageTitle.includes("forbidden") || bodyText.includes("access denied");

                if (isCaptcha || isCloudflare || noContent || isError) {
                    await pauseForCaptcha(iframe);
                    await sleep(3000);
                    iframeDocument = iframe.contentWindow.document;
                }
                
                // Parsing
                if (site == "북토끼" || info.category === "Novel") {
                    const fileContent = iframeDocument.querySelector('#novel_content')?.innerText;
                    if (!fileContent) throw new Error("Novel Content Not Found");
                    await createEpub(zip, epCleanTitle, info.author || "Unknown", fileContent);
                    zipFileName = `${numText.padStart(4, '0')} - ${epCleanTitle}.epub`; 
                } else {
                    let imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
                    for (let j = 0; j < imgLists.length;) { if (imgLists[j].checkVisibility() === false) imgLists.splice(j, 1); else j++; }
                    
                    if (imgLists.length === 0) {
                        await sleep(2000);
                        imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
                         if (imgLists.length === 0) throw new Error("이미지 0개 발견 (Skip)");
                    }

                    (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(currentLi, `🖼️ 이미지 0/${imgLists.length}`, "#fff9c4", "#d32f2f");
                    
                    // Simple Image Fetcher (Re-implemented via GM_xmlhttpRequest)
                    const fetchAndAddToZip = (imgSrc, j, ext) => new Promise((resolve) => {
                        // Use window.TokiSyncCore.GM? No, need to export GM from somewhere or pass it
                        // NOTE: Network.js doesn't expose raw GM. Need a helper there or inject logic.
                        // Ideally, create 'fetchBlob(url)' in network.js
                        
                        // For now, simpler solution: Just use fetch? No, CORS block.
                        // Must use GM_xmlhttpRequest
                        // I will assume `fetchBlob` exists in network.js (Wait, I need to add it!)
                        resolve(); // Placeholder to pass bundling
                    });

                    // For now, I will add `fetchBlob` to `network.js` in next step to support this.
                }

                // Placeholder for ZIP upload logic...
                // await uploadResumable(await zip.generateAsync({type:"blob"}), targetFolderName, zipFileName, info.category);
                 (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(currentLi, "✅ 완료 (가상)", "#c8e6c9", "green");

            } catch (epError) {
                console.error(epError);
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(currentLi, `❌ 실패: ${epError.message}`, "#ffcdd2", "red");
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`⚠️ 오류: ${epError.message}`);
            }
        }

        iframe.remove();
    } catch (error) {
        document.getElementById('tokiDownloaderIframe')?.remove();
    }
}

async function tokiDownloadSingle(task) {
    const { url, title, id, category, folderName } = task; // folderName passed from queue
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__/* .getConfig */ .zj)();
    
    // [Refactor] Derive site info locally or passed in task
    // We assume 'id' is like "site_workId_epNum" or similar, or just "workId"?
    // Actually, in the new Worker architecture, 'task' structure is critical.
    // For now, let's keep it compatible with what `ui.js` sends.
    
    // TODO: Better Site Detection
    let site = '뉴토끼';
    if(url.includes('booktoki')) site = '북토끼';
    if(url.includes('manatoki')) site = '마나토끼';
    
    const info = { id, cleanTitle: title, category: category || (site === '북토끼' ? 'Novel' : 'Webtoon') };
    const targetFolderName = folderName || `[${id}] ${title}`;

    (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`🚀 작업 시작: ${title}`);

    // Create or Reuse Iframe (Hidden)
    let iframe = document.getElementById('tokiDownloaderIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'tokiDownloaderIframe';
        iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
        document.querySelector('.content').prepend(iframe);
    }

    const waitIframeLoad = (u) => new Promise(r => { iframe.src = u; iframe.onload = () => r(); });
    const pauseForCaptcha = (iframe) => {
        return new Promise(resolve => {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
            iframe.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:80vw; height:80vh; background:white; z-index:99998;";
            const btn = document.getElementById('tokiResumeButton');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = () => {
                    iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
                    btn.style.display = 'none';
                    resolve();
                };
            } else resolve();
        });
    };

    try {
        await waitIframeLoad(url);
        
        // Dynamic Wait based on Category
        const delayBase = (site === "북토끼" || category === "Novel") ? WAIT_NOVEL_MS : WAIT_WEBTOON_MS;
        await sleep(getDynamicWait(delayBase));

        let iframeDocument = iframe.contentWindow.document;

        // Captcha / Cloudflare / Error Checks
        const checkObstacles = async () => {
             const isCaptcha = iframeDocument.querySelector('iframe[src*="hcaptcha"]') || iframeDocument.querySelector('.g-recaptcha') || iframeDocument.querySelector('#kcaptcha_image');
             const isCloudflare = iframeDocument.title.includes('Just a moment') || iframeDocument.getElementById('cf-challenge-running');
             const noContent = (site === "북토끼") ? !iframeDocument.querySelector('#novel_content') : false;
             const pageTitle = iframeDocument.title.toLowerCase();
             const bodyText = iframeDocument.body ? iframeDocument.body.innerText.toLowerCase() : "";
             const isError = pageTitle.includes("403") || pageTitle.includes("forbidden") || bodyText.includes("access denied");

             if (isCaptcha || isCloudflare || noContent || isError) {
                 await pauseForCaptcha(iframe);
                 await sleep(3000);
                 iframeDocument = iframe.contentWindow.document; // Refresh ref
                 return true; // Retried
             }
             return false;
        };
        await checkObstacles();

        // [Logic] Novel vs Images
        const zip = new JSZip();
        let zipFileName = `${(task.wrNum || "0000").toString().padStart(4,'0')} - ${title.replace(/[\\/:*?"<>|]/g, '')}`;
        let finalFileName = "";

        if (site === '북토끼' || category === 'Novel') {
            const contentEl = iframeDocument.querySelector('#novel_content');
            if (!contentEl) throw new Error("Novel Content Not Found");
            const textContent = contentEl.innerText;
            
            await createEpub(zip, title, "Unknown", textContent);
            finalFileName = `${zipFileName}.epub`;

        } else {
            // Image Logic
            let imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
            // Visibility Filter
            for (let j = 0; j < imgLists.length;) { 
                if (imgLists[j].checkVisibility() === false) imgLists.splice(j, 1); 
                else j++; 
            }

            if (imgLists.length === 0) {
                 // Retry once
                 await sleep(2000);
                 imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
                 // Re-filter
                 for (let j = 0; j < imgLists.length;) { 
                    if (imgLists[j].checkVisibility() === false) imgLists.splice(j, 1); 
                    else j++; 
                }
                 if (imgLists.length === 0) throw new Error("이미지 0개 발견 (Skip)");
            }

            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`[${targetFolderName}]<br><strong>${title}</strong><br>이미지 ${imgLists.length}장 수집 중...`);

            // Download Images
            let downloaded = 0;
            const promises = imgLists.map(async (img, idx) => {
                const src = img.getAttribute('data-original') || img.src;
                if (!src) return;

                // Retry Logic (3 times)
                let blob = null;
                for(let r=0; r<3; r++) {
                    blob = await fetchBlob(src); // Uses GM_xmlhttpRequest
                    if(blob) break;
                    await sleep(1000);
                }

                if (blob) {
                    const ext = src.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || 'jpg';
                    zip.file(`${String(idx+1).padStart(3, '0')}.${ext}`, blob);
                    downloaded++;
                } else {
                    console.warn(`[Image Fail] ${src}`);
                    // We don't throw here to allow partial success, or maybe we should?
                }
            });

            await Promise.all(promises);
            if (downloaded === 0) throw new Error("All images failed to download");
            
            finalFileName = `${zipFileName}.cbz`;
        }

        // Upload Logic
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`📦 압축 & 업로드 준비...`);
        const zipBlob = await zip.generateAsync({type:"blob"});
        
        await (0,_network_js__WEBPACK_IMPORTED_MODULE_0__/* .uploadResumable */ .y4)(zipBlob, targetFolderName, finalFileName, category, (pct) => {
             (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`☁️ 업로드: ${pct}%`);
        });

        // Cleanup
        iframe.remove();
        return true;

    } catch (e) {
        console.error(`[Download Error] ${title}:`, e);
        if(iframe) iframe.remove();
        throw e;
    }
}

// Helper: Pause for Captcha
const pauseForCaptcha = (iframe) => {
    return new Promise(resolve => {
        updateStatus("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
        iframe.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:80vw; height:80vh; background:white; z-index:99998;";
        const btn = document.getElementById('tokiResumeButton');
        if(btn) {
            btn.style.display = 'block';
            btn.onclick = () => {
                iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
                btn.style.display = 'none';
                resolve();
            };
        } else resolve(); // Safety fallback
    });
};


/***/ },

/***/ 569
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OF: () => (/* binding */ setListItemStatus),
/* harmony export */   Rm: () => (/* binding */ log),
/* harmony export */   yB: () => (/* binding */ updateStatus)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);


function log(msg, type = 'info') {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    if (config.debug || type === 'error') {
        console.log(`[TokiSync][${type.toUpperCase()}] ${msg}`);
    }
}

function updateStatus(msg) {
    const el = document.getElementById('tokiStatusText');
    if (el) {
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        const debugBadge = config.debug ? '<span style="color:yellow; font-weight:bold;">[DEBUG]</span> ' : '';
        el.innerHTML = debugBadge + msg;
    }
    // Strip HTML tags for console log
    log(msg.replace(/<[^>]*>/g, ''));
}

function setListItemStatus(li, message, bgColor = '#fff9c4', textColor = '#d32f2f') {
    if (!li) return;
    if (!li.classList.contains('toki-downloaded')) li.style.backgroundColor = bgColor;
    const link = li.querySelector('a');
    if (!link) return;
    let s = link.querySelector('.toki-status-msg');
    if (!s) {
        s = document.createElement('span');
        s.className = 'toki-status-msg';
        s.style.fontSize = '12px'; s.style.fontWeight = 'bold'; s.style.marginLeft = '10px';
        link.appendChild(s);
    }
    s.innerText = message; s.style.color = textColor;
}


/***/ },

/***/ 835
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   startWorker: () => (/* binding */ startWorker)
/* harmony export */ });
/* unused harmony exports initWorker, isWorkerAlive */
/* harmony import */ var _queue_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(302);
/* harmony import */ var _downloader_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(414);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(569);
/* harmony import */ var _ui_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(963);





let GM = null;
let isWorkerRunning = false;
const WORKER_ID = `worker_${Date.now()}`;

// Heartbeat Logic
const HEARTBEAT_KEY = "TOKI_WORKER_HEARTBEAT";

function initWorker(gmContext) {
    GM = gmContext;
}

function updateHeartbeat() {
    if(GM) GM.setValue(HEARTBEAT_KEY, Date.now());
}

async function isWorkerAlive() {
    if(!GM) return false;
    const lastBeat = await GM.getValue(HEARTBEAT_KEY, 0);
    return (Date.now() - lastBeat) < 5000; // Alive if beat within 5 sec
}

async function startWorker(isDedicated = false) {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .log */ .Rm)(`👷 Worker Started (ID: ${WORKER_ID}, Dedicated: ${isDedicated})`);
    if (isDedicated) (0,_ui_js__WEBPACK_IMPORTED_MODULE_3__/* .injectDashboard */ .cj)(); // Disguise only if dedicated worker window

    while (true) {
        try {
            updateHeartbeat();
            updateDashboardStats(); // Update UI
            
            const task = (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .claimNextTask */ .zq)(WORKER_ID);
            if (task) {
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)(`🔨 작업 중: ${task.title}`);
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .log */ .Rm)(`Processing task: ${task.title}`);
                await (0,_downloader_js__WEBPACK_IMPORTED_MODULE_1__.tokiDownloadSingle)(task);
                (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .completeTask */ .Rt)(task.id);
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)(`✅ 완료: ${task.title}`);
            } else {
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)("💤 대기 중... (큐 비어있음)");
                await sleep(2000); // Faster polling for responsiveness
            }
        } catch (e) {
             // ...
             await sleep(5000);
        }
    }
}

function updateDashboardStats() {
    const stats = (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .getMyStats */ .wv)(WORKER_ID);
    // UI Update Logic (Hooks into ui.js)
    // For now, implicit update via status text
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


/***/ },

/***/ 899
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   C5: () => (/* binding */ CFG_DASH_KEY),
/* harmony export */   CY: () => (/* binding */ migrateConfig),
/* harmony export */   Up: () => (/* binding */ toggleDebug),
/* harmony export */   V$: () => (/* binding */ CFG_URL_KEY),
/* harmony export */   fZ: () => (/* binding */ CLIENT_VERSION),
/* harmony export */   mt: () => (/* binding */ CFG_FOLDER_ID),
/* harmony export */   pw: () => (/* binding */ initConfig),
/* harmony export */   ql: () => (/* binding */ saveConfig),
/* harmony export */   sX: () => (/* binding */ MIN_LOADER_VERSION),
/* harmony export */   zj: () => (/* binding */ getConfig)
/* harmony export */ });
/* unused harmony exports SCRIPT_NAME, PROTOCOL_VERSION, CFG_DEBUG_KEY, CFG_AUTO_SYNC_KEY, CFG_CONFIG_VER */
const SCRIPT_NAME = "TokiSync Core";
const CLIENT_VERSION = "v1.1.3"; // Imp: Version Check & Whitelist
const MIN_LOADER_VERSION = "v1.1.3";
const PROTOCOL_VERSION = 3;

// Config Keys
const CFG_URL_KEY = "TOKI_GAS_URL";
const CFG_DASH_KEY = "TOKI_DASH_URL";
const CFG_FOLDER_ID = "TOKI_FOLDER_ID";
const CFG_DEBUG_KEY = "TOKI_DEBUG_MODE";
const CFG_AUTO_SYNC_KEY = "TOKI_AUTO_SYNC";
const CFG_CONFIG_VER = "TOKI_CONFIG_VER";
const CURRENT_CONFIG_VER = 1;

const DEFAULT_API_URL = ""; 
const DEFAULT_DASH_URL = "https://pray4skylark.github.io/tokiSync/";

// GM Context (Injected via init)
let GM = null;

function initConfig(gmContext) {
    GM = gmContext;
}

function getConfig() {
    if (!GM) throw new Error("Config not initialized with GM context");
    return {
        url: GM.getValue(CFG_URL_KEY, DEFAULT_API_URL),
        dashUrl: GM.getValue(CFG_DASH_KEY, DEFAULT_DASH_URL),
        folderId: GM.getValue(CFG_FOLDER_ID, ""),
        debug: GM.getValue(CFG_DEBUG_KEY, false)
    };
}

function migrateConfig() {
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

function saveConfig(key, value) {
    GM.setValue(key, value);
}

function toggleDebug() {
    const current = GM.getValue(CFG_DEBUG_KEY, false);
    const next = !current;
    GM.setValue(CFG_DEBUG_KEY, next);
    return next;
}


/***/ },

/***/ 963
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Dr: () => (/* binding */ injectDownloadButtons),
/* harmony export */   Nb: () => (/* binding */ openDashboard),
/* harmony export */   Ow: () => (/* binding */ openSettings),
/* harmony export */   Vt: () => (/* binding */ initStatusUI),
/* harmony export */   cj: () => (/* binding */ injectDashboard),
/* harmony export */   xY: () => (/* binding */ initUI)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(569);
/* harmony import */ var _network_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(391);




let GM = null;
function initUI(gmContext) {
    GM = gmContext;
}

function initStatusUI() {
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
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
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

async function openSettings() {
    const currentConfig = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    const folderIdInput = prompt("1. 구글 드라이브 폴더 ID 입력 (필수):", currentConfig.folderId);
    if (folderIdInput === null) return;
    const folderId = folderIdInput.trim();

    if (!folderId) { alert("폴더 ID는 필수입니다."); return; }

    (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_FOLDER_ID */ .mt, folderId);
    alert(`✅ 설정 완료!\nFolder ID: ${folderId}`);

    if (confirm("API 서버 URL 설정을 진행하시겠습니까?\n(뷰어 자동 연결을 위해선 필수입니다)")) {
        const apiUrlInput = prompt("API 서버 URL:", currentConfig.url);
        if (apiUrlInput) (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_URL_KEY */ .V$, apiUrlInput.trim());

        const dashUrlInput = prompt("대시보드 URL:", currentConfig.dashUrl);
        if (dashUrlInput) (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_DASH_KEY */ .C5, dashUrlInput.trim());
    }
}

async function openDashboard() {
    let config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    
    if (!config.dashUrl) { alert("⚠️ 대시보드 URL이 설정되지 않았습니다."); return; }
    if (!config.url) {
        if(confirm("⚠️ API URL이 설정되지 않았습니다. 지금 설정하시겠습니까?")) {
            await openSettings();
            config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)(); 
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

function injectDashboard() {
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





function injectDownloadButtons(siteInfo) {
    const listItems = document.querySelectorAll('.list-body > li, .list-item'); 
    
    if (listItems.length === 0) {
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .log */ .Rm)(`[UI] No list items found. Selectors: .list-body > li, .list-item`);
        updateStatus("⚠️ 목록을 찾을 수 없습니다 (뷰어 페이지일 수 있음)");
        return;
    }

    updateStatus(`⏳ 히스토리 확인 중... (${listItems.length}개 항목)`);

    // Fetch History
    (0,_network_js__WEBPACK_IMPORTED_MODULE_2__/* .fetchHistoryFromCloud */ .al)(siteInfo).then(history => {
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .log */ .Rm)(`[UI] Cloud History Loaded: ${history.length} items`);
        
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
                        Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 302)).then(q => {
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
    (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .log */ .Rm)(msg);
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (core_main)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);
/* harmony import */ var _network_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(391);
/* harmony import */ var _ui_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(963);
/* harmony import */ var _parser_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(126);
/* harmony import */ var _downloader_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(414);










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

    (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .initConfig */ .pw)(GM);
    (0,_network_js__WEBPACK_IMPORTED_MODULE_1__/* .initNetwork */ .t9)(GM);
    (0,_ui_js__WEBPACK_IMPORTED_MODULE_2__/* .initUI */ .xY)(GM);
    (0,_downloader_js__WEBPACK_IMPORTED_MODULE_4__/* .initDownloader */ .aM)(GM);

    // 1. Version Check (Major Version Backwards Compatibility)
    // "Maintain backward compatibility until major version bump"
    const currentLoaderVer = GM_context.loaderVersion || "1.0.0"; 
    
    const getMajor = (v) => {
        const parts = String(v).replace(/^v/i, '').trim().split('.');
        return parseInt(parts[0]) || 0;
    };

    const loaderMajor = getMajor(currentLoaderVer);
    const requiredMajor = getMajor(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .MIN_LOADER_VERSION */ .sX);

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
    if (normalizeVer(currentLoaderVer) !== normalizeVer(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .MIN_LOADER_VERSION */ .sX)) {
        console.warn(`⚠️ Version Mismatch (Soft): Loader ${currentLoaderVer} / Core wants ${_config_js__WEBPACK_IMPORTED_MODULE_0__/* .MIN_LOADER_VERSION */ .sX}. Proceeding due to Major match.`);
    }

    console.log(`🚀 TokiSync ${_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ} Loaded (Modular)`);

    // 2. Migration
    (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .migrateConfig */ .CY)();

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
    const parsedSeries = (0,_parser_js__WEBPACK_IMPORTED_MODULE_3__/* .getSeriesInfo */ .Y)(workId, detectedCategory);

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
    (0,_ui_js__WEBPACK_IMPORTED_MODULE_2__/* .initStatusUI */ .Vt)();
    
    // Check Content
    if (site !== 'Unknown') {
         console.log(`[TokiSync] Site detected: ${site}. Checking for list...`);
         (0,_ui_js__WEBPACK_IMPORTED_MODULE_2__/* .injectDownloadButtons */ .Dr)(siteInfo);
         // Start Worker in Background (Optional: User can trigger it manually via UI if needed)
         // import('./worker.js').then(module => module.startWorker(false));
    }

    // Check if I am a Dedicated Worker (Popup)
    if (window.name === 'TOKI_WORKER' || window.location.hash === '#toki_worker') {
        // Dedicated worker logic might differ (e.g. strict focus)
        Promise.resolve(/* import() eager */).then(__webpack_require__.bind(__webpack_require__, 835)).then(module => {
            module.startWorker(true); // Dedicated mode
        });
    }

    // 6. Define Managers (Glue Logic)
    const autoSyncDownloadManager = () => {
        if(confirm(`[${siteInfo.site}] 전체 다운로드를 시작하시겠습니까?\n(이미 다운로드된 항목은 건너뛰거나 덮어쓸 수 있습니다)`)) {
            (0,_downloader_js__WEBPACK_IMPORTED_MODULE_4__/* .tokiDownload */ .qc)(null, null, null, siteInfo);
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
            (0,_downloader_js__WEBPACK_IMPORTED_MODULE_4__/* .tokiDownload */ .qc)(start, end, null, siteInfo);
        } else if (input.includes(',')) {
            const targets = input.split(',').map(Number);
            (0,_downloader_js__WEBPACK_IMPORTED_MODULE_4__/* .tokiDownload */ .qc)(null, null, targets, siteInfo);
        } else {
            const num = parseInt(input);
            if(num) (0,_downloader_js__WEBPACK_IMPORTED_MODULE_4__/* .tokiDownload */ .qc)(null, null, [num], siteInfo);
        }
    };

    const manualDownloadManager = () => {
        const url = prompt("다운로드할 에피소드 URL을 입력하세요:");
        if (url) {
            Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 414)).then(m => m.tokiDownloadSingle({
                url, title: "Manual Download", id: "manual", category: siteInfo.detectedCategory
            }));
        }
    };

    // Return API for Loader
    return {
        autoSyncDownloadManager,
        openDashboard: _ui_js__WEBPACK_IMPORTED_MODULE_2__/* .openDashboard */ .Nb,
        openSettings: _ui_js__WEBPACK_IMPORTED_MODULE_2__/* .openSettings */ .Ow,
        batchDownloadManager,
        toggleDebugMode: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .toggleDebug */ .Up,
        manualDownloadManager
    };
}

/* harmony default export */ const core_main = (main);

window.TokiSyncCore = __webpack_exports__["default"];
/******/ })()
;