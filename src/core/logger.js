import { getConfig } from './config.js';

export function log(msg, type = 'info') {
    const config = getConfig();
    if (config.debug || type === 'error') {
        console.log(`[TokiSync][${type.toUpperCase()}] ${msg}`);
    }
}

export function updateStatus(msg) {
    const el = document.getElementById('tokiStatusText');
    if (el) {
        const config = getConfig();
        const debugBadge = config.debug ? '<span style="color:yellow; font-weight:bold;">[DEBUG]</span> ' : '';
        el.innerHTML = debugBadge + msg;
    }
    // Strip HTML tags for console log
    log(msg.replace(/<[^>]*>/g, ''));
}

export function setListItemStatus(li, message, bgColor = '#fff9c4', textColor = '#d32f2f') {
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
