export function getSeriesInfo(workId, detectedCategory) {
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
