# Changelog

All notable changes to InstaDown will be documented in this file.

## [2.3.0] - 2025-12-19

### Added
- **Browser Pool / Keep-Alive** - Reuses browser instance for ~3x faster subsequent requests
- **Parallel Download Queue** - Download All now uses parallel processing (5 concurrent)
- **Auto-Retry Mechanism** - Retries failed scrapes up to 3x with exponential backoff
- **Rate Limiting** - Prevents Instagram ban with controlled request frequency
- **Error Recovery** - Graceful handling when Instagram structure changes
- **Progress Bar** - Detailed visual progress with percentage and status messages
- **Settings Page** - UI for configuring download path, server URL, and preferences
- **Custom Download Path** - Choose where to save files (D:\, C:\, etc.)
- **Private Account Support** - Import cookies from browser for logged-in access
- **Login Status Display** - Shows login status in settings page
- **Memory Monitoring** - Tracks memory usage and force-restarts browser if >500MB
- `browser-manager.js` - Centralized browser lifecycle management
- `download-queue.js` - Parallel download with job tracking
- `rate-limiter.js` - Request throttling to avoid ban
- `error-recovery.js` - Diagnostics and structure change detection
- `settings.html/css/js` - Settings page with toggle switches and cookie import
- Browser, memory, rate limit & error stats in `/api/health` endpoint
- New endpoints: `/api/batch-save`, `/api/batch-status/:jobId`, `/api/queue-stats`
- New endpoints: `/api/set-cookies`, `/api/cookie-status` for cookie management

### Performance
- First request: ~3-5 seconds (browser launch)
- Subsequent requests: ~1-2 seconds (reuses browser)
- Download All: ~5x faster with parallel downloads
- Auto-restart browser after 50 requests (memory management)
- Auto-close browser after 5 minutes idle

### Reliability
- 3x retry with exponential backoff (1s, 2s, 4s delay)
- Non-retryable errors (invalid URL, not found) skip retry
- Memory check every 30 seconds
- Rate limit: min 2s delay, max 15 req/min
- Random jitter to avoid detection patterns
- Auto-cooldown on Instagram rate limit detection
- Page structure validation with diagnostic logging
- Login wall detection with helpful error messages
- Diagnostic files saved to `diagnostics/` folder for debugging

---

## [2.2.0] - 2025-12-19

### Added
- **Auto-Download from Clipboard** - Copy Instagram link, open extension, auto-download!
- **Background Service Worker** - Downloads continue even if popup closes
- **Badge Notification** - Red badge on extension icon shows when download completes
- **Highlights Support** - Download from Instagram user highlights
- **Stories Download** - Capture stories/highlights directly from browser via content script

### Changed
- Improved username extraction with 6 methods for better accuracy
- Improved highlights username detection (extracts from page, not URL)
- Removed server-side story endpoint (replaced with content script)
- Cleaner codebase - removed unused yt-dlp integration

### Fixed
- Fixed username showing "unknown" for some posts
- Fixed username showing "highlights" instead of actual username for highlights
- Fixed auto-download not working when old results exist

---

## [2.1.0] - 2025-12-18

### Added
- Stories and Highlights download support
- Content script for capturing stories from browser
- Cookies permission for authenticated access
- Service worker background script

### Changed
- Extension version bump to 2.1.0
- Added story URL pattern to URL validation

---

## [2.0.0] - 2025-12-17

### Added
- Browser extension with popup UI
- "Download All" button to save all media at once
- Organized folder structure by username
- Video thumbnail display in results
- Auto-paste from clipboard when popup opens

### Changed
- Complete UI redesign with modern glassmorphism style
- Files now saved to `Downloads/Instagram/username/`
- Improved carousel navigation (up to 20 slides)

---

## [1.0.0] - 2025-12-16

### Initial Release
- Single image/video download
- Carousel support
- Reels download
- Web UI at localhost:3000
- Puppeteer with Stealth plugin
- Express.js API server
