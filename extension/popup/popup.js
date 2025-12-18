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

    // Check if background is still processing
    const bgState = await checkBackgroundState();

    // Always check clipboard for new URL - even if old results exist
    await checkClipboardAndAutoDownload(bgState);
}

/**
 * Check clipboard for Instagram URL and auto-download
 */
async function checkClipboardAndAutoDownload(hasExistingState) {
    try {
        const clipText = await navigator.clipboard.readText();

        if (clipText && isInstagramUrl(clipText)) {
            // Clean the URL (remove query params for comparison)
            const cleanClipUrl = clipText.split('?')[0];
            const cleanCurrentUrl = urlInput.value.trim().split('?')[0];

            // Check if clipboard URL is different from current/displayed URL
            if (cleanClipUrl !== cleanCurrentUrl) {
                console.log('Auto-download from clipboard:', clipText);

                // Clear old results if any
                if (hasExistingState) {
                    await chrome.runtime.sendMessage({ action: 'clearState' });
                    resultsSection.classList.add('hidden');
                    currentMedia = [];
                }

                urlInput.value = clipText;

                // Small delay then auto-download
                setTimeout(() => handleDownload(), 300);
            }
        }
    } catch (e) {
        // Clipboard access denied or empty - ignore
        console.log('Clipboard access:', e.message);
    }
}

/**
 * Check if text is valid Instagram URL
 */
function isInstagramUrl(text) {
    return /instagram\.com\/(p|reel|tv|stories)\/[\w-]+/i.test(text);
}

/**
 * Check background service worker state
 */
async function checkBackgroundState() {
    try {
        const state = await chrome.runtime.sendMessage({ action: 'getState' });

        if (state.isProcessing) {
            // Still processing - show loading and poll for updates
            showLoading();
            downloadBtn.disabled = true;
            urlInput.value = state.url || '';
            pollBackgroundState();
            return true; // Handled - still processing
        } else if (state.media && state.media.length > 0) {
            // Processing complete - show results
            currentMedia = state.media;
            currentUsername = state.username || 'unknown';
            urlInput.value = state.url || '';
            showResults(state.media, currentUsername);
            return true; // Handled - has results
        } else if (state.error) {
            // Error occurred
            urlInput.value = state.url || '';
            showError(state.error);
            return true; // Handled - has error
        }
    } catch (e) {
        console.log('No background state');
    }
    return false; // Not handled - ready for auto-download
}

/**
 * Poll background state while processing
 */
function pollBackgroundState() {
    const interval = setInterval(async () => {
        try {
            const state = await chrome.runtime.sendMessage({ action: 'getState' });

            if (!state.isProcessing) {
                clearInterval(interval);

                if (state.media && state.media.length > 0) {
                    currentMedia = state.media;
                    currentUsername = state.username || 'unknown';
                    showResults(state.media, currentUsername);
                    saveState();

                    // Show red badge with count
                    chrome.action.setBadgeText({ text: String(state.media.length) });
                    chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });
                } else if (state.error) {
                    showError(state.error);
                }

                downloadBtn.disabled = false;
            }
        } catch (e) {
            clearInterval(interval);
        }
    }, 1000);
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

/**
 * Capture story from active browser tab using content script
 */
async function captureStoryFromTab(storyUrl) {
    try {
        // Get all tabs
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs.length === 0) {
            return { success: false, error: 'No active tab found' };
        }

        let tab = tabs[0];
        const currentUrl = tab.url || '';

        // Check if current tab is the story page
        const isOnStoryPage = currentUrl.includes('instagram.com/stories/');

        if (!isOnStoryPage) {
            // Not on story page - need to open it
            // First check if story URL matches input
            const inputUrl = storyUrl;

            // Open story URL in current tab
            await chrome.tabs.update(tab.id, { url: inputUrl });

            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Re-query the tab
            [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }

        // Inject content script if not already present
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/story-capture.js']
            });
        } catch (e) {
            console.log('Content script may already be injected:', e.message);
        }

        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send message to content script
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'captureStory' });

        return result || { success: false, error: 'No response from content script' };

    } catch (error) {
        console.error('captureStoryFromTab error:', error);
        return {
            success: false,
            error: error.message || 'Failed to capture story',
            hint: 'Pastikan Anda sudah membuka story di browser dan masih login'
        };
    }
}

async function handleDownload() {
    const url = urlInput.value.trim();

    if (!url) {
        showToast('Masukkan URL dulu!');
        return;
    }

    // Detect URL type
    const isStory = /instagram\.com\/stories\/[^\/]+/i.test(url);
    const isPost = /instagram\.com\/(p|reel|tv)\/[\w-]+/i.test(url);

    if (!isStory && !isPost) {
        showToast('URL tidak valid!');
        return;
    }

    showLoading();
    downloadBtn.disabled = true;

    try {
        let data;

        if (isStory) {
            // Use content script for stories - capture from browser directly
            console.log('Using content script for story capture...');
            data = await captureStoryFromTab(url);

            // Stories are processed directly, show results immediately
            if (data.success && data.media?.length > 0) {
                currentMedia = data.media;
                currentUsername = data.username || 'unknown';
                showResults(data.media, currentUsername);
                saveState();

                // Show red badge with count
                chrome.action.setBadgeText({ text: String(data.media.length) });
                chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });
            } else {
                throw new Error(data.error || 'Media tidak ditemukan');
            }
        } else {
            // Use background service worker for posts/reels
            // This allows closing popup without interrupting download
            console.log('Using background service worker for download...');

            // Clear previous state
            await chrome.runtime.sendMessage({ action: 'clearState' });

            // Start download in background
            await chrome.runtime.sendMessage({ action: 'startDownload', url });

            // Poll for results
            pollBackgroundState();
            return; // Don't disable button, polling will handle it
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showError('Server tidak berjalan! Jalankan: npm start');
        } else {
            showError(error.message);
        }
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
