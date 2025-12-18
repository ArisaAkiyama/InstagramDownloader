/**
 * Instagram Downloader - Frontend Application
 * Handles form submission, API communication, and gallery rendering
 */

// DOM Elements
const downloadForm = document.getElementById('downloadForm');
const urlInput = document.getElementById('urlInput');
const pasteBtn = document.getElementById('pasteBtn');
const downloadBtn = document.getElementById('downloadBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const resultsSection = document.getElementById('resultsSection');
const mediaGallery = document.getElementById('mediaGallery');
const mediaCount = document.getElementById('mediaCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// API Endpoint
const API_URL = '/api/download';

// Current results storage
let currentResults = [];

/**
 * Initialize event listeners
 */
function init() {
    downloadForm.addEventListener('submit', handleSubmit);
    pasteBtn.addEventListener('click', handlePaste);
    retryBtn.addEventListener('click', handleRetry);
    downloadAllBtn.addEventListener('click', handleDownloadAll);

    // Auto paste on focus if clipboard has Instagram URL
    urlInput.addEventListener('focus', () => {
        if (!urlInput.value) {
            tryAutoPaste();
        }
    });
}

/**
 * Try to auto-paste Instagram URL from clipboard
 */
async function tryAutoPaste() {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (isInstagramUrl(text)) {
                urlInput.value = text;
                showToast('Link Instagram terdeteksi dari clipboard!', 'success');
            }
        }
    } catch (error) {
        // Clipboard access denied - ignore silently
    }
}

/**
 * Handle paste button click
 */
async function handlePaste() {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            urlInput.focus();
            showToast('Link berhasil dipaste!', 'success');
        }
    } catch (error) {
        showToast('Tidak dapat mengakses clipboard', 'error');
    }
}

/**
 * Validate Instagram URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isInstagramUrl(url) {
    // Support: /p/, /reel/, /tv/
    const regex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+\/?/i;
    return regex.test(url);
}

/**
 * Handle form submission
 * @param {Event} e - Submit event
 */
async function handleSubmit(e) {
    e.preventDefault();

    const url = urlInput.value.trim();

    // Validate URL
    if (!url) {
        showToast('Masukkan link Instagram terlebih dahulu', 'error');
        return;
    }

    if (!isInstagramUrl(url)) {
        showToast('Link tidak valid. Masukkan link postingan Instagram yang benar.', 'error');
        return;
    }

    // Show loading state
    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success) {
            currentResults = data.media;
            renderResults(data.media);
            hideLoading();
            showToast(`Berhasil menemukan ${data.count} media!`, 'success');
        } else {
            hideLoading();
            showError(data.error || 'Terjadi kesalahan');
        }

    } catch (error) {
        console.error('Fetch error:', error);
        hideLoading();
        showError('Gagal terhubung ke server. Pastikan server berjalan.');
    }
}

/**
 * Show loading state
 */
function showLoading() {
    downloadForm.classList.add('hidden');
    errorState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    downloadBtn.disabled = true;
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingState.classList.add('hidden');
    downloadForm.classList.remove('hidden');
    downloadBtn.disabled = false;
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showError(message) {
    errorMessage.textContent = message;
    loadingState.classList.add('hidden');
    downloadForm.classList.add('hidden');
    errorState.classList.remove('hidden');
}

/**
 * Handle retry button click
 */
function handleRetry() {
    errorState.classList.add('hidden');
    downloadForm.classList.remove('hidden');
    downloadBtn.disabled = false;
    urlInput.focus();
}

/**
 * Render media results
 * @param {Array} media - Array of media objects
 */
function renderResults(media) {
    // Clear previous results
    mediaGallery.innerHTML = '';

    // Update count
    mediaCount.textContent = `${media.length} media`;

    // Create media items
    media.forEach((item, index) => {
        const mediaItem = createMediaItem(item, index);
        mediaGallery.appendChild(mediaItem);
    });

    // Show results section
    resultsSection.classList.remove('hidden');

    // Show download all button if multiple items
    if (media.length > 1) {
        downloadAllBtn.classList.remove('hidden');
    } else {
        downloadAllBtn.classList.add('hidden');
    }

    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

/**
 * Create a media item element
 * @param {Object} item - Media item {type, url}
 * @param {number} index - Item index
 * @returns {HTMLElement}
 */
function createMediaItem(item, index) {
    const div = document.createElement('div');
    div.className = 'media-item';

    const isVideo = item.type === 'video';

    div.innerHTML = `
        <div class="media-preview">
            ${isVideo
            ? `<video src="${item.url}" preload="metadata" muted></video>`
            : `<img src="${item.url}" alt="Instagram media ${index + 1}" loading="lazy">`
        }
            <span class="media-type-badge ${isVideo ? 'video' : ''}">${isVideo ? '🎬 Video' : '📷 Image'}</span>
        </div>
        <div class="media-actions">
            <button class="media-download-btn" data-url="${item.url}" data-type="${item.type}" data-index="${index}">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3V16M12 16L7 11M12 16L17 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Download
            </button>
            <button class="media-open-btn" data-url="${item.url}" title="Buka di tab baru">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `;

    // Add event listeners
    const downloadButton = div.querySelector('.media-download-btn');
    const openButton = div.querySelector('.media-open-btn');

    downloadButton.addEventListener('click', () => handleDownload(item, index));
    openButton.addEventListener('click', () => window.open(item.url, '_blank'));

    // Add video hover play
    if (isVideo) {
        const video = div.querySelector('video');
        div.addEventListener('mouseenter', () => video.play().catch(() => { }));
        div.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    }

    return div;
}

/**
 * Handle single media download
 * @param {Object} item - Media item
 * @param {number} index - Item index
 */
async function handleDownload(item, index) {
    try {
        showToast('Memulai download...', 'success');

        // Determine file extension
        const extension = item.type === 'video' ? 'mp4' : 'jpg';
        const filename = `instagram_${Date.now()}_${index + 1}.${extension}`;

        // Try using proxy for better compatibility
        await downloadFile(item.url, filename);

    } catch (error) {
        console.error('Download error:', error);
        showToast('Gagal download. Coba buka di tab baru.', 'error');
    }
}

/**
 * Download file using fetch and blob
 * @param {string} url - File URL
 * @param {string} filename - Desired filename
 */
async function downloadFile(url, filename) {
    try {
        // Use proxy endpoint to bypass CORS
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error('Fetch failed');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        showToast('Download berhasil!', 'success');

    } catch (error) {
        // Fallback: try direct download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/**
 * Handle download all media
 */
async function handleDownloadAll() {
    if (currentResults.length === 0) return;

    showToast(`Memulai download ${currentResults.length} file...`, 'success');

    for (let i = 0; i < currentResults.length; i++) {
        const item = currentResults[i];
        const extension = item.type === 'video' ? 'mp4' : 'jpg';
        const filename = `instagram_${Date.now()}_${i + 1}.${extension}`;

        await downloadFile(item.url, filename);

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    showToast('Semua file berhasil didownload!', 'success');
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success/error)
 */
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;

    // Force reflow for animation
    toast.offsetHeight;

    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
