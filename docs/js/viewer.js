/**
 * 🎨 TokiSync Viewer Logic
 * - Episode List Management
 * - Image Viewer (1-page / 2-page / RTL)
 * - Chunk Downloading & Unzipping
 */

// State
let currentBookList = [];
let currentBookIndex = -1;
/**
 * 뷰어 상태 객체
 * @property {string} mode - 보기 모드 ('1page' | '2page')
 * @property {boolean} coverPriority - 2쪽 보기 시 표지(첫장) 단독 표시 여부
 * @property {boolean} rtlMode - 오른쪽에서 왼쪽으로 읽기 (만화 모드)
 * @property {Array<Object>} images - 이미지 객체 리스트 ({src, width, height, loaded})
 * @property {Array<Array<number>>} spreads - 펼침면 구성 (페이지 인덱스 배열의 배열)
 * @property {number} currentSpreadIndex - 현재 보고 있는 펼침면 인덱스
 * @property {boolean} preload - 다음 화 미리 불러오기 활성화 여부
 */
let vState = {
    mode: '1page', // '1page' or '2page'
    coverPriority: true,
    rtlMode: false,
    images: [], 
    spreads: [], 
    currentSpreadIndex: 0,
    settingsTimer: null,
    preload: true,
    settingsTimer: null,
    preload: true,
    scrollMode: false, // Webtoon Mode
    epubMode: false, // Novel Mode
    textSettings: {
        fontSize: 18,
        lineHeight: 1.8
    }
};
let nextBookPreload = null;

// Data Reuse Cache
let cachedFileId = null;
let cachedBytes = null;

// ============================================================
// 1. Episode List
// ============================================================
/**
 * 회차 목록 모달을 열고 데이터를 로드합니다.
 * @param {string} seriesId - 시리즈 폴더 ID
 * @param {string} title - 시리즈 제목
 * @param {number} seriesIndex - (Optional) 시리즈 인덱스
 */
async function openEpisodeList(seriesId, title, seriesIndex) {
    document.getElementById('episodeModal').style.display = 'flex';
    document.querySelector('#episodeModal .modal-title').innerText = `📄 ${title}`;
    const listEl = document.getElementById('episodeList');
    listEl.innerHTML = '<div style="padding:20px; color:#888;">로딩 중...</div>';

    try {
        const books = await API.request('view_get_books', { seriesId: seriesId });
        document.querySelector('#episodeModal .modal-title').innerText = `📄 ${title} (${books ? books.length : 0}개)`;
        renderEpisodeList(books, seriesId);
    } catch (e) {
        listEl.innerHTML = `<div style="padding:20px; color:red;">오류: ${e.message}</div>`;
    }
}

/**
 * 회차 목록 UI를 렌더링합니다.
 * - .cbz/.zip 파일은 뷰어로 열기
 * - 폴더는 새 탭(구글 드라이브)으로 열기
 * - 'Read' 뱃지 표시
 * 
 * @param {Array<Object>} books - 회차 목록
 * @param {string} seriesId - 시리즈 ID (읽음 기록 조회를 위해 필요)
 */
function renderEpisodeList(books, seriesId) {
    currentBookList = books || [];
    const listEl = document.getElementById('episodeList');
    listEl.innerHTML = '';
    const history = getReadHistory(seriesId);

    if (!books || books.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; color:#888;">표시할 회차가 없습니다.</div>';
        return;
    }

    books.forEach((book, index) => {
        book.seriesId = seriesId; 
        const div = document.createElement('div');
        div.className = 'episode-item';

        let icon = '📁';
        let meta = '폴더';
        let isRead = history[book.id];
        let clickHandler = () => window.open(book.url, '_blank');

        // Check file type
        if (book.media && book.media.mediaType && !book.media.mediaType.includes('folder')) {
            icon = '📦';
            meta = formatSize(book.size);

            const name = book.name.toLowerCase();
            if (name.endsWith('.cbz') || name.endsWith('.zip') || name.endsWith('.epub')) {
                icon = '📖';
                clickHandler = () => loadViewer(index); // Launch Viewer
            }
        }

        div.innerHTML = `
            <div>
                <span style="margin-right:10px;">${icon}</span>
                <span class="ep-name" style="${isRead ? 'color:#888;' : ''}">${book.name}</span>
                ${isRead ? '<span class="read-badge active">READ</span>' : ''}
            </div>
            <span class="ep-meta">${meta}</span>
        `;
        div.onclick = clickHandler;
        listEl.appendChild(div);
    });
}

function closeEpisodeModal() {
    document.getElementById('episodeModal').style.display = 'none';
}

// ============================================================
// 2. Viewer Core
// ============================================================
/**
 * 뷰어를 초기화하고 이미지를 로드합니다.
 * 
 * @param {number} index - currentBookList 내의 회차 인덱스
 * @param {boolean} [isContinuous=false] - 연속 읽기 여부 (true면 처음부터, false면 저장된 페이지부터 시작)
 */
async function loadViewer(index, isContinuous = false) {
    const book = currentBookList[index];
    if (!book) return;

    closeEpisodeModal();
    currentBookIndex = index;
    loadViewerSettings();

    const viewer = document.getElementById('viewerOverlay');
    const content = document.getElementById('viewerContent');
    const container = document.getElementById('viewerImageContainer');
    vState.scrollMode = vState.scrollMode; // This line seems to be a placeholder or intended for a parameter 'isScrollMode'
    vState.spreads = []; // Reset spreads
    window.isViewerLoading = true; // Lock Input
    
    // Show Viewer
    viewer.style.display = 'flex';
    document.body.classList.add('no-scroll'); // Prevent BG scroll

    // Initial UI
    container.innerHTML = '<div style="color:white; font-size:14px;">로딩 중... (0%)</div>';
    updateNavHandlers();
    
    // Reset Scroll Mode UI
    if(vState.scrollMode) {
        content.classList.add('scroll-mode');
        container.classList.remove('viewer-image-container'); // Detach standard container logic
        container.style.display = 'none'; // Hide standard container
        
        // Ensure scroll container exists
        let scrollContainer = document.getElementById('viewerScrollContainer');
        if(!scrollContainer) {
            scrollContainer = document.createElement('div');
            scrollContainer.id = 'viewerScrollContainer';
            scrollContainer.className = 'viewer-scroll-container';
            content.appendChild(scrollContainer);
        }
        scrollContainer.innerHTML = '<div style="color:white; font-size:14px; padding:20px;">로딩 중... (0%)</div>';
        scrollContainer.style.display = 'block'; // Block for vertical stacking
    } else {
        content.classList.remove('scroll-mode');
        container.classList.add('viewer-image-container');
        container.style.display = 'flex';
        const sc = document.getElementById('viewerScrollContainer');
        if(sc) sc.style.display = 'none';
    }

    try {
        let result = null;
        let blobUrls = [];
        
        // Check Preload
        if (nextBookPreload && nextBookPreload.index === index && Array.isArray(nextBookPreload.images)) {
            console.log("Using preloaded data!");
            blobUrls = nextBookPreload.images;
            nextBookPreload = null;
        } else {
            // Clear invalid preload
            if (nextBookPreload && nextBookPreload.index === index) nextBookPreload = null;

             // Pass Total Size for Adaptive Logic
            result = await fetchAndUnzip(book.id, book.size || 0, (progress) => {
                const el = container.querySelector('div');
                if (el) el.innerText = progress;
            });
            blobUrls = result; // Temp assignment checks are below
        }

        if (!result || (result.type === 'images' && result.images.length === 0)) throw new Error("콘텐츠를 찾을 수 없습니다.");

        if (result.type === 'epub_legacy') {
            vState.epubMode = true;
            updateButtonStates(); // Sync UI
            renderLegacyMode(result.content);
            return;
        } else if (result.type === 'epub') {
             throw new Error("지원되지 않는 EPUB 형식입니다.");
        } else {
            vState.epubMode = false;
            updateButtonStates(); // Sync UI
            blobUrls = result.images;
        }

        // Setup Images
        vState.images = blobUrls.map(url => ({ src: url, width: 0, height: 0, loaded: false }));
        
        // Load Dimensions for Smart Spreads
        await loadAllImageDimensions(vState.images);

        // Calculate Spreads first
        recalcSpreads(false); // Don't reset page yet

        // Restore Progress (unless continuous read)
        const lastPage = getProgress(book.seriesId, book.id);
        if (!isContinuous && lastPage > 0 && lastPage < vState.images.length) {
            // Find spread containing this image
            const spreadIdx = vState.spreads.findIndex(spread => spread.includes(lastPage));
            vState.currentSpreadIndex = spreadIdx >= 0 ? spreadIdx : 0;
            showToast(`📑 이어보기: ${lastPage + 1}페이지`);
        } else {
            vState.currentSpreadIndex = 0;
        }

        if (vState.scrollMode) {
            renderScrollMode();
            // Restore scroll position
            const lastPage = getProgress(book.seriesId, book.id);
             if (!isContinuous && lastPage > 0) {
                 scrollToPage(lastPage);
             }
        } else {
             // 1-page/2-page
             recalcSpreads(false);
             const lastPage = getProgress(book.seriesId, book.id);
             if (!isContinuous && lastPage > 0 && lastPage < vState.images.length) {
                 const spreadIdx = vState.spreads.findIndex(spread => spread.includes(lastPage));
                 vState.currentSpreadIndex = spreadIdx >= 0 ? spreadIdx : 0;
                 showToast(`📑 이어보기: ${lastPage + 1}페이지`);
             } else {
                 vState.currentSpreadIndex = 0;
             }
             renderCurrentSpread();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:red; text-align:center;">오류 발생: ${e.message}<br><button onclick="closeViewer()" style="margin-top:20px; padding:10px;">닫기</button></div>`;
    } finally {
        // Unlock input (except if Foliate which handles it internally, but Legacy/Image are done)
        // Give a small buffer for layout
        setTimeout(() => { window.isViewerLoading = false; }, 500);
    }
}

/* Legacy renderEpubMode removed in favor of Foliate */
/* Legacy renderEpubMode removed in favor of Foliate */
function applyTextSettings() {
    // 1. Legacy Mode Support - Unified Structure
    if (vState.epubMode && !vState.foliateView) {
        const el = document.querySelector('.epub-content');
        if(el) {
            el.style.fontSize = `${vState.textSettings.fontSize}px`;
            el.style.lineHeight = vState.textSettings.lineHeight;

            // Apply 2-Page / 1-Page Column Logic
            if (vState.scrollMode) {
                 el.style.columnCount = 'auto';
                 el.style.width = '100%';
                 el.style.height = '100%'; // Must be constrained for overflow-y to work
                 el.style.overflowY = 'auto'; // Vertical scroll enabled
                 el.style.overflowX = 'hidden';
            } else {
                // Paged Mode
                // Force fixed height to viewport minus margins to ensure multi-column generation
                // 100vh - (Header 50px + Footer 50px + Margin 40px) approx 140px safe zone
                el.style.height = 'calc(100vh - 120px)'; 
                el.style.width = 'auto'; // Must be auto to expand horizontally
                el.style.overflowX = 'hidden'; // Hidden because we use scrollBy? No, standard horizontal scroll needs hidden URL bar? 
                // Actually for JS scrollBy to work, it must be scrollable.
                // Usually overflow-x: hidden allows programmatic scroll but hides bar.
                el.style.overflowX = 'hidden'; 
                el.style.overflowY = 'hidden';
                
                if (vState.mode === '2page') {
                    el.style.columnCount = 2;
                    el.style.columnGap = '80px'; // Wider gap for spread look
                } else {
                    el.style.columnCount = 1; 
                    el.style.columnGap = '0px';
                }
            }
        }
        return;
    }

    // 2. Foliate Mode
    if (!vState.foliateView || !vState.foliateView.renderer) return;
    
    // Foliate manages content in iframes (renderer.getContents())
    // We need to apply styles to each active document
    const contents = vState.foliateView.renderer.getContents();
    for (const content of contents) {
        if (content.doc) {
            content.doc.body.style.fontSize = `${vState.textSettings.fontSize}px`;
            content.doc.body.style.lineHeight = vState.textSettings.lineHeight;
            // Dark Mode / Theme Handling (Future)
            content.doc.body.style.color = '#333';
            content.doc.body.style.backgroundColor = '#fff';
        }
    }
}

function changeFontSize(delta) {
    if (!vState.epubMode || !vState.foliateView) return;
    
    // Update State
    vState.textSettings.fontSize += delta;
    if(vState.textSettings.fontSize < 12) vState.textSettings.fontSize = 12;
    if(vState.textSettings.fontSize > 48) vState.textSettings.fontSize = 48; // Increased max
    
    // Save
    localStorage.setItem('toki_v_fontsize', vState.textSettings.fontSize);
    
    // Apply
    applyTextSettings();
    showToast(`글자 크기: ${vState.textSettings.fontSize}px`);
}

/**
 * .cbz 파일을 청크 단위로 다운로드하고 압축을 해제합니다.
 * 
 * [Stream Process]
 * 1. GAS API(view_get_chunk)를 호출하여 10MB 단위로 다운로드.
 * 2. `chunks` 배열에 바이너리 데이터를 누적.
 * 3. `JSZip`을 사용하여 압축 해제.
 * 4. 이미지 파일만 필터링하여 Blob URL 생성.
 * 
 * @param {string} fileId - 파일 ID
 * @param {Function} onProgress - 진행률 콜백
 * @returns {Promise<Array<string>>} Blob URL 리스트 (파일명 순 정렬됨)
 */
/**
 * .cbz 파일을 다운로드하고 압축을 해제합니다.
 * 
 * [Adaptive Strategy]
 * 1. Small File (< 26MB): Single Fetch (Range-less or Full Range)
 * 2. Large File (>= 26MB): Concurrent Chunk Fetch (10MB chunks, Max 3 concurrent)
 * 
 * @param {string} fileId - 파일 ID
 * @param {number} totalSize - 파일 전체 크기 (bytes)
 * @param {Function} onProgress - 진행률 콜백
 * @returns {Promise<Array<string>>} Blob URL 리스트
 */
async function fetchAndUnzip(fileId, totalSize, onProgress) {
    let combinedBytes = null;
    const SAFE_THRESHOLD = 26 * 1024 * 1024; // 26MB

    // Check Reuse Cache
    if (cachedFileId === fileId && cachedBytes) {
        console.log("♻️ Using cached data for re-render");
        combinedBytes = cachedBytes;
        // Skip network logic
    } else {
        // Clear old cache
        cachedFileId = null;
        cachedBytes = null;

        if (totalSize > 0 && totalSize < SAFE_THRESHOLD) {
        // [Mode A] Single Fetch
        console.log(`📉 Small File detected (${formatSize(totalSize)}). using Single Fetch.`);
        if (onProgress) onProgress(`다운로드 중... (0%)`);
        
        try {
            const response = await API.request('view_get_chunk', {
                fileId: fileId,
                offset: 0,
                length: totalSize 
            });
            if (response && response.data) {
                 const binaryString = atob(response.data);
                 const len = binaryString.length;
                 combinedBytes = new Uint8Array(len);
                 for (let i = 0; i < len; i++) combinedBytes[i] = binaryString.charCodeAt(i);
                 if (onProgress) onProgress(`다운로드 완료 (100%)`);
            } else {
                throw new Error("Empty Response");
            }
        } catch (e) {
            console.warn("Single Fetch failed, falling back to Chunk mode", e);
            // Fallback will happen naturally if combinedBytes remains null?
            // No, strictly separate logic. If fail, throw.
            throw new Error("다운로드 실패: " + e.message);
        }

    } else {
        // [Mode B] Concurrent Chunk Fetch
        console.log(`📈 Large File detected (${formatSize(totalSize)}). using Concurrent Chunk Fetch.`);
        
        const chunks = [];
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
        let offset = 0;
        
        // 1. Calculate Chunks needed
        // If totalSize is unknown (0), we can't use parallel accurately. Fallback to sequential.
        if (totalSize === 0) {
             // Sequential Fallback (Existing Logic)
             return fetchAndUnzipSequentialFallback(fileId, onProgress);
        }

        const chunkCount = Math.ceil(totalSize / CHUNK_SIZE);
        const tasks = [];
        
        for (let i = 0; i < chunkCount; i++) {
            tasks.push({ index: i, start: i * CHUNK_SIZE, length: CHUNK_SIZE });
        }

        let completed = 0;
        const results = new Array(chunkCount); 

        // Worker Pool (Max Concurrency: 3)
        const CONCURRENCY = 3;
        
        const worker = async () => {
             while (tasks.length > 0) {
                 const task = tasks.shift();
                 const currentOffset = task.start;
                 
                 // Retry Logic
                 let retries = 3;
                 while(retries > 0) {
                     try {
                         const response = await API.request('view_get_chunk', {
                            fileId: fileId,
                            offset: currentOffset,
                            length: task.length
                        });
                        
                        if (!response) throw new Error("No response");
                        
                        const binaryString = atob(response.data);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let k = 0; k < len; k++) bytes[k] = binaryString.charCodeAt(k);
                        
                        results[task.index] = bytes;
                        completed++;

                        if (onProgress) {
                             const percent = Math.round((completed / chunkCount) * 100);
                             onProgress(`다운로드 중... (${percent}%)`);
                        }
                        break; // Success
                     } catch (e) {
                         console.warn(`Chunk ${task.index} failed, retrying...`, e);
                         retries--;
                         if (retries === 0) throw e;
                         await new Promise(r => setTimeout(r, 1000));
                     }
                 }
             }
        };

        const workers = [];
        for(let k=0; k<CONCURRENCY; k++) workers.push(worker());
        await Promise.all(workers);

        // Merge
        if (onProgress) onProgress('병합 중...');
        let totalLen = 0;
        results.forEach(r => totalLen += r.length);
        combinedBytes = new Uint8Array(totalLen);
        let pos = 0;
        results.forEach(r => {
            combinedBytes.set(r, pos);
            pos += r.length;
        });
    } // End of Network Fetch (if)

    } // End of Cache Check Else Block

    // Update Cache
    if (combinedBytes) {
        cachedFileId = fileId;
        cachedBytes = combinedBytes;
    }

    if (onProgress) onProgress('압축 해제 중...');

    // Unzip (Using JSZip global)
    if (typeof JSZip === 'undefined') throw new Error("JSZip 라이브러리가 없습니다.");
    const zip = await JSZip.loadAsync(combinedBytes);
    
    const files = Object.keys(zip.files).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Check for EPUB
    // Check for EPUB
    const isEpub = zip.file("OEBPS/content.opf") || zip.file("OPS/content.opf") || zip.file("mimetype");

    if (isEpub) {
        // [New] Image EPUB Detection (Comic EPUB)
        // Check if file contains mostly images
        const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|webp|gif)$/i));
        const textFiles = files.filter(f => f.match(/\.(xhtml|html)$/i));

        // If it looks like a Comic (Many images, or more images than text chapters)
        if (imageFiles.length > 5 && imageFiles.length >= textFiles.length) {
            console.log("📘 Comic EPUB Detected -> Using Image Mode");
            // Do NOT return here. Fall through to Image Extraction loop below.
        } else {
            // Text EPUB detected
            console.log(`📘 Text EPUB Detected (Using Built-in Viewer)`);
    
            let htmlContent = "";
            // Find chapter.xhtml or any HTML
            let targetFile = zip.file("OEBPS/Text/chapter.xhtml");
            if (!targetFile) {
                const htmlFiles = files.filter(f => f.match(/\.(xhtml|html)$/i));
                if (htmlFiles.length > 0) targetFile = zip.file(htmlFiles[0]);
            }
            if (targetFile) {
                htmlContent = await targetFile.async("string");
                return { type: 'epub_legacy', content: htmlContent };
            }
            // Fallback if no HTML found?
            throw new Error("EPUB 내에서 텍스트 파일을 찾을 수 없습니다.");
        }
    }

    const imageUrls = [];
    for (const filename of files) {
        if (filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            const blob = await zip.files[filename].async('blob');
            imageUrls.push(URL.createObjectURL(blob));
        }
    }
    return { type: 'images', images: imageUrls };
}

/* Legacy EPUB Rendering (Simple HTML) */
/* Legacy EPUB Rendering (Simple HTML) - Unified Structure */
function renderLegacyMode(htmlContent) {
    // 1. Use Unified Container
    const container = document.getElementById('viewerImageContainer');
    const scrollContainer = document.getElementById('viewerScrollContainer'); 

    // Hide old container if it exists
    if (scrollContainer) scrollContainer.style.display = 'none';
    
    // Show Unified Container
    container.style.display = 'flex';
    container.innerHTML = '';
    container.classList.add('epub-mode');
    
    // 2. Render inside .viewer-spread
    const viewClass = vState.scrollMode ? 'scroll-view' : 'paged-view';
    
    container.innerHTML = `
        <div class="viewer-spread ${vState.rtlMode ? 'is-rtl' : ''}">
            <div class="viewer-page-wrapper text-mode">
                 <div class="epub-content ${viewClass}" style="font-size:${vState.textSettings.fontSize}px; line-height:${vState.textSettings.lineHeight}; color: inherit;">
                    ${htmlContent}
                 </div>
            </div>
        </div>
    `;
    
    // 3. Apply Settings
    applyTextSettings();
    
    // 4. Restore Scroll Listener for Scroll Mode (Legacy Infinite Scroll support)
    if (vState.scrollMode) {
        const content = container.querySelector('.epub-content');
        if (content) {
            content.onscroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = content;
                
                // 1. Check Infinite Scroll (Next Episode)
                // Block trigger if restoring position
                if (window.isRestoring) return;
                
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                     // Double-Tap Logic for Infinite Scroll
                     if (!window.scrollBottomTriggered) {
                         window.scrollBottomTriggered = true;
                         window.scrollBottomTimestamp = Date.now(); // Latch time
                         showToast("마지막입니다. 계속 내리면 다음 화로 이동합니다.");
                         return;
                     }
                     
                     // Time Latch: Prevent immediate trigger within 1 second
                     if (Date.now() - window.scrollBottomTimestamp < 1000) {
                         return;
                     }

                     if (!window.isLoadingNext) checkNextEpisodeTrigger();
                } else {
                    // Reset if user scrolls up away from bottom
                    if (scrollHeight - (scrollTop + clientHeight) > 100) {
                        window.scrollBottomTriggered = false;
                        window.scrollBottomTimestamp = 0;
                    }
                }

                // 3. Update Page Counter (Approximate)
                const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0;
                // console.log(`[ScrollEvent] Top: ${scrollTop}, H: ${scrollHeight}, Percent: ${percent}%`);
                
                const counter = document.getElementById('pageCounter');
                if (counter) {
                    counter.innerText = `${percent}%`;
                } else {
                    console.warn("[ScrollEvent] #pageCounter not found");
                }

                // 2. Save Anchor (Throttled)
                if (!window.saveAnchorTimer) {
                    window.saveAnchorTimer = setTimeout(() => {
                        window.saveAnchorTimer = null;
                        const anchor = findVisibleAnchor(content);
                        if (anchor && currentBookList[currentBookIndex]) {
                             saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, anchor);
                             // console.log("Saved Anchor:", anchor);
                        }
                    }, 500);
                }
            };

            // 3. Restore Progress (Anchor)
            if (currentBookList[currentBookIndex]) {
                 const progress = getProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
                 if (progress && typeof progress === 'object' && progress.index !== undefined) {
                      // It's an anchor object
                      // Set Guard Flag
                      window.isRestoring = true;
                      
                      setTimeout(() => {
                           const candidates = content.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
                           if (candidates[progress.index]) {
                                candidates[progress.index].scrollIntoView({ block: 'start' });
                                showToast(`🔖 저장된 위치(${progress.index}번째 문단)로 이동했습니다.`);
                           }
                           // Release Guard after delay
                           setTimeout(() => { window.isRestoring = false; }, 1000);
                      }, 100); // Small delay for layout
                 }
            }
        }
    }
}

/**
 * 텍스트 뷰어(페이지 모드) 페이지 이동
 */
function navigateTextPage(dir) {
    // Locate the unique text content container
    const content = document.querySelector('.epub-content.paged-view');
    if (!content) return;

    // Use content as the scroll container
    const container = content;
    
    // Dimensions
    const pageWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    let currentScroll = container.scrollLeft;

    // Direction Logic
    const isRtl = vState.rtlMode;
    
    console.log(`[Nav] Dir: ${dir}, Scroll: ${currentScroll}/${scrollWidth}, Client: ${pageWidth}`);

    // Boundary Detection
    // 1. Next Page
    if (dir === 1) { 
        if (Math.abs(currentScroll + pageWidth - scrollWidth) < 10 || currentScroll + pageWidth >= scrollWidth) {
             console.log("[Nav] End of Chapter Reached");
             if (!window.isLoadingNext) checkNextEpisodeTrigger();
             return;
        }
        container.scrollBy({ left: pageWidth, behavior: 'smooth' });
    } 
    // 2. Prev Page
    else {
        if (currentScroll <= 10) { 
            console.log("[Nav] Start of Chapter");
            showToast("첫 페이지입니다.");
            return;
        }
        container.scrollBy({ left: -pageWidth, behavior: 'smooth' });
    }
    
    // Update Progress
    setTimeout(() => {
        const page = Math.round(container.scrollLeft / pageWidth) + 1;
        const total = Math.ceil(container.scrollWidth / pageWidth);
        const safeTotal = total > 0 ? total : 1;
        const safePage = page > safeTotal ? safeTotal : (page < 1 ? 1 : page);
        
        const counter = document.getElementById('pageCounter');
        if(counter) counter.innerText = `${safePage} / ${safeTotal}`;
    }, 400); 
}


// Fallback for unknown size (Sequential)
async function fetchAndUnzipSequentialFallback(fileId, onProgress) {
    const chunks = [];
    let offset = 0;
    let totalLength = 0;
    const CHUNK_SIZE = 10 * 1024 * 1024; 

    while (true) {
        const response = await API.request('view_get_chunk', {
            fileId: fileId,
            offset: offset,
            length: CHUNK_SIZE
        });

        if (!response) break;

        const binaryString = atob(response.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        chunks.push(bytes);
        totalLength += len;
        offset = response.nextOffset;

        if (onProgress) {
            const percent = Math.round((offset / response.totalSize) * 100);
            onProgress(`다운로드 중... (${percent}%)`);
        }

        if (!response.hasMore) break;
    }
    
    const combinedBytes = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
        combinedBytes.set(chunk, position);
        position += chunk.length;
    }

    const zip = await JSZip.loadAsync(combinedBytes);
    const files = Object.keys(zip.files).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const imageUrls = [];
    for (const filename of files) {
        if (filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            const blob = await zip.files[filename].async('blob');
            imageUrls.push(URL.createObjectURL(blob));
        }
    }
    return imageUrls;
}

// ============================================================
// 3. View Logic (Spreads, Nav)
// ============================================================
/**
 * 보기 모드(1쪽/2쪽)와 이미지 크기(가로/세로)에 따라 페이지(Spread)를 재구성합니다.
 * 
 * [Logic]
 * - 1쪽 보기: 각 이미지가 하나의 Spread가 됨.
 * - 2쪽 보기:
 *   - 가로형 이미지(Landscape): 단독 페이지 사용.
 *   - 표지 모드(Cover Priority): 첫 페이지는 무조건 단독 사용.
 *   - 세로형 이미지: 가능한 경우 두 장을 하나의 Spread로 묶음.
 * 
 * @param {boolean} [resetPage=false] - 현재 페이지 인덱스를 0으로 초기화할지 여부
 */
function recalcSpreads(resetPage = false) {
    vState.spreads = [];
    const images = vState.images;
    
    if (vState.mode === '1page') {
        for(let i=0; i<images.length; i++) vState.spreads.push([i]);
    } else {
        // 2-page logic
        let i = 0;
        if (vState.coverPriority && images.length > 0) {
             vState.spreads.push([0]);
             i = 1;
        }
        while (i < images.length) {
            const current = images[i];
            // If landscape -> Single
            if (current.width > current.height) {
                vState.spreads.push([i]);
                i++;
                continue;
            }
            // Pair?
            if (i + 1 < images.length) {
                const next = images[i+1];
                if (next.width > next.height) { // Next is landscape -> break pair
                     vState.spreads.push([i]);
                     i++;
                } else {
                     vState.spreads.push([i, i+1]);
                     i += 2;
                }
            } else {
                vState.spreads.push([i]);
                i++;
            }
        }
    }
    
    if (resetPage) vState.currentSpreadIndex = 0;
    renderCurrentSpread();
}

/**
 * 현재 Spread(vState.currentSpreadIndex)를 DOM에 그립니다.
 * 
 * [Main Actions]
 * 1. 이미지 태그 생성 및 RTL 모드 적용
 * 2. 페이지 카운터 갱신
 * 3. 현재 페이지 진행도 저장 (`saveProgress`)
 * 4. 마지막 페이지 도달 시 '완독' 처리 (`saveReadHistory`)
 * 5. 남은 페이지가 4장 미만일 때 다음 화 프리로드 트리거 (`preloadNextEpisode`)
 */
function renderCurrentSpread() {
    if (!vState.spreads || vState.spreads.length === 0) return;
    
    const container = document.getElementById('viewerImageContainer');
    const counter = document.getElementById('pageCounter');
    const spreadIndices = vState.spreads[vState.currentSpreadIndex];
    if (!spreadIndices) {
        console.error(`Rendering Error: Invalid Spread Index ${vState.currentSpreadIndex} / ${vState.spreads.length}`);
        return;
    }
    
    // RTL
    const dirStyle = vState.rtlMode ? 'flex-direction:row-reverse;' : '';

    container.innerHTML = `<div class="viewer-spread ${vState.rtlMode ? 'is-rtl' : ''}" style="${dirStyle}">
        ${spreadIndices.map(idx => `
            <div class="${spreadIndices.length > 1 ? 'half' : ''}">
                <img src="${vState.images[idx].src}" class="viewer-page">
            </div>
        `).join('')}
    </div>`;
    
    // Counter
    const start = spreadIndices[0] + 1;
    const end = spreadIndices[spreadIndices.length-1] + 1;
    const total = vState.images.length;
    counter.innerText = (start === end) ? `${start} / ${total}` : `${start}-${end} / ${total}`;

    // Save Progress
    const currentImgIdx = spreadIndices[0]; // Use first image of spread as marker
    saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, currentImgIdx);

    // Check Finish (Mark Read if last page)
    if (vState.currentSpreadIndex === vState.spreads.length - 1) {
        saveReadHistory(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
        const modal = document.getElementById('episodeModal');
        if (modal.style.display === 'flex') {
             // Refresh list if open behind
             // renderEpisodeList(currentBookList, currentBookList[currentBookIndex].seriesId); 
             // (Optional: might be too heavy/distracting)
        }
    }

    // Preload Trigger
    if (vState.spreads.length - vState.currentSpreadIndex <= 4) {
         preloadNextEpisode();
    }
    
    // Update Slider
    updateSliderUI();
}

// Navigation
/**
 * 뷰어 페이지를 이동합니다.
 * 
 * @param {number} dir - 이동 방향 (1: 다음, -1: 이전)
 */
function navigateViewer(dir) {
    if (window.isViewerLoading) return; // Block input during load
    
    if (vState.scrollMode) {
        navigateScrollMode(dir);
        return;
    }
    
    if (vState.epubMode && !vState.foliateView) {
        // Text Page Mode Navigation (Legacy Paged)
        navigateTextPage(dir);
        return;
    }

    const nextIdx = vState.currentSpreadIndex + dir;
    if (nextIdx >= vState.spreads.length) {
        if (currentBookIndex < currentBookList.length - 1) {
             if (confirm("다음 화로 이동하시겠습니까?")) loadViewer(currentBookIndex + 1, true);
        } else {
             showToast("마지막 화입니다.");
        }
        return;
    }
    if (nextIdx < 0) {
        showToast("첫 페이지입니다.");
        return;
    }
    vState.currentSpreadIndex = nextIdx;
    renderCurrentSpread();
}

/**
 * 스크롤 모드에서의 페이지 이동 (키보드/버튼)
 * 화면의 90%만큼 스크롤하고, 끝에 도달하면 다음 화로 이동합니다.
 */
function navigateScrollMode(dir) {
    if (window.isViewerLoading) return;

    // 1. Identify Scroll Container
    let container = null;
    if (vState.epubMode) {
        container = document.querySelector('.epub-content.scroll-view');
        // Fallback or Image mode
        if (!container) container = document.getElementById('viewerScrollContainer'); 
    } else {
        container = document.getElementById('viewerScrollContainer');
    }
    
    if (!container) {
        console.warn("[ScrollNav] No Container Found!");
        return;
    }

    // 2. Calculate Scroll
    const clientHeight = container.clientHeight > 0 ? container.clientHeight : window.innerHeight;
    const scrollAmount = clientHeight * 0.9;
    const currentScroll = container.scrollTop;
    const maxScroll = container.scrollHeight - clientHeight;

    const childCount = container.childElementCount;
    const firstImg = container.querySelector('img');
    const firstImgH = firstImg ? firstImg.offsetHeight : 'N/A';

    console.log(`[ScrollNav] Dir: ${dir}, Scroll: ${currentScroll} / ${maxScroll} (H: ${clientHeight}) | Children: ${childCount}, 1stImgH: ${firstImgH}`);
    
    if (dir === 1) { // Next (Down)
        if (Math.abs(currentScroll - maxScroll) < 10 || currentScroll >= maxScroll) {
             console.log("[ScrollNav] Reached Bottom");
             
             // Double-Tap Logic
             if (!window.scrollBottomTriggered) {
                 window.scrollBottomTriggered = true;
                 showToast("마지막입니다. 한번 더 내리면 다음 화로 이동합니다.");
                 return;
             }
             
             console.log("[ScrollNav] Triggering Next Episode");
             checkNextEpisodeTrigger();
             return;
        }
        // Reset trigger if scrolling normally
        window.scrollBottomTriggered = false;
        container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else { // Prev (Up)
        window.scrollBottomTriggered = false; // Reset on up scroll
        if (currentScroll <= 10) {
            console.log("[ScrollNav] Reached Top");
            showToast("첫 부분입니다.");
            return;
        }
        container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    }
}

/**
 * 텍스트 뷰어(페이지 모드) 페이지 이동
 */
function navigateTextPage(dir) {
    // Locate the unique text content container
    const content = document.querySelector('.epub-content.paged-view');
    if (!content) return;

    // Use content as the scroll container
    const container = content;
    
    // Dimensions
    const pageWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    let currentScroll = container.scrollLeft;

    // Direction Logic
    const isRtl = vState.rtlMode;
    
    console.log(`[Nav] Dir: ${dir}, Scroll: ${currentScroll}/${scrollWidth}, Client: ${pageWidth}`);

    // Boundary Detection
    // 1. Next Page
    if (dir === 1) { 
        if (Math.abs(currentScroll + pageWidth - scrollWidth) < 10 || currentScroll + pageWidth >= scrollWidth) {
             console.log("[Nav] End of Chapter Reached");
             if (!window.isLoadingNext) checkNextEpisodeTrigger();
             return;
        }
        container.scrollBy({ left: pageWidth, behavior: 'smooth' });
    } 
    // 2. Prev Page
    else {
        if (currentScroll <= 10) { 
            console.log("[Nav] Start of Chapter");
            showToast("첫 페이지입니다.");
            return;
        }
        container.scrollBy({ left: -pageWidth, behavior: 'smooth' });
    }
    
    // Update Progress
    setTimeout(() => {
        const page = Math.round(container.scrollLeft / pageWidth) + 1;
        const total = Math.ceil(container.scrollWidth / pageWidth);
        const safeTotal = total > 0 ? total : 1;
        const safePage = page > safeTotal ? safeTotal : (page < 1 ? 1 : page);
        
        const counter = document.getElementById('pageCounter');
        if(counter) counter.innerText = `${safePage} / ${safeTotal}`;
    }, 400); 
}

function checkNextEpisodeTrigger() {
    if (!window.isLoadingNext) {
        const nextIndex = currentBookIndex + 1;
        if (currentBookList[nextIndex]) {
            window.isLoadingNext = true;
            showToast("⏩ 다음 화를 불러옵니다...", 2000);
            setTimeout(() => {
                loadViewer(nextIndex, true)
                    .then(() => { window.isLoadingNext = false; })
                    .catch(() => window.isLoadingNext = false);
            }, 500); 
        } else {
            if(!window.isEndToastShown) {
                showToast("🏁 마지막 회차입니다.");
                window.isEndToastShown = true;
                setTimeout(()=> window.isEndToastShown = false, 3000);
            }
        }
    }
}

/**
 * 뷰어를 닫고 리소스를 정리합니다.
 * 중요: `URL.revokeObjectURL`을 호출하여 메모리 누수를 방지합니다.
 */
function closeViewer() {
    const viewer = document.getElementById('viewerOverlay');
    const container = document.getElementById('viewerImageContainer');
    
    // Cleanup Blobs
    if (vState.images) {
        vState.images.forEach(img => URL.revokeObjectURL(img.src));
    }
    vState.images = [];
    vState.spreads = [];
    
    container.innerHTML = '';
    viewer.style.display = 'none';
    document.body.classList.remove('no-scroll');
}

// Key Controls
document.addEventListener('keydown', (e) => {
    if (document.getElementById('viewerOverlay').style.display === 'flex') {
        if (e.key === 'Escape') {
            closeViewer();
            e.preventDefault();
        }
        else if (e.key === 'ArrowLeft') {
            navigateViewer(vState.rtlMode ? 1 : -1);
            e.preventDefault();
        }
        else if (e.key === 'ArrowRight') {
            navigateViewer(vState.rtlMode ? -1 : 1);
            e.preventDefault();
        }
        else if (e.key === 'ArrowUp') {
            navigateViewer(-1); // Prev
            e.preventDefault();
        }
        else if (e.key === 'ArrowDown') {
            navigateViewer(1); // Next
            e.preventDefault();
        }
        else if (e.key === ' ' || e.key === 'Enter') {
            navigateViewer(1);
            e.preventDefault();
        }
    } else if (document.getElementById('episodeModal').style.display === 'flex') {
         if (e.key === 'Escape') closeEpisodeModal();
    }
});

// ============================================================
// 4. Helpers
// ============================================================
/**
 * 모든 이미지의 실제 크기(naturalWidth/Height)를 비동기적으로 로드합니다.
 * 스마트 2쪽 보기(가로형 이미지 단독 표시 등)를 위해 필수적입니다.
 */
function loadAllImageDimensions(images) {
    const promises = images.map(imgData => {
        return new Promise(resolve => {
             const img = new Image();
             img.onload = () => { imgData.width = img.naturalWidth; imgData.height = img.naturalHeight; imgData.loaded = true; resolve(); };
             img.onerror = resolve;
             img.src = imgData.src;
        });
    });
    return Promise.all(promises);
}


function togglePreloadMode() {
    // Toggle Logic
    vState.preload = !vState.preload;
    localStorage.setItem('toki_v_preload', vState.preload);
    updateButtonStates();
    showToast(vState.preload ? "미리 불러오기: ON" : "미리 불러오기: OFF");
}

/**
 * 다음 화 미리 불러오기(Preload).
 * 현재 화를 4페이지 남겨두었을 때 트리거됩니다.
 */
function preloadNextEpisode() {
    if (!vState.preload) return; // Feature disabled
    
    const nextIndex = currentBookIndex + 1;
    if (nextIndex >= currentBookList.length) return;
    if (nextBookPreload && nextBookPreload.index === nextIndex) return;
    if (window.isPreloading) return;

    window.isPreloading = true;
    fetchAndUnzip(currentBookList[nextIndex].id, currentBookList[nextIndex].size || 0, null)
        .then(blobUrls => {
            nextBookPreload = { index: nextIndex, images: blobUrls };
            showToast("📦 다음 화 준비 완료!", 3000);
            window.isPreloading = false;
        })
        .catch(() => window.isPreloading = false);
}

function updateNavHandlers() {
    const prev = document.querySelector('.nav-prev');
    const next = document.querySelector('.nav-next');
    if(prev) prev.onclick = () => navigateViewer(vState.rtlMode ? 1 : -1);
    if(next) next.onclick = () => navigateViewer(vState.rtlMode ? -1 : 1);
}

/* Scroll Mode Logic */
function renderScrollMode() {
    const container = document.getElementById('viewerScrollContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Intersection Observer for Current Page
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                const index = parseInt(entry.target.getAttribute('data-index'));
                updateScrollProgress(index);
            }
        });
    }, { threshold: 0.5 }); // 50% visible

    vState.images.forEach((imgData, index) => {
        const img = document.createElement('img');
        img.src = imgData.src;
        // img.loading = 'lazy'; // Removed to ensure dimension calculation for scroll
        img.className = 'viewer-page';
        img.setAttribute('data-index', index);
        
        // Double Tap to Zoom (Optional, simplified)
        
        container.appendChild(img);
        observer.observe(img);
    });

    // Initial update
    updateSliderUI();
    
    // Add Infinite Scroll Trigger with Double-Tap Protection
    container.onscroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        if (scrollTop + clientHeight >= scrollHeight - 50) {
             // Double-Tap Logic
             if (!window.scrollBottomTriggered) {
                 window.scrollBottomTriggered = true;
                 window.scrollBottomTimestamp = Date.now();
                 showToast("마지막입니다. 계속 내리면 다음 화로 이동합니다.");
                 return;
             }
             
             // Time Latch (1s)
             if (Date.now() - window.scrollBottomTimestamp < 1000) {
                 return;
             }

             if (!window.isLoadingNext) checkNextEpisodeTrigger();
        } else {
            // Reset if user scrolls up
            if (scrollHeight - (scrollTop + clientHeight) > 100) {
                window.scrollBottomTriggered = false;
                window.scrollBottomTimestamp = 0;
            }
        }
    };
}

function updateScrollProgress(index) {
    if (vState.currentSpreadIndex === index) return;
    vState.currentSpreadIndex = index;
    
    // Update Counter
    const counter = document.getElementById('pageCounter');
    const total = vState.images.length;
    if(counter) counter.innerText = `${index + 1} / ${total}`;
    
    // Save Progress
    if(currentBookList[currentBookIndex]) {
        saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, index);
    }
    
    // Slider
    const slider = document.getElementById('pageSlider');
    if(slider) slider.value = index + 1;
    const currentLabel = document.getElementById('sliderCurrent');
    if(currentLabel) currentLabel.innerText = index + 1;

    // Check Finish (Last Page)
    if (index === total - 1) {
        saveReadHistory(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
    }
    
    // Preload Trigger (Last 3 images)
    if (total - index <= 3) {
        preloadNextEpisode();
    }
}

function scrollToPage(index) {
    const container = document.getElementById('viewerScrollContainer');
    if(!container) return;
    
    const target = container.children[index];
    if(target) {
        target.scrollIntoView({ block: 'start' });
    }
}

function toggleScrollMode() {
    vState.scrollMode = !vState.scrollMode;
    localStorage.setItem('toki_v_scroll', vState.scrollMode);
    
    // Refresh Viewer
    loadViewer(currentBookIndex);
}

/* Settings Logic (Reused from Client.js but simplified) */
/**
 * 로컬 스토리지에서 뷰어 설정을 로드하고 UI에 반영합니다.
 */
function loadViewerSettings() {
    vState.mode = localStorage.getItem('toki_v_mode') || '1page';
    vState.coverPriority = (localStorage.getItem('toki_v_cover') === 'true');

    vState.rtlMode = (localStorage.getItem('toki_v_rtl') === 'true');
    vState.preload = (localStorage.getItem('toki_v_preload') !== 'false'); // Default true
    vState.scrollMode = (localStorage.getItem('toki_v_scroll') === 'true'); // Load Scroll Mode
    
    // Load Text Settings
    const savedFs = localStorage.getItem('toki_v_fontsize');
    if(savedFs) vState.textSettings.fontSize = parseInt(savedFs);
    
    updateButtonStates();
}

function updateButtonStates() {
    // Visibility Toggle
    const isEpub = vState.epubMode;
    document.querySelectorAll('.image-only').forEach(el => el.style.display = isEpub ? 'none' : '');
    document.querySelectorAll('.epub-only').forEach(el => el.style.display = isEpub ? 'inline-block' : 'none');

    const setBtn = (id, active) => {
        const btn = document.getElementById(id);
        if(btn) active ? btn.classList.add('active') : btn.classList.remove('active');
    };
    
    setBtn('btnTwoPage', vState.mode === '2page');
    setBtn('btnCover', vState.coverPriority);
    setBtn('btnRtl', vState.rtlMode);
    setBtn('btnPreload', vState.preload);
    setBtn('btnScroll', vState.scrollMode); // Add Button State
}


function toggleViewMode() {
    vState.mode = (vState.mode === '1page') ? '2page' : '1page';
    localStorage.setItem('toki_v_mode', vState.mode);
    updateButtonStates();
    
    if (vState.epubMode) {
        applyTextSettings(); // Apply to text
    } else {
        recalcSpreads(false); // Apply to images
    }
}

function toggleCoverMode() {
    vState.coverPriority = !vState.coverPriority;
    localStorage.setItem('toki_v_cover', vState.coverPriority);
    updateButtonStates();
    recalcSpreads(false);
}

function toggleRtlMode() {
    vState.rtlMode = !vState.rtlMode;
    localStorage.setItem('toki_v_rtl', vState.rtlMode);
    updateButtonStates();
    recalcSpreads(false); // Re-render to apply direction style
}

/**
 * 읽은 기록 반환 (Key: `read_{seriesId}`)
 * @returns {Object} 읽은 기록 객체 { bookId: true, ... }
 */
function getReadHistory(seriesId) {
    const json = localStorage.getItem(`read_${seriesId}`);
    return json ? JSON.parse(json) : {};
}
/**
 * 에피소드 읽음 처리 및 저장
 */
function saveReadHistory(seriesId, bookId) {
    let history = getReadHistory(seriesId);
    history[bookId] = true;
    localStorage.setItem(`read_${seriesId}`, JSON.stringify(history));
}
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B','KB','MB','GB'][i];
}

/* Progress Logic */
/**
 * 저장된 진행도(페이지 인덱스)를 반환합니다.
 */
function getProgress(seriesId, bookId) {
    const json = localStorage.getItem(`prog_${seriesId}`);
    const data = json ? JSON.parse(json) : {}; // Restore missing line
    return data[bookId] || 0;
}

// ============================================================
// 1. Episode List (Viewer-Independent) & UI Helpers
// ============================================================

/**
 * Handle Viewer Click (Separated Layer Logic)
 * 
 * - If click target is inside controls -> Ignore (stop prop handled by CSS pointer-events or handlers)
 * - If click target is nav-zone -> Ignore (nav handles itself)
 * - Otherwise -> Toggle Controls
 */
function handleViewerClick(e) {
    // If we clicked a button/input inside content (unlikely but possible), ignore
    if (e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'input') return;
    
    // If Nav Zone, ignore
    if (e.target.closest('.nav-zone')) return;

    toggleControls();
}

/**
 * 토스트 메시지를 화면에 표시합니다.
 * @param {string} msg - 표시할 메시지
 * @param {number} [duration=2000] - 지속 시간 (ms)
 */
function showToast(msg, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.className = 'toast show';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        toast.className = 'toast';
    }, duration);
}

/**
 * 뷰어 UI (헤더/푸터) 토글
 */
function toggleControls() {
    const controls = document.getElementById('viewerControls');
    if (!controls) return;
    controls.classList.toggle('show');
}
/**
 * 현재 읽고 있는 페이지 인덱스(또는 앵커 객체)를 저장합니다.
 * @param {string} seriesId
 * @param {string} bookId
 * @param {number|Object} pageIndexOrAnchor - 페이지 번호(이미지) 또는 앵커 객체(텍스트)
 */
function saveProgress(seriesId, bookId, pageIndexOrAnchor) {
    const json = localStorage.getItem(`prog_${seriesId}`);
    const data = json ? JSON.parse(json) : {};
    data[bookId] = pageIndexOrAnchor;
    localStorage.setItem(`prog_${seriesId}`, JSON.stringify(data));
}

/**
 * 텍스트 뷰어용: 화면 상단에 보이는 첫 번째 문단(Anchor)을 찾습니다.
 * @param {HTMLElement} container - 스크롤 컨테이너
 * @returns {Object|null} { pIndex: number, offset: number }
 */
function findVisibleAnchor(container) {
    if (!container) return null;
    
    // Find all potential anchors (paragraphs, divs, headings)
    const candidates = container.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
    const scrollTop = container.scrollTop;
    
    // Binary search or linear scan? Linear is fine for typical chapter size (~100-200 paragraphs)
    for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        // If element top is below scrollTop (or close enough), it's the first visible one
        // offsetTop is relative to offsetParent. paged-view might be tricky, but scroll-view is simple.
        if (el.offsetTop + el.clientHeight > scrollTop) {
            return { index: i, id: el.id, tagName: el.tagName };
        }
    }
    return null;
}

/* New UI Handlers */

function updateSliderUI() {
    const slider = document.getElementById('pageSlider');
    const currentLabel = document.getElementById('sliderCurrent');
    const totalLabel = document.getElementById('sliderTotal');
    const title = document.getElementById('viewerTitle');

    if (!vState.spreads || vState.spreads.length === 0) return;

    // Current page number (1-based)
    // Use the first image index of the current spread
    const currentImgIndex = vState.spreads[vState.currentSpreadIndex][0] + 1;
    const totalImages = vState.images.length;

    if (slider) {
        slider.min = 1;
        slider.max = totalImages;
        slider.value = currentImgIndex;
    }
    if (currentLabel) currentLabel.innerText = currentImgIndex;
    if (totalLabel) totalLabel.innerText = totalImages;
    
    // Update Title with Series/Episode Info if available
    if(title && currentBookList[currentBookIndex]) {
        title.innerText = currentBookList[currentBookIndex].name;
    }
}

function onSliderInput(val) {
    const el = document.getElementById('sliderCurrent');
    if(el) el.innerText = val;
}

function onSliderChange(val) {
    const targetPage = parseInt(val) - 1; // 0-based index
    // Find spread containing targetPage
    const spreadIdx = vState.spreads.findIndex(spread => spread.includes(targetPage));
    if (spreadIdx >= 0) {
        vState.currentSpreadIndex = spreadIdx;
        renderCurrentSpread();
    } else {
        // Fallback: approximate
        vState.currentSpreadIndex = Math.min(targetPage, vState.spreads.length - 1);
        renderCurrentSpread();
    }
}

function openEpisodeListFromViewer() {
    const book = currentBookList[currentBookIndex];
    if(book) {
        // Re-open with same context
        openEpisodeList(book.seriesId, document.querySelector('.modal-title').innerText.replace('📄 ','').split('(')[0].trim());
    }
}

// Expose globals for HTML onclicks
window.openEpisodeList = openEpisodeList;
window.loadViewer = loadViewer;
window.toggleViewMode = toggleViewMode;
window.toggleScrollMode = toggleScrollMode; // Expose
window.toggleCoverMode = toggleCoverMode;
window.toggleRtlMode = toggleRtlMode;
window.togglePreloadMode = togglePreloadMode;
window.changeFontSize = changeFontSize;
window.closeViewer = closeViewer;
window.closeEpisodeModal = closeEpisodeModal;
window.toggleControls = toggleControls;
window.navigateViewer = navigateViewer;
window.onSliderInput = onSliderInput;
window.onSliderChange = onSliderChange;
window.openEpisodeListFromViewer = openEpisodeListFromViewer;
