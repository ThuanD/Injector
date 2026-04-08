# ⚡ Injector

> Automatically run JavaScript on any website — free, open-source, no Chrome Web Store required.

![Version](https://img.shields.io/badge/version-2.0.2-3dd6f5?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-7c6cf8?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-2dd4a0?style=flat-square)
![Price](https://img.shields.io/badge/price-free-f5a623?style=flat-square)

---

## Introduction

**Injector** is a Chrome extension that allows you to automatically run any JavaScript code whenever you open a specific website. Use it to hide ads, auto-fill forms, monitor prices, receive Telegram notifications — and much more.

🌐 **Visit our landing page:** [injector.thuandv.top](https://injector.thuandv.top)

No programming knowledge required. The extension includes 20+ ready-to-use templates and integrated prompts to help you get custom scripts written by ChatGPT.

## Features

- **Auto-inject Scripts** — Scripts automatically run when pages load, supporting URL patterns with wildcard `*`
- **20+ Templates** — Ready to use without coding: remove ads, dark mode, price monitoring, clean YouTube/Facebook/Twitter...
- **AI-assisted** — Built-in prompt templates to get ChatGPT/Gemini to write scripts according to your requirements
- **Hide Elements** — Hide elements by CSS selector directly from popup, no coding required
- **Telegram Notifications** — Receive phone notifications when prices change or content updates
- **SPA Support** — Automatically detects URL changes in React/Vue/Next.js and re-runs scripts at the right time
- **Export/Import** — Backup all scripts to JSON, easily transfer to another machine
- **CSP Bypass** — Uses nonce stealing technique to run scripts on pages with strict Content Security Policy

## Installation

Since the extension is not available on Chrome Web Store (Google charges $5 developer fee), install it manually in 4 steps:

### Step 1 — Download

Download the ZIP file from the [Releases](https://github.com/ThuanD/Injector/releases) page, or use the direct link:

```bash
curl -L https://github.com/ThuanD/Injector/releases/latest/download/Injector-Extension.zip -o Injector.zip
```

### Step 2 — Extract

Extract the ZIP file. You will have the `Injector-main/` directory.

### Step 3 — Enable Developer Mode

Open Chrome, go to `chrome://extensions`, turn on the **Developer mode** toggle in the top right corner.

### Step 4 — Load extension

Click **Load unpacked** → navigate to the `Injector-main` directory → select the subdirectory **`Injector-Extension`**.

The ⚡ icon will appear on your toolbar — installation complete.

## Usage Guide

### Using ready-made templates

1. Click the ⚡ icon on the toolbar → **Manage All Scripts**
2. Go to the **📋 Templates** tab, select the appropriate template
3. Fill in **URL Pattern** — which pages you want the script to run on (e.g., `*.youtube.com`)
4. Click **＋ Add Script** → reload the page and you're done

### Writing scripts with AI

1. Go to the **📖 Guide** tab in the Options page
2. Copy one of the **sample prompts** according to the type of task you want to do
3. Paste into ChatGPT, describe your requirements → get the code
4. Create a new script, paste the code, fill in URL Pattern → save

### URL Pattern

| Pattern | Meaning |
|---|---|
| `*` | Run on all pages |
| `*.youtube.com` | All YouTube pages |
| `*.tiki.vn/product/*` | Only Tiki product pages |
| `https://docs.google.com/*` | All Google Docs |

## Security Warning

JavaScript scripts can **read all content on the page**, including passwords, cookies, and banking information.

- **Do not** paste code from strangers sent via social media, Zalo, Telegram
- **Do not** run scripts on banking, e-wallet, or important login pages
- **Should** read the code carefully or have ChatGPT explain it before running

## Contributing

Pull requests and issues are always welcome. Some ways to contribute:

- Add new templates to `templates.js`
- Fix bugs, improve features
- Improve UI/UX

## Support

If the extension is useful to you, please support the author with a Chupa Chups ☕

[![Buy me a Chupa Chups](https://img.shields.io/badge/Buy%20me%20a%20Chupa%20Chups-🍭-f5a623?style=flat-square)](https://www.buymeacoffee.com/thuandv)

