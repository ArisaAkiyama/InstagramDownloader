# InstaDown Browser Extension

A Chrome/Edge/Brave extension to download Instagram photos and videos with one click.

## ✨ Features

- 📷 Download single images
- 🎠 Download carousel posts (all images)
- 🎬 Download Reels videos
- ⚡ One-click download button on Instagram posts
- 🎨 Beautiful ocean blue theme

## 📦 Installation

### Chrome / Edge / Brave

1. Open `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project
5. The InstaDown icon will appear in your toolbar!

### Firefox

Firefox requires a slightly different manifest format. Contact developer for Firefox version.

## 🚀 How to Use

### Method 1: Popup
1. Go to any Instagram post or reel
2. Click the InstaDown icon in browser toolbar
3. Click **Download** on individual items or **Download All**

### Method 2: On-Page Button
1. Go to any Instagram post or reel
2. Look for the ⬇️ button injected on the post
3. Click to download all media from that post

## 📁 Extension Structure

```
extension/
├── manifest.json          # Extension configuration
├── popup/
│   ├── popup.html        # Popup UI
│   ├── popup.css         # Popup styling
│   └── popup.js          # Popup logic
├── content/
│   ├── content.js        # Runs on Instagram pages
│   └── content.css       # On-page button styling
├── background/
│   └── background.js     # Handles downloads
└── icons/
    └── (icon files)      # Extension icons
```

## ⚙️ Permissions

- **activeTab**: Access current tab to extract media
- **downloads**: Use Chrome's download API
- **host_permissions**: Only for instagram.com

## 🔒 Privacy

- No data is collected or sent anywhere
- All processing happens locally in your browser
- No account login required

## 👨‍💻 Developer

**ArisaAkiyama**

## 📄 License

MIT License
