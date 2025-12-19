/**
 * InstaDown Settings Page
 */

// Default settings
const DEFAULT_SETTINGS = {
    autoDownload: true,
    autoSave: false,
    serverUrl: 'http://localhost:3000',
    showBadge: true,
    showToast: true,
    downloadPath: ''
};

// DOM elements
let autoDownloadToggle, autoSaveToggle, serverUrlInput;
let showBadgeToggle, showToastToggle, downloadPathInput;
let saveBtn, clearCacheBtn, resetBtn, backBtn;
let importCookiesBtn, loginStatus, statusIcon, statusText;
let toast, toastMessage;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Get elements
    autoDownloadToggle = document.getElementById('autoDownload');
    autoSaveToggle = document.getElementById('autoSave');
    serverUrlInput = document.getElementById('serverUrl');
    showBadgeToggle = document.getElementById('showBadge');
    showToastToggle = document.getElementById('showToast');
    downloadPathInput = document.getElementById('downloadPath');
    saveBtn = document.getElementById('saveBtn');
    clearCacheBtn = document.getElementById('clearCacheBtn');
    resetBtn = document.getElementById('resetBtn');
    backBtn = document.getElementById('backBtn');
    importCookiesBtn = document.getElementById('importCookiesBtn');
    loginStatus = document.getElementById('loginStatus');
    statusIcon = document.getElementById('statusIcon');
    statusText = document.getElementById('statusText');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toastMessage');

    // Add event listeners
    saveBtn?.addEventListener('click', saveSettings);
    clearCacheBtn?.addEventListener('click', clearCache);
    resetBtn?.addEventListener('click', resetSettings);
    backBtn?.addEventListener('click', goBack);
    importCookiesBtn?.addEventListener('click', importCookies);

    // Load current settings
    await loadSettings();

    // Check login status
    await checkLoginStatus();
}

/**
 * Check Instagram login status
 */
async function checkLoginStatus() {
    try {
        updateLoginStatus('checking', '⏳', 'Checking...');

        // Get Instagram cookies from browser
        const cookies = await getInstagramCookies();
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const usernameCookie = cookies.find(c => c.name === 'ds_user');

        if (sessionCookie && sessionCookie.value) {
            const username = usernameCookie ? usernameCookie.value : 'user';
            updateLoginStatus('logged-in', '✅', `Logged in as @${username}`);
        } else {
            updateLoginStatus('logged-out', '❌', 'Not logged in');
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        updateLoginStatus('logged-out', '⚠️', 'Cannot check status');
    }
}

/**
 * Update login status UI
 */
function updateLoginStatus(state, icon, text) {
    if (loginStatus) {
        loginStatus.className = 'login-status ' + state;
    }
    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
}

/**
 * Get Instagram cookies from browser
 */
async function getInstagramCookies() {
    return new Promise((resolve, reject) => {
        // Check if cookies API is available
        if (!chrome.cookies || !chrome.cookies.getAll) {
            console.error('chrome.cookies API not available');
            reject(new Error('Cookies API not available. Please reload extension.'));
            return;
        }

        chrome.cookies.getAll({ domain: '.instagram.com' }, (cookies) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(cookies || []);
        });
    });
}

/**
 * Import cookies from browser and send to server
 */
async function importCookies() {
    try {
        importCookiesBtn.disabled = true;
        importCookiesBtn.textContent = '⏳ Importing...';

        // Get Instagram cookies
        const cookies = await getInstagramCookies();

        if (!cookies || cookies.length === 0) {
            showToastMsg('❌ No Instagram cookies found. Please login to Instagram first.');
            return;
        }

        // Check for sessionid
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        if (!sessionCookie || !sessionCookie.value) {
            showToastMsg('❌ Session not found. Please login to Instagram.');
            return;
        }

        // Format cookies for Puppeteer
        const formattedCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            secure: c.secure || false,
            httpOnly: c.httpOnly || false,
            sameSite: c.sameSite || 'Lax'
        }));

        // Get server URL from settings
        const serverUrl = serverUrlInput?.value || 'http://localhost:3000';

        // Send to server
        const response = await fetch(`${serverUrl}/api/set-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies: formattedCookies })
        });

        const result = await response.json();

        if (result.success) {
            showToastMsg('✅ Cookies imported successfully!');
            await checkLoginStatus();
        } else {
            showToastMsg('❌ ' + (result.error || 'Failed to import cookies'));
        }

    } catch (error) {
        console.error('Import cookies error:', error);
        showToastMsg('❌ Error: ' + error.message);
    } finally {
        importCookiesBtn.disabled = false;
        importCookiesBtn.textContent = '🍪 Import Cookies dari Browser';
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        const settings = { ...DEFAULT_SETTINGS, ...result.settings };

        // Apply to UI
        if (autoDownloadToggle) autoDownloadToggle.checked = settings.autoDownload;
        if (autoSaveToggle) autoSaveToggle.checked = settings.autoSave;
        if (serverUrlInput) serverUrlInput.value = settings.serverUrl;
        if (showBadgeToggle) showBadgeToggle.checked = settings.showBadge;
        if (showToastToggle) showToastToggle.checked = settings.showToast;
        if (downloadPathInput) downloadPathInput.value = settings.downloadPath || '';

        console.log('Settings loaded:', settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        const settings = {
            autoDownload: autoDownloadToggle?.checked ?? true,
            autoSave: autoSaveToggle?.checked ?? false,
            serverUrl: serverUrlInput?.value || 'http://localhost:3000',
            showBadge: showBadgeToggle?.checked ?? true,
            showToast: showToastToggle?.checked ?? true,
            downloadPath: downloadPathInput?.value?.trim() || ''
        };

        await chrome.storage.sync.set({ settings });

        showToastMsg('✅ Pengaturan tersimpan!');
        console.log('Settings saved:', settings);

        // Redirect to popup after short delay
        setTimeout(() => {
            window.location.href = 'popup.html';
        }, 800);

    } catch (error) {
        console.error('Error saving settings:', error);
        showToastMsg('❌ Gagal menyimpan pengaturan');
    }
}

/**
 * Clear cache (stored state)
 */
async function clearCache() {
    try {
        await chrome.storage.local.clear();
        await chrome.action.setBadgeText({ text: '' });
        showToastMsg('🗑️ Cache dihapus!');
    } catch (error) {
        console.error('Error clearing cache:', error);
        showToastMsg('❌ Gagal menghapus cache');
    }
}

/**
 * Reset settings to default
 */
async function resetSettings() {
    if (!confirm('Reset semua pengaturan ke default?')) return;

    try {
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
        await loadSettings();
        showToastMsg('↩️ Pengaturan direset!');
    } catch (error) {
        console.error('Error resetting settings:', error);
        showToastMsg('❌ Gagal reset pengaturan');
    }
}

/**
 * Go back to popup
 */
function goBack() {
    window.location.href = 'popup.html';
}

/**
 * Show toast message
 */
function showToastMsg(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}

/**
 * Get settings (exported for use in popup.js)
 */
async function getSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        return { ...DEFAULT_SETTINGS, ...result.settings };
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSettings, DEFAULT_SETTINGS };
}
