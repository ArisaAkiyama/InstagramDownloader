/**
 * InstaDown - Background Service Worker
 * Handles downloads in background so popup closing doesn't interrupt
 */

const API_URL = 'http://localhost:3000/api/download';
const SAVE_URL = 'http://localhost:3000/api/save';

// Store current download state
let downloadState = {
    isProcessing: false,
    url: null,
    media: null,
    username: null,
    error: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message:', request.action);

    if (request.action === 'startDownload') {
        handleDownload(request.url);
        sendResponse({ started: true });
        return true;
    }

    if (request.action === 'getState') {
        sendResponse(downloadState);
        return true;
    }

    if (request.action === 'clearState') {
        downloadState = {
            isProcessing: false,
            url: null,
            media: null,
            username: null,
            error: null
        };
        // Clear badge when starting new download
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ cleared: true });
        return true;
    }

    if (request.action === 'saveMedia') {
        handleSaveMedia(request.items, request.username);
        sendResponse({ started: true });
        return true;
    }
});

/**
 * Handle download request - runs in background
 */
async function handleDownload(url) {
    console.log('[Background] Starting download for:', url);

    downloadState = {
        isProcessing: true,
        url: url,
        media: null,
        username: null,
        error: null
    };

    // Persist state
    await chrome.storage.local.set({ downloadState });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success && data.media?.length > 0) {
            downloadState = {
                isProcessing: false,
                url: url,
                media: data.media,
                username: data.username || 'unknown',
                error: null
            };
            console.log('[Background] Download complete:', data.media.length, 'items');

            // Show red badge with count
            chrome.action.setBadgeText({ text: String(data.media.length) });
            chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });
        } else {
            downloadState = {
                isProcessing: false,
                url: url,
                media: null,
                username: null,
                error: data.error || 'Failed to extract media'
            };
            console.log('[Background] Download failed:', downloadState.error);
        }

    } catch (error) {
        console.error('[Background] Download error:', error);
        downloadState = {
            isProcessing: false,
            url: url,
            media: null,
            username: null,
            error: 'Server tidak terkoneksi. Pastikan server berjalan.'
        };
    }

    // Persist final state
    await chrome.storage.local.set({ downloadState });
}

/**
 * Handle saving multiple media files
 */
async function handleSaveMedia(items, username) {
    console.log('[Background] Saving', items.length, 'items for', username);

    let savedCount = 0;
    let errors = [];

    for (const item of items) {
        try {
            const response = await fetch(SAVE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: item.url,
                    filename: item.filename,
                    type: item.type,
                    username: username
                })
            });

            const result = await response.json();
            if (result.success) {
                savedCount++;
            } else {
                errors.push(item.filename);
            }
        } catch (error) {
            errors.push(item.filename);
        }
    }

    console.log('[Background] Saved', savedCount, 'of', items.length);

    // Update state with save results
    await chrome.storage.local.set({
        lastSaveResult: {
            total: items.length,
            saved: savedCount,
            errors: errors.length
        }
    });
}

// Restore state on startup
chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.local.get('downloadState');
    if (data.downloadState) {
        downloadState = data.downloadState;
        console.log('[Background] Restored state:', downloadState);
    }
});

console.log('[Background] Service worker started');
