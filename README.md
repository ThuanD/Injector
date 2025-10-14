# Web Customizer - Chrome Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/extensions)
[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)](#)

**Web Customizer** is a powerful Chrome extension that allows you to automatically run custom JavaScript snippets on specific websites. You can easily manage and execute scripts by domain to customize your web experience according to your preferences.

## ✨ Key Features

- 🚀 **Auto-inject Scripts**: Automatically run scripts when accessing specified websites
- 📁 **Domain-based Management**: Store and manage scripts separately for each domain
- 🎯 **Intuitive UI**: Simple popup for quick script execution, advanced options page for detailed management
- 🔄 **Synchronization**: Scripts are synchronized via Chrome Sync across devices
- 🛠️ **Easy to Use**: User-friendly interface, no advanced programming knowledge required

## 📋 System Requirements

- Google Chrome or Chromium-based browser (version 88+)
- Supports Manifest V3

## 🛠️ Installation

### 1. Prepare the Extension

Ensure your project directory contains all the following files:

```
web-customizer/
├── manifest.json          # Extension configuration
├── background.js          # Background script
├── content.js             # Main content script
├── popup.html             # Popup interface
├── popup.js               # Popup logic
├── options.html           # Scripts management page
├── options.js             # Management logic
└── icons/                 # Icons directory
    ├── icon16.png         # 16x16px icon
    ├── icon48.png         # 48x48px icon
    └── icon128.png        # 128x128px icon
```

### 2. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right corner)
3. Click **Load unpacked**
4. Select the `web-customizer` directory
5. The extension will appear in the list and is ready to use

### 3. Grant Permissions (if needed)

The extension will request access to:
- Storage to save scripts
- Active tab to run scripts on the current page
- Scripting to execute JavaScript code

## 📖 Usage Guide

### Adding a New Script

1. **Open the page you want to customize** (e.g., `https://example.com`)
2. **Click the extension icon** in the Chrome toolbar
3. **Select "Manage All Scripts"** to open the management page
4. **Click "+ Add New Script"**
5. **Fill in the information**:
   - **Script Name**: Easy-to-recognize name
   - **URL Pattern**: Pattern to match pages (e.g., `*.example.com` or `https://example.com/*`)
   - **Description**: Description of script functionality
   - **JavaScript Code**: The code snippet to run

### Script Examples

#### 1. Auto-skip Ads (Skip Ads)
```javascript
// Pattern: *.youtube.com
setTimeout(() => {
    const skipButton = document.querySelector('.ytp-ad-skip-button');
    if (skipButton) skipButton.click();
}, 1000);
```

#### 2. Change Page Background Color
```javascript
// Pattern: github.com
document.body.style.backgroundColor = '#f0f0f0';
```

#### 3. Auto-login
```javascript
// Pattern: *.facebook.com
document.getElementById('email').value = 'your@email.com';
document.getElementById('pass').value = 'yourpassword';
```

### Quick Script Execution

1. **Open a page with configured scripts**
2. **Click the extension icon**
3. **Click "Run Now"** next to the script you want to execute
4. The script will execute immediately on the current page

### Script Management

- **Edit**: Click "Edit" to modify script information
- **Delete**: Click "Delete" to remove unnecessary scripts
- **View Source**: Click "View Code" to see script content

## 🏗️ Project Structure

```
web-customizer/
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service worker handling storage and messages
├── content.js             # Inject scripts into web pages
├── popup.html             # Popup interface
├── popup.js               # Popup handling logic
├── options.html           # Scripts management page
├── options.js             # Detailed management logic
└── icons/
    ├── icon16.png         # Small icon for toolbar
    ├── icon48.png         # Medium icon
    └── icon128.png        # Large icon for Chrome Web Store
```

## 🔧 Development and Customization

### Adding New Features

1. **Modify Content Script** (`content.js`): Add script execution logic
2. **Update Background** (`background.js`): Add new storage handling
3. **Upgrade UI**: Edit `popup.html` and `options.html`

### Debugging

- Open **Developer Tools** in the extensions page
- Check **Console** for errors and messages
- Use `console.log()` in scripts for debugging

## ⚠️ Important Notes

- **Security**: Only run scripts from trusted sources
- **Permissions**: Extension requires access to all websites - please review carefully before installation
- **Performance**: Heavy scripts may slow down web pages
- **Updates**: When updating the extension, reload it in `chrome://extensions/`

## 🆘 Troubleshooting

**Scripts not running?**
- Check if the URL Pattern matches the current page
- Ensure JavaScript code has no syntax errors
- Reload the page and try again

**Extension not working?**
- Verify Developer Mode is enabled
- Ensure file paths are correct
- Restart Chrome if necessary

**Storage not syncing?**
- Sign in with the same Google account on all devices
- Check if storage capacity is sufficient

## 📄 License

This project is developed for educational purposes and personal use. Please respect Chrome Web Store terms when publishing.

## 🤝 Contributing

If you want to contribute or report bugs, please create an issue in the repository or contact directly.

---
