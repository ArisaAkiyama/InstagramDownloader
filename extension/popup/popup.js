/**
 * InstaDown - Popup Script
 * Downloads organized by username folder
 */

const API_URL = 'http://localhost:3000/api/download';
const SAVE_URL = 'http://localhost:3000/api/save';
const BATCH_URL = 'http://localhost:3000/api/batch-save';
const PROXY_URL = 'http://localhost:3000/api/proxy';

let urlInput, pasteBtn, downloadBtn, settingsBtn;
let loadingState, errorState, resultsSection;
let errorMessage, retryBtn, mediaCount, mediaList, downloadAllBtn;
let toast, toastMessage;
let progressStatus, progressPercent, progressFill, progressDetail;
let currentMedia = [];
let currentUsername = '';
let appSettings = null; // Will be loaded from storage

// Default settings (fallback)
const DEFAULT_SETTINGS = {
    autoDownload: true,
    autoSave: false,
    serverUrl: 'http://localhost:3000',
    showBadge: true,
    showToast: true,
    downloadPath: ''  // Custom download path (empty = default)
};

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
    settingsBtn = document.getElementById('settingsBtn');

    // Progress bar elements
    progressStatus = document.getElementById('progressStatus');
    progressPercent = document.getElementById('progressPercent');
    progressFill = document.getElementById('progressFill');
    progressDetail = document.getElementById('progressDetail');

    // Load settings first
    await loadAppSettings();

    pasteBtn?.addEventListener('click', handlePaste);
    downloadBtn?.addEventListener('click', handleDownload);
    retryBtn?.addEventListener('click', hideError);
    downloadAllBtn?.addEventListener('click', handleDownloadAll);
    settingsBtn?.addEventListener('click', openSettings);

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
    let pollCount = 0;
    const maxPolls = 60; // 60 seconds max

    const interval = setInterval(async () => {
        try {
            pollCount++;
            const state = await chrome.runtime.sendMessage({ action: 'getState' });

            // Animate progress while waiting (25% to 90%)
            const animatedPercent = Math.min(25 + (pollCount * 1.5), 90);

            if (state.isProcessing) {
                updateProgress(animatedPercent, 'Scraping...', 'Mengekstrak media dari Instagram...');
            }

            if (!state.isProcessing) {
                clearInterval(interval);

                if (state.media && state.media.length > 0) {
                    // Animate smoothly to 100%
                    await animateProgress(100, 500, 'Selesai!', `${state.media.length} media ditemukan`);

                    // Brief pause at 100%
                    await new Promise(resolve => setTimeout(resolve, 300));

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

            // Timeout after max polls
            if (pollCount >= maxPolls) {
                clearInterval(interval);
                showError('Timeout - coba lagi nanti');
                downloadBtn.disabled = false;
            }
        } catch (e) {
            clearInterval(interval);
            downloadBtn.disabled = false;
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
    resetProgress();
    downloadBtn.disabled = true;

    // Update progress: Starting
    updateProgress(5, 'Memulai...', isStory ? 'Mempersiapkan capture story...' : 'Menghubungkan ke server...');

    try {
        let data;

        if (isStory) {
            // Use content script for stories - capture from browser directly
            console.log('Using content script for story capture...');
            updateProgress(20, 'Capturing Story...', 'Mengambil media dari halaman...');

            data = await captureStoryFromTab(url);
            updateProgress(80, 'Memproses...', 'Menganalisis media...');

            // Stories are processed directly, show results after animation
            if (data.success && data.media?.length > 0) {
                // Animate smoothly to 100%
                await animateProgress(100, 500, 'Selesai!', `${data.media.length} media ditemukan`);

                // Brief pause at 100%
                await new Promise(resolve => setTimeout(resolve, 300));

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
            updateProgress(15, 'Mengirim ke Server...', 'Memulai proses scraping...');

            // Clear previous state
            await chrome.runtime.sendMessage({ action: 'clearState' });

            // Start download in background
            updateProgress(25, 'Scraping...', 'Mengambil data dari Instagram...');
            await chrome.runtime.sendMessage({ action: 'startDownload', url });

            // Poll for results with progress
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
    if (currentMedia.length === 0) {
        showToast('Tidak ada media untuk didownload');
        return;
    }

    showToast(`⚡ Memulai download paralel ${currentMedia.length} file...`);
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = '⏳ Downloading...';

    try {
        // Prepare items for batch download
        const items = currentMedia.map((media, index) => {
            const ext = media.type === 'video' ? 'mp4' : 'jpg';
            const timestamp = Date.now();
            return {
                url: media.url,
                filename: `${currentUsername}_${timestamp}_${index + 1}.${ext}`,
                type: media.type
            };
        });

        // Send to batch API (parallel download on server)
        const response = await fetch(BATCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items,
                username: currentUsername,
                downloadPath: appSettings?.downloadPath || ''
            })
        });

        const result = await response.json();

        if (result.success && result.jobId) {
            // Poll for completion
            pollBatchStatus(result.jobId, items.length);
        } else {
            throw new Error(result.error || 'Batch download failed');
        }

    } catch (error) {
        console.error('Batch download error:', error);
        showToast('❌ Gagal memulai batch download');
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = '⬇ Download All';
    }
}

/**
 * Poll batch job status until complete
 */
async function pollBatchStatus(jobId, total) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/batch-status/${jobId}`);
            const status = await response.json();

            if (status.status === 'complete') {
                clearInterval(pollInterval);
                downloadAllBtn.disabled = false;
                downloadAllBtn.textContent = '⬇ Download All';
                showToast(`✅ ${status.completed}/${total} file tersimpan ke @${currentUsername}`);
            } else if (status.status === 'processing') {
                downloadAllBtn.textContent = `⏳ ${status.completed}/${total}`;
            } else {
                clearInterval(pollInterval);
                downloadAllBtn.disabled = false;
                downloadAllBtn.textContent = '⬇ Download All';
            }
        } catch (e) {
            clearInterval(pollInterval);
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = '⬇ Download All';
        }
    }, 500);
}

function showToast(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Track current progress for animation
let currentProgress = 0;

/**
 * Update progress bar (instant)
 * @param {number} percent - 0 to 100
 * @param {string} status - Status text (e.g., "Downloading...")
 * @param {string} detail - Detail text (e.g., "File 2 of 5")
 */
function updateProgress(percent, status, detail) {
    currentProgress = percent;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
    if (progressStatus) progressStatus.textContent = status;
    if (progressDetail) progressDetail.textContent = detail;
}

/**
 * Animate progress bar smoothly to target
 * @param {number} targetPercent - Target percentage (0-100)
 * @param {number} duration - Animation duration in ms
 * @param {string} status - Status text
 * @param {string} detail - Detail text
 * @returns {Promise} Resolves when animation complete
 */
function animateProgress(targetPercent, duration, status, detail) {
    return new Promise(resolve => {
        const startPercent = currentProgress;
        const diff = targetPercent - startPercent;
        const startTime = Date.now();

        if (progressStatus) progressStatus.textContent = status;
        if (progressDetail) progressDetail.textContent = detail;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentPercent = startPercent + (diff * eased);

            currentProgress = currentPercent;
            if (progressFill) progressFill.style.width = `${currentPercent}%`;
            if (progressPercent) progressPercent.textContent = `${Math.round(currentPercent)}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/**
 * Reset progress bar to initial state
 */
function resetProgress() {
    currentProgress = 0;
    updateProgress(0, 'Memproses...', 'Menghubungkan ke server...');
}

/**
 * Load app settings from storage
 */
async function loadAppSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        appSettings = { ...DEFAULT_SETTINGS, ...result.settings };
        console.log('Settings loaded:', appSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        appSettings = DEFAULT_SETTINGS;
    }
}

/**
 * Open settings page
 */
function openSettings() {
    window.location.href = 'settings.html';
}
