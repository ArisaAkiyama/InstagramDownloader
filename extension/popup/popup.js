/**
 * InstaDown - Popup Script
 * Downloads organized by username folder
 */

const API_URL = 'http://localhost:3000/api/download';
const SAVE_URL = 'http://localhost:3000/api/save';
const PROXY_URL = 'http://localhost:3000/api/proxy';

let urlInput, pasteBtn, downloadBtn;
let loadingState, errorState, resultsSection;
let errorMessage, retryBtn, mediaCount, mediaList, downloadAllBtn;
let toast, toastMessage;
let currentMedia = [];
let currentUsername = '';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    urlInput = document.getElementById('urlInput');
    pasteBtn = document.getElementById('pasteBtn');
    downloadBtn = document.getElementById('downloadBtn');
    loadingState = document.getElementById('loadingState');
    errorState = document.getElementById('errorState');
    errorMessage = document.getElementById('errorMessage');
    retryBtn = document.getElementById('retryBtn');
    resultsSection = document.getElementById('resultsSection');
    mediaCount = document.getElementById('mediaCount');
    mediaList = document.getElementById('mediaList');
    downloadAllBtn = document.getElementById('downloadAllBtn');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toastMessage');

    pasteBtn?.addEventListener('click', handlePaste);
    downloadBtn?.addEventListener('click', handleDownload);
    retryBtn?.addEventListener('click', hideError);
    downloadAllBtn?.addEventListener('click', handleDownloadAll);

    urlInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    await loadState();
}

async function loadState() {
    try {
        const result = await chrome.storage.local.get(['lastUrl', 'lastMedia', 'lastUsername']);

        if (result.lastUrl) {
            urlInput.value = result.lastUrl;
        } else {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab.url?.match(/instagram\.com\/(p|reel|tv)\//)) {
                    urlInput.value = tab.url.split('?')[0];
                }
            } catch (e) { }
        }

        if (result.lastMedia && result.lastMedia.length > 0) {
            currentMedia = result.lastMedia;
            currentUsername = result.lastUsername || '';
            showResults(result.lastMedia, currentUsername);
        }
    } catch (e) { }
}

async function saveState() {
    try {
        await chrome.storage.local.set({
            lastUrl: urlInput.value,
            lastMedia: currentMedia,
            lastUsername: currentUsername
        });
    } catch (e) { }
}

async function handlePaste() {
    try {
        const text = await navigator.clipboard.readText();
        urlInput.value = text.split('?')[0];
        saveState();
    } catch (e) {
        showToast('Tidak bisa paste');
    }
}

async function handleDownload() {
    const url = urlInput.value.trim();

    if (!url) {
        showToast('Masukkan URL dulu!');
        return;
    }

    if (!/instagram\.com\/(p|reel|tv)\/[\w-]+/i.test(url)) {
        showToast('URL tidak valid!');
        return;
    }

    showLoading();
    downloadBtn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success && data.media?.length > 0) {
            currentMedia = data.media;
            currentUsername = data.username || 'unknown';
            showResults(data.media, currentUsername);
            saveState();
        } else {
            throw new Error(data.error || 'Media tidak ditemukan');
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showError('Server tidak berjalan! Jalankan: npm start');
        } else {
            showError(error.message);
        }
    } finally {
        downloadBtn.disabled = false;
    }
}

function showLoading() {
    loadingState.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    errorState.classList.add('hidden');
}

function hideLoading() {
    loadingState.classList.add('hidden');
}

function showError(message) {
    hideLoading();
    resultsSection.classList.add('hidden');
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
}

function hideError() {
    errorState.classList.add('hidden');
}

function showResults(media, username) {
    hideLoading();
    hideError();
    resultsSection.classList.remove('hidden');

    // Show username in header
    mediaCount.textContent = `@${username} • ${media.length} media`;
    mediaList.innerHTML = '';

    media.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'media-item';
        const isVideo = item.type === 'video';

        // Videos: show icon, Images: show thumbnail
        let thumbHtml;
        if (isVideo) {
            // Always show video icon
            thumbHtml = `
                <div class="media-thumb-container video-icon">
                    <span class="video-emoji">🎬</span>
                    <span class="video-badge">▶</span>
                </div>`;
        } else {
            // Show actual image thumbnail
            const thumbUrl = `${PROXY_URL}?url=${encodeURIComponent(item.url)}`;
            thumbHtml = `
                <div class="media-thumb-container">
                    <img class="media-thumb" src="${thumbUrl}" alt="" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="media-thumb-fallback" style="display:none;">📷</div>
                </div>`;
        }

        div.innerHTML = `
            ${thumbHtml}
            <div class="media-info">
                <div class="media-type">${isVideo ? 'Video' : 'Image'}</div>
                <div class="media-index">#${index + 1}</div>
            </div>
            <button class="item-download-btn" title="Download">⬇️</button>
        `;

        div.querySelector('.item-download-btn').onclick = () => saveMedia(item, index);
        mediaList.appendChild(div);
    });
}

/**
 * Save media to server folder (IG Downloader/username/)
 */
async function saveMedia(item, index) {
    const ext = item.type === 'video' ? 'mp4' : 'jpg';
    const filename = `${currentUsername}_${Date.now()}_${index + 1}.${ext}`;

    try {
        showToast(`Menyimpan ke @${currentUsername}...`);

        const response = await fetch(SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: item.url,
                filename: filename,
                type: item.type,
                username: currentUsername
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`✅ Tersimpan: ${result.username}/${filename}`);
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        console.error('Save error:', e);
        showToast('❌ Gagal menyimpan, gunakan browser download');
        downloadViaBrowser(item, index);
    }
}

async function downloadViaBrowser(item, index) {
    const ext = item.type === 'video' ? 'mp4' : 'jpg';
    const filename = `${currentUsername}_${Date.now()}_${index + 1}.${ext}`;

    try {
        const response = await fetch(`${PROXY_URL}?url=${encodeURIComponent(item.url)}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
        window.open(item.url, '_blank');
    }
}

async function handleDownloadAll() {
    showToast(`Menyimpan ${currentMedia.length} file ke @${currentUsername}...`);

    let saved = 0;
    for (let i = 0; i < currentMedia.length; i++) {
        try {
            await saveMedia(currentMedia[i], i);
            saved++;
        } catch (e) { }
        await new Promise(r => setTimeout(r, 300));
    }

    showToast(`✅ ${saved} file tersimpan ke @${currentUsername}`);
}

function showToast(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}
