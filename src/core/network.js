import { getConfig, CFG_FOLDER_ID, CFG_URL_KEY } from './config.js';
import { log, type } from './logger.js';
import { CLIENT_VERSION } from './config.js';

// GM context injected via init
let GM = null; 
let JSZip = null;

export function initNetwork(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
}

function checkAuthRequired(responseText) {
    if (responseText && responseText.trim().startsWith("<") && (responseText.includes("google.com") || responseText.includes("Google Accounts"))) {
        alert("⚠️ 구글 권한 승인이 필요합니다.\n확인을 누르면 새 창이 열립니다.\n권한을 승인(로그인 -> 허용)한 뒤, 다시 시도해주세요.");
        window.open(getConfig().url, '_blank');
        return true;
    }
    return false;
}

    export function fetchHistoryFromCloud(seriesInfo) {
    return new Promise((resolve, reject) => {
        const config = getConfig();
        if (!config.url || !config.folderId) { resolve([]); return; }
        
        const payload = { 
            folderId: config.folderId, 
            type: 'check_history', 
            protocolVersion: 3, 
            clientVersion: CLIENT_VERSION, 
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

export async function saveInfoJson(seriesInfo, fileCount, lastEpisode, forceThumbnailUpdate = false) {
    return new Promise(async (resolve) => {
        const config = getConfig();
        if (!config.url) { resolve(); return; }

        const payload = {
            folderId: config.folderId, 
            type: 'save_info', 
            protocolVersion: 3,
            clientVersion: CLIENT_VERSION, 
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

export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

const CHUNK_SIZE = 20 * 1024 * 1024;

export async function uploadResumable(blob, folderName, fileName, category, onProgress) {
    const config = getConfig();
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
                clientVersion: CLIENT_VERSION, 
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
                    clientVersion: CLIENT_VERSION, 
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
