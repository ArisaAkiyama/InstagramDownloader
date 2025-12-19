# 📸 InstaDown - Instagram Downloader

A powerful Instagram media downloader with browser extension support. Download posts, carousels, reels, stories, and highlights with ease. Now with **private account support**!

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![Puppeteer](https://img.shields.io/badge/Puppeteer-21.x-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Version](https://img.shields.io/badge/Version-2.3.0-purple)

## ✨ Features

### Media Support
- ✅ **Single Image/Video** - Download individual posts
- ✅ **Carousel Support** - Extract all images from multi-slide posts (up to 20)
- ✅ **Reels Download** - Download Instagram Reels as video
- ✅ **Stories Download** - Capture stories directly from browser
- ✅ **Highlights Download** - Download from user highlights
- ✅ **High Resolution** - Get the highest quality available

### Extension Features
- ✅ **Browser Extension** - One-click download from Edge/Chrome
- ✅ **Auto-Download** - Copy link → open extension → automatic download!
- ✅ **Private Account Support** - Import cookies to access private posts
- ✅ **Settings Page** - Configure download path, server URL, preferences
- ✅ **Progress Bar** - Visual progress with percentage and status
- ✅ **Background Processing** - Downloads continue even if popup closes
- ✅ **Badge Notification** - Red badge shows when download completes

### Performance
- ✅ **Browser Keep-Alive** - 3x faster with reused browser instance
- ✅ **Parallel Downloads** - 5x faster batch downloads
- ✅ **Auto-Retry** - 3x retry with exponential backoff
- ✅ **Rate Limiting** - Prevents Instagram ban
- ✅ **Memory Management** - Auto-restart on high memory usage

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm
- Chrome or Edge browser (for extension)

### Installation

```bash
# Clone the repository
git clone https://github.com/ArisaAkiyama/InstagramDownloader.git
cd InstagramDownloader

# Install dependencies
npm install

# Start the server
npm start
```

### Access

- **Web UI**: http://localhost:3000
- **Extension**: Load from `extension/` folder

## 📦 Browser Extension Setup

1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the extension to toolbar

## 🔐 Private Account Support

To download from private accounts you follow:

1. **Login to Instagram** in your browser (instagram.com)
2. Open extension → Click **⚙️ Settings**
3. Click **"🍪 Import Cookies dari Browser"**
4. Status akan berubah: ✅ Logged in as @username
5. Sekarang bisa download private posts!

> ⚠️ Cookies akan expire setelah beberapa waktu. Jika tidak bisa download, import ulang cookies.

## 🎯 How to Use

### Posts & Reels
1. Copy Instagram post/reel URL
2. Click extension icon
3. **Auto-download starts!** (or click Download button)
4. Click "Download All" to save to folder

### Stories & Highlights
1. **Open the story/highlight** in your browser
2. Copy the URL
3. Click extension icon
4. Download captures directly from browser

## ⚙️ Settings

Open Settings with ⚙️ button to configure:

| Setting | Description |
|---------|-------------|
| 🔄 Auto-download | Auto-download saat copy link |
| 💾 Auto-save | Langsung simpan tanpa preview |
| 📂 Download Path | Custom folder (contoh: D:\Instagram) |
| 🖥️ Server URL | URL server InstaDown |
| 🔴 Show Badge | Badge merah saat selesai |
| 💬 Show Toast | Notifikasi pop-up |

## 📁 Project Structure

```
InstagramDownloader/
├── public/                  # Web frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── extension/               # Browser extension
│   ├── manifest.json
│   ├── background.js        # Service worker
│   ├── popup/               # Extension popup UI
│   │   ├── popup.html/css/js
│   │   └── settings.html/css/js
│   ├── content/             # Content scripts
│   └── icons/
├── scraper.js               # Puppeteer scraper
├── server.js                # Express API server
├── browser-manager.js       # Browser lifecycle management
├── download-queue.js        # Parallel download queue
├── rate-limiter.js          # Request throttling
├── error-recovery.js        # Error diagnostics
├── cookies.json             # Instagram session cookies
├── start.bat                # Quick start (Windows)
├── setup-autostart.bat      # Enable auto-start on boot
├── stop-server.bat          # Stop running server
└── package.json
```

## 🔌 API Reference

### Download Media
```http
POST /api/download
Content-Type: application/json

{"url": "https://www.instagram.com/p/SHORTCODE/"}
```

### Save to Folder
```http
POST /api/save
Content-Type: application/json

{"url": "...", "filename": "file.jpg", "username": "user", "downloadPath": "D:\\Instagram"}
```

### Batch Download
```http
POST /api/batch-save
Content-Type: application/json

{"items": [...], "username": "user", "downloadPath": "D:\\Instagram"}
```

### Set Cookies
```http
POST /api/set-cookies
Content-Type: application/json

{"cookies": [...]}
```

### Cookie Status
```http
GET /api/cookie-status
```

### Health Check
```http
GET /api/health
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Scraping**: Puppeteer with Stealth Plugin
- **Frontend**: HTML5, CSS3, JavaScript
- **Extension**: Chrome Manifest V3 with Service Worker

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## ⚠️ Disclaimer

This tool is for personal use only. Please:
- Respect content creators' copyright
- Don't use for commercial purposes
- Comply with Instagram's Terms of Service

## 📄 License

MIT License - feel free to use and modify.

## 👨‍💻 Author

**ArisaAkiyama**

---

Made with ❤️ using Puppeteer & Express.js
