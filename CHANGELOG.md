# Changelog

All notable changes to InstaDown will be documented in this file.

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
