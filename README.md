# 📸 InstaDown - Instagram Downloader

A powerful Instagram media downloader with browser extension support. Download posts, carousels, reels, stories, and highlights with ease.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![Puppeteer](https://img.shields.io/badge/Puppeteer-21.x-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Version](https://img.shields.io/badge/Version-2.2.0-purple)

## ✨ Features

- ✅ **Single Image/Video** - Download individual posts
- ✅ **Carousel Support** - Extract all images from multi-slide posts (up to 20)
- ✅ **Reels Download** - Download Instagram Reels as video
- ✅ **Stories Download** - Capture stories directly from browser
- ✅ **Highlights Download** - Download from user highlights
- ✅ **High Resolution** - Get the highest quality available
- ✅ **Browser Extension** - One-click download from Edge/Chrome
- ✅ **Auto-Download** - Copy link → open extension → automatic download!
- ✅ **Background Processing** - Downloads continue even if popup closes
- ✅ **Badge Notification** - Red badge shows when download completes
- ✅ **Organized Downloads** - Files saved to `Downloads/Instagram/username/`
- ✅ **Auto-Start Server** - Optional Windows auto-start on boot

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
│   ├── content/             # Content scripts
│   └── icons/
├── scraper.js               # Puppeteer scraper
├── server.js                # Express API server
├── start.bat                # Quick start (Windows)
├── setup-autostart.bat      # Enable auto-start on boot
├── stop-server.bat          # Stop running server
└── package.json
```

## ⚙️ Configuration

### Download Location

By default, files are saved to `~/Downloads/Instagram/username/`.

To customize, set environment variable:
```bash
DOWNLOAD_PATH=C:\Your\Custom\Path npm start
```

### Cookies (Optional)

For better reliability with some content:

1. Copy `cookies.example.json` to `cookies.json`
2. Export cookies from Instagram using EditThisCookie extension
3. Paste into `cookies.json`

⚠️ Use a secondary account, not your main account.

## 🔌 API Reference

### Download Media
```http
POST /api/download
Content-Type: application/json

{"url": "https://www.instagram.com/p/SHORTCODE/"}
```

**Response:**
```json
{
  "success": true,
  "media": [{"type": "image", "url": "..."}],
  "username": "user123",
  "count": 3
}
```

### Save to Folder
```http
POST /api/save
Content-Type: application/json

{"url": "...", "filename": "file.jpg", "username": "user"}
```

### Proxy (CORS Bypass)
```http
GET /api/proxy?url=MEDIA_URL
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
