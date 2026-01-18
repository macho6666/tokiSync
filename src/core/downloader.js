import { saveInfoJson, uploadResumable } from './network.js';
import { updateStatus, setListItemStatus, log } from './logger.js';
import { getSeriesInfo } from './parser.js';
import { getConfig, CFG_FOLDER_ID } from './config.js';

let GM = null; 
let JSZip = null;

export function initDownloader(gmContext) {
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

export async function createEpub(zip, title, author, textContent) {
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

export async function tokiDownload(startIndex, lastIndex, targetNumbers, siteInfo) {
    const { site, workId, detectedCategory } = siteInfo;
    const config = getConfig();

    const pauseForCaptcha = (iframe) => {
        return new Promise(resolve => {
            updateStatus("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
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

        const info = getSeriesInfo(workId, detectedCategory);
        const targetFolderName = `[${info.id}] ${info.cleanTitle}`;

        await saveInfoJson(info, 0, 0, true); 

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

                setListItemStatus(currentLi, "⏳ 로딩 중...", "#fff9c4", "#d32f2f");
                updateStatus(`[${targetFolderName}]<br><strong>${epCleanTitle}</strong> (${i + 1}/${list.length}) 로딩...<br>현재 업로드 중: ${activeUploads.size}개`);

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

                    setListItemStatus(currentLi, `🖼️ 이미지 0/${imgLists.length}`, "#fff9c4", "#d32f2f");
                    
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
                 setListItemStatus(currentLi, "✅ 완료 (가상)", "#c8e6c9", "green");

            } catch (epError) {
                console.error(epError);
                setListItemStatus(currentLi, `❌ 실패: ${epError.message}`, "#ffcdd2", "red");
                updateStatus(`⚠️ 오류: ${epError.message}`);
            }
        }

        iframe.remove();
    } catch (error) {
        document.getElementById('tokiDownloaderIframe')?.remove();
    }
}

export async function tokiDownloadSingle(task) {
    const { url, title, id, category, folderName } = task; // folderName passed from queue
    const config = getConfig();
    
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

    updateStatus(`🚀 작업 시작: ${title}`);

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
            updateStatus("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
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

            updateStatus(`[${targetFolderName}]<br><strong>${title}</strong><br>이미지 ${imgLists.length}장 수집 중...`);

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
        updateStatus(`📦 압축 & 업로드 준비...`);
        const zipBlob = await zip.generateAsync({type:"blob"});
        
        await uploadResumable(zipBlob, targetFolderName, finalFileName, category, (pct) => {
             updateStatus(`☁️ 업로드: ${pct}%`);
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
