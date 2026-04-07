// ============================================================
// Injector — Script Templates
// ============================================================

const SCRIPT_TEMPLATES = {
  // ══════════════════════════════════════════
  // 🧹 DOM CLEANUP
  // ══════════════════════════════════════════

  removeAds: {
    name: "Remove Ads & Banners",
    description:
      "Remove ads, banners, popups on most websites.",
    category: "🧹 DOM Cleanup",
    code: `(function removeAds() {
  const adSelectors = [
    '[id*="ad-"]', '[id*="-ad"]', '[id*="_ad"]',
    '[id*="ads"]', '[id*="banner"]', '[id*="popup"]',
    '[class*="advert"]', '[class*="ads-"]', '[class*="-ads"]',
    '[class*="ad-container"]', '[class*="ad-wrapper"]',
    '[class*="banner-ads"]', '[class*="sponsored"]',
    '[class*="promo-banner"]', '[class*="sticky-ad"]',
    '[data-ad]', '[data-ad-slot]', '[data-google-query-id]',
    'ins.adsbygoogle',
    '.widget-area aside[class*="ad"]',
  ];

  let removed = 0;
  adSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.remove();
      removed++;
    });
  });

  // Monitor and remove dynamically injected ads
  const observer = new MutationObserver(() => {
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.remove();
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[Injector] Removed ' + removed + ' ad elements');
})();`,
  },

  blockNewWindows: {
    name: "Block New Windows & Tabs",
    description:
      "Block click-hijack ad tabs common on Vietnamese manga sites.",
    category: "🧹 DOM Cleanup",
    code: `(function blockNewWindows() {
  'use strict';

  const log = (...args) => console.log('[Injector]', ...args);

  // ── 1. Hard override window.open ──
  const blockOpen = function(url) {
    log('Blocked window.open:', url);
    if (url && url !== 'about:blank' && !/^javascript:/i.test(url)) {
      location.href = url;
    }
    return null;
  };

  try {
    Object.defineProperty(window, 'open', {
      value: blockOpen,
      writable: false,
      configurable: false,
    });
  } catch (e) {
    window.open = blockOpen;
  }

  // Backup: also block self / top / parent
  ['self', 'top', 'parent'].forEach(obj => {
    try {
      if (window[obj]) {
        window[obj].open = blockOpen;
      }
    } catch {}
  });

  // ── 2. Fix all link targets ──
  const fixLink = (a) => {
    if (!a || a.tagName !== 'A') return;
    if (a.target && a.target !== '_self') {
      a.target = '_self';
    }
  };

  const fixLinks = (root = document) => {
    root.querySelectorAll?.('a[target]').forEach(fixLink);
  };

  fixLinks();

  // ── 3. MutationObserver ──
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'A') fixLink(n);
        else fixLinks(n);
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // ── 4. Block click hijack ──
  const intercept = (e) => {
    const a = e.target?.closest?.('a');

    if (a) {
      if (a.target && a.target !== '_self') {
        log('Force same-tab:', a.href);
        a.target = '_self';
      }
    }
  };

  ['click', 'mousedown', 'pointerdown'].forEach(evt => {
    document.addEventListener(evt, intercept, {
      capture: true,
      passive: false // ⚠️ important
    });
  });

  // ── 5. Override click() ──
  const _click = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function() {
    if (this.tagName === 'A') {
      fixLink(this);
    }
    return _click.apply(this, arguments);
  };

  log('Block active (strong mode)');
})();`,
  },

  removePaywall: {
    name: "Remove Paywall & Overlay",
    description:
      "Remove paywall, subscription overlay, content-blocking popup and restore scroll.",
    category: "🧹 DOM Cleanup",
    code: `(function removePaywall() {
  const overlaySelectors = [
    '[class*="paywall"]', '[class*="pay-wall"]',
    '[class*="subscription"]', '[id*="paywall"]',
    '[class*="overlay"]', '[id*="overlay"]',
    '[class*="modal-backdrop"]', '[class*="blur-overlay"]',
    '[class*="article-locked"]', '[class*="content-gate"]',
    '[class*="cookie-banner"]', '[id*="cookie"]',
    '[class*="newsletter-popup"]', '[class*="signup-wall"]',
  ];

  overlaySelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Restore scroll
  const restore = (el) => {
    el.style.overflow   = '';
    el.style.overflowY  = '';
    el.style.position   = '';
    el.style.maxHeight  = '';
  };
  restore(document.body);
  restore(document.documentElement);

  // Remove common scroll-blocking classes
  ['modal-open', 'overflow-hidden', 'noscroll', 'no-scroll', 'body-locked']
    .forEach(c => document.body.classList.remove(c));

  // Restore blurred/obscured content
  document.querySelectorAll('[class*="blur"], [style*="blur"]').forEach(el => {
    el.style.filter = '';
    el.style.webkitFilter = '';
  });

  console.log('[Injector] Paywall removed, scroll restored');
})();`,
  },

  removeStickyHeaders: {
    name: "Remove Sticky Headers & Floating Bars",
    description:
      "Remove sticky header/footer bars that obscure content when scrolling.",
    category: "🧹 DOM Cleanup",
    code: `(function removeStickyBars() {
  let removed = 0;

  document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    const pos   = style.position;
    const tag   = el.tagName.toLowerCase();

    if ((pos === 'fixed' || pos === 'sticky') && tag !== 'body' && tag !== 'html') {
      const rect = el.getBoundingClientRect();
      // Only remove bars at top or bottom, not sidebars
      const isTopBar    = rect.top <= 10 && rect.width > window.innerWidth * 0.4;
      const isBottomBar = rect.bottom >= window.innerHeight - 10 && rect.width > window.innerWidth * 0.4;

      if (isTopBar || isBottomBar) {
        el.remove();
        removed++;
      }
    }
  });

  // Add padding-top lost from header removal
  document.body.style.paddingTop = '0';
  document.body.style.marginTop  = '0';

  console.log('[Injector] Removed ' + removed + ' sticky bars');
})();`,
  },

  cleanYouTube: {
    name: "Clean YouTube UI",
    description:
      "Hide sidebar Shorts, annoying video suggestions, end-screen, make YouTube cleaner.",
    category: "🧹 DOM Cleanup",
    code: `(function cleanYouTube() {
  const css = \`
    /* Hide Shorts in sidebar */
    ytd-guide-entry-renderer a[href="/shorts"],
    ytd-mini-guide-entry-renderer a[href="/shorts"] { display: none !important; }

    /* Hide Shorts section on homepage */
    ytd-rich-section-renderer { display: none !important; }

    /* Hide end-screen suggestions */
    .ytp-endscreen-content { display: none !important; }

    /* Hide cards (i button) */
    .ytp-cards-teaser, .ytp-ce-element { display: none !important; }

    /* Hide right sidebar ads */
    #masthead-ad, ytd-banner-promo-renderer,
    ytd-statement-banner-renderer { display: none !important; }

    /* Hide Promoted videos in search */
    ytd-search-pyv-renderer { display: none !important; }

    /* Shrink sidebar for wider video view */
    ytd-watch-flexy[theater] #secondary { display: none !important; }
  \`;

  const style = document.createElement('style');
  style.id = 'injector-yt-clean';
  style.textContent = css;
  document.head.appendChild(style);

  // Auto skip ads
  function skipAd() {
    const skip = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button');
    if (skip) { skip.click(); return; }

    const ad = document.querySelector('.ad-showing');
    if (ad) {
      const video = document.querySelector('video');
      if (video) video.currentTime = video.duration;
    }
  }
  setInterval(skipAd, 800);

  console.log('[Injector] YouTube cleaned');
})();`,
  },

  // ══════════════════════════════════════════
  // ⚡ PRODUCTIVITY
  // ══════════════════════════════════════════

  focusMode: {
    name: "Focus / Reading Mode",
    description:
      "Show only main article content, hide everything around. Helps focused reading.",
    category: "⚡ Productivity",
    code: `(function focusMode() {
  // Find main content area
  const contentCandidates = [
    'article', 'main', '[role="main"]',
    '.post-content', '.article-content', '.entry-content',
    '.article-body', '.story-body', '.post-body',
    '#content', '#main-content', '#article-content',
  ];

  let content = null;
  for (const sel of contentCandidates) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 500) {
      content = el;
      break;
    }
  }

  if (!content) {
    // Fallback: choose element with longest text
    let maxLen = 0;
    document.querySelectorAll('div, section').forEach(el => {
      if (el.innerText.length > maxLen) {
        maxLen = el.innerText.length;
        content = el;
      }
    });
  }

  if (!content) {
    console.warn('[Injector] Could not find main content');
    return;
  }

  // Clone and display content in overlay
  const clone = content.cloneNode(true);
  const overlay = document.createElement('div');
  overlay.id = 'injector-focus';
  overlay.style.cssText = \`
    position: fixed; inset: 0; z-index: 999999;
    background: #fafaf8;
    overflow-y: auto;
    padding: 60px 0 80px;
  \`;

  const inner = document.createElement('div');
  inner.style.cssText = \`
    max-width: 720px; margin: 0 auto;
    padding: 0 32px;
    font-family: Georgia, serif;
    font-size: 19px; line-height: 1.85;
    color: #1a1a1a;
  \`;
  inner.appendChild(clone);

  // Exit button
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕ Exit Focus Mode';
  exitBtn.style.cssText = \`
    position: fixed; top: 16px; right: 20px;
    background: #1a1a1a; color: white;
    border: none; border-radius: 8px;
    padding: 8px 16px; font-size: 13px;
    cursor: pointer; z-index: 1000000;
  \`;
  exitBtn.onclick = () => overlay.remove();

  overlay.appendChild(inner);
  overlay.appendChild(exitBtn);
  document.body.appendChild(overlay);

  // Exit with ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.remove();
  }, { once: true });
})();`,
  },

  autoFillForms: {
    name: "Auto Fill Forms",
    description:
      "Automatically fill personal information into forms. Edit config variables below before using.",
    category: "⚡ Productivity",
    code: `(function autoFillForms() {
  // ── Edit your information here ──
  const INFO = {
    firstName : 'Nguyen',
    lastName  : 'Van A',
    fullName  : 'Nguyen Van A',
    email     : 'your@email.com',
    phone     : '0901234567',
    address   : '123 Nguyen Trai, Hanoi',
    city      : 'Hanoi',
    country   : 'Vietnam',
    zipCode   : '100000',
    company   : 'My Company',
    website   : 'https://example.com',
  };

  // Map keyword → value
  const RULES = [
    { keys: ['firstname', 'first-name', 'first_name', 'fname'], value: INFO.firstName },
    { keys: ['lastname', 'last-name', 'last_name', 'lname'],    value: INFO.lastName },
    { keys: ['fullname', 'full-name', 'full_name', 'name'],     value: INFO.fullName },
    { keys: ['email', 'e-mail', 'mail'],                         value: INFO.email },
    { keys: ['phone', 'tel', 'mobile', 'cell'],                  value: INFO.phone },
    { keys: ['address', 'street', 'addr'],                       value: INFO.address },
    { keys: ['city', 'town'],                                    value: INFO.city },
    { keys: ['country', 'nation'],                               value: INFO.country },
    { keys: ['zip', 'postal', 'postcode'],                       value: INFO.zipCode },
    { keys: ['company', 'organization', 'employer'],             value: INFO.company },
    { keys: ['website', 'url', 'homepage'],                      value: INFO.website },
  ];

  let filled = 0;
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])').forEach(input => {
    const id    = (input.id || '').toLowerCase();
    const name  = (input.name || '').toLowerCase();
    const ph    = (input.placeholder || '').toLowerCase();
    const label = (document.querySelector('label[for="' + input.id + '"]')?.textContent || '').toLowerCase();
    const combined = [id, name, ph, label].join(' ');

    for (const rule of RULES) {
      if (rule.keys.some(k => combined.includes(k))) {
        input.value = rule.value;
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        break;
      }
    }
  });

  console.log('[Injector] Filled ' + filled + ' fields');
})();`,
  },

  tableOfContents: {
    name: "Generate Table of Contents",
    description:
      "Automatically generate floating table of contents from article headings (h1–h3), clickable to jump to sections.",
    category: "⚡ Productivity",
    code: `(function generateTOC() {
  const headings = document.querySelectorAll('h1, h2, h3');
  if (headings.length < 3) {
    console.log('[Injector] Not enough headings for TOC');
    return;
  }

  // Assign id to each heading if missing
  headings.forEach((h, i) => {
    if (!h.id) h.id = 'wc-section-' + i;
  });

  // Build HTML
  const items = Array.from(headings).map(h => {
    const level   = parseInt(h.tagName[1]);
    const indent  = (level - 1) * 14;
    const size    = level === 1 ? '13px' : level === 2 ? '12.5px' : '12px';
    const weight  = level === 1 ? '600' : '400';
    return \`<div style="padding:3px 0 3px \${indent}px">
      <a href="#\${h.id}" style="color:#3dd6f5;text-decoration:none;font-size:\${size};font-weight:\${weight};line-height:1.4;display:block;opacity:.85"
         onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.85">
        \${h.innerText.trim()}
      </a>
    </div>\`;
  }).join('');

  const toc = document.createElement('div');
  toc.id    = 'injector-toc';
  toc.innerHTML = \`
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5a6480;margin-bottom:10px">
      📋 Table of Contents
    </div>
    \${items}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)">
      <span id="wc-toc-close" style="font-size:11px;color:#5a6480;cursor:pointer">✕ Close</span>
    </div>
  \`;
  toc.style.cssText = \`
    position: fixed; top: 80px; right: 20px;
    width: 240px; max-height: 70vh; overflow-y: auto;
    background: #141720; border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px; padding: 16px;
    z-index: 99999; box-shadow: 0 8px 32px rgba(0,0,0,.4);
    scrollbar-width: thin;
  \`;

  document.body.appendChild(toc);
  document.getElementById('wc-toc-close').onclick = () => toc.remove();
})();`,
  },

  wordCounter: {
    name: "Word & Read Time Counter",
    description:
      "Display word count, character count and estimated reading time for articles right on the page.",
    category: "⚡ Productivity",
    code: `(function wordCounter() {
  // Get main text content
  const contentEls = ['article', 'main', '.post-content', '.article-content', '.entry-content', '#content'];
  let text = '';
  for (const sel of contentEls) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 200) { text = el.innerText; break; }
  }
  if (!text) text = document.body.innerText;

  const words   = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const chars   = text.replace(/\s/g, '').length;
  const minutes = Math.ceil(words / 200); // average reading speed 200 wpm

  const badge = document.createElement('div');
  badge.style.cssText = \`
    position: fixed; bottom: 20px; right: 20px;
    background: #141720; border: 1px solid rgba(61,214,245,.25);
    border-radius: 10px; padding: 12px 16px;
    z-index: 99999; font-family: system-ui, sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,.4);
  \`;
  badge.innerHTML = \`
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a6480;margin-bottom:8px">Article Stats</div>
    <div style="display:flex;gap:16px">
      <div>
        <div style="font-size:20px;font-weight:700;color:#3dd6f5;line-height:1">\${words.toLocaleString()}</div>
        <div style="font-size:10px;color:#5a6480;margin-top:2px">words</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:#7c6cf8;line-height:1">\${chars.toLocaleString()}</div>
        <div style="font-size:10px;color:#5a6480;margin-top:2px">chars</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:#2dd4a0;line-height:1">\${minutes}</div>
        <div style="font-size:10px;color:#5a6480;margin-top:2px">min read</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:10px;color:#5a6480;cursor:pointer;text-align:right" id="wc-close">✕ Close</div>
  \`;
  document.body.appendChild(badge);
  document.getElementById('wc-close').onclick = () => badge.remove();
})();`,
  },

  // ══════════════════════════════════════════
  // 🎨 STYLING
  // ══════════════════════════════════════════

  darkMode: {
    name: "Force Dark Mode",
    description:
      "Enable dark mode for any website using CSS filter invert. Images and videos keep original colors.",
    category: "🎨 Styling",
    code: `(function forceDarkMode() {
  const id = 'injector-darkmode';
  if (document.getElementById(id)) {
    document.getElementById(id).remove();
    document.documentElement.style.colorScheme = '';
    console.log('[Injector] Dark mode OFF');
    return;
  }

  const css = \`
    html {
      filter: invert(1) hue-rotate(180deg) !important;
      color-scheme: dark !important;
      background-color: #000 !important;
    }
    img, video, canvas, iframe,
    [style*="background-image"],
    svg image {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    /* Preserve logo, brand icon colors */
    [class*="logo"] img,
    [class*="avatar"] img,
    [class*="brand"] img { filter: none !important; }
  \`;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
  document.documentElement.style.colorScheme = 'dark';

  console.log('[Injector] Dark mode ON (press the button again to toggle OFF)');
})();`,
  },

  customFont: {
    name: "Change Page Font",
    description:
      "Change page font to a more readable one. Configurable in settings.",
    category: "🎨 Styling",
    code: `(function changeFont() {
  // ── Choose font as you like ──
  // Some suggestions: 'Georgia', 'Palatino', 'Tahoma', 'Verdana'
  // Or Google Fonts: 'Inter', 'Lora', 'Source Sans Pro', 'Merriweather'
  const FONT_NAME    = 'Georgia';
  const FONT_SIZE    = '17px';
  const LINE_HEIGHT  = '1.8';
  const USE_GOOGLE   = false; // Set true if you want to load from Google Fonts
  const GOOGLE_URL   = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap';

  if (USE_GOOGLE) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = GOOGLE_URL;
    document.head.appendChild(link);
  }

  const css = \`
    body, p, li, td, th, div, span, article, section {
      font-family: '\${FONT_NAME}', serif !important;
      font-size: \${FONT_SIZE} !important;
      line-height: \${LINE_HEIGHT} !important;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: '\${FONT_NAME}', serif !important;
      line-height: 1.3 !important;
    }
    pre, code, .code, [class*="code-"] {
      font-family: 'Courier New', monospace !important;
    }
  \`;

  const id = 'injector-font';
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);

  console.log('[Injector] Font changed to: ' + FONT_NAME);
})();`,
  },

  zoomPage: {
    name: "Custom Page Zoom",
    description:
      "Zoom in/out page content as desired without using browser's Ctrl+/-.",
    category: "🎨 Styling",
    code: `(function customZoom() {
  const ZOOM_LEVEL = 1.15; // 1.0 = 100%, 1.15 = 115%, 0.9 = 90%

  document.body.style.zoom = ZOOM_LEVEL;
  // Fallback for Firefox
  document.body.style.transform       = 'scale(' + ZOOM_LEVEL + ')';
  document.body.style.transformOrigin = 'top left';
  document.body.style.width           = (100 / ZOOM_LEVEL) + '%';

  console.log('[Injector] Zoom set to ' + (ZOOM_LEVEL * 100) + '%');
})();`,
  },

  // ══════════════════════════════════════════
  // 🔧 DEVELOPER TOOLS
  // ══════════════════════════════════════════

  highlightElements: {
    name: "Highlight & Inspect Elements",
    description:
      "Mouse over any element to highlight and show tag, class, id info. Press ESC to disable.",
    category: "🔧 Developer Tools",
    code: `(function elementInspector() {
  const tooltip = document.createElement('div');
  tooltip.style.cssText = \`
    position: fixed; pointer-events: none; z-index: 999999;
    background: #0c0e14; border: 1px solid #3dd6f5;
    color: #dce3f0; font-family: 'Courier New', monospace;
    font-size: 12px; padding: 6px 10px; border-radius: 6px;
    max-width: 320px; word-break: break-all; display: none;
    box-shadow: 0 4px 16px rgba(0,0,0,.5);
  \`;
  document.body.appendChild(tooltip);

  let lastEl = null;

  document.addEventListener('mouseover', e => {
    if (e.target === tooltip) return;
    lastEl = e.target;
    lastEl.style.outline = '2px solid #3dd6f5';

    const tag   = e.target.tagName.toLowerCase();
    const id    = e.target.id    ? '#' + e.target.id    : '';
    const cls   = e.target.className && typeof e.target.className === 'string'
                  ? '.' + [...e.target.classList].slice(0,3).join('.') : '';
    const w     = Math.round(e.target.offsetWidth);
    const h     = Math.round(e.target.offsetHeight);

    tooltip.innerHTML = \`<b style="color:#3dd6f5">\${tag}\${id}\${cls}</b><br>\${w} × \${h}px\`;
    tooltip.style.display = 'block';
  }, true);

  document.addEventListener('mouseout', e => {
    if (lastEl && e.target === lastEl) {
      lastEl.style.outline = '';
      lastEl = null;
    }
    tooltip.style.display = 'none';
  }, true);

  document.addEventListener('mousemove', e => {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top  = (e.clientY + 14) + 'px';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      tooltip.remove();
      if (lastEl) lastEl.style.outline = '';
      console.log('[Injector] Inspector OFF');
    }
  });

  console.log('[Injector] Inspector ON — hover to inspect, ESC to exit');
})();`,
  },

  showGridOverlay: {
    name: "CSS Grid Overlay",
    description:
      "Show 8px grid lines to check layout. Click bookmarklet again to toggle.",
    category: "🔧 Developer Tools",
    code: `(function gridOverlay() {
  const id = 'injector-grid';
  const existing = document.getElementById(id);
  if (existing) { existing.remove(); return; }

  const GRID   = 8;   // px
  const COLOR  = 'rgba(61, 214, 245, 0.08)';
  const ACCENT = 'rgba(61, 214, 245, 0.18)'; // every 8 cells (64px)

  const style = document.createElement('style');
  style.id = id;
  style.textContent = \`
    body::before {
      content: '';
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 999998;
      background-image:
        linear-gradient(to right,  \${ACCENT} 1px, transparent 1px),
        linear-gradient(to bottom, \${ACCENT} 1px, transparent 1px),
        linear-gradient(to right,  \${COLOR}  1px, transparent 1px),
        linear-gradient(to bottom, \${COLOR}  1px, transparent 1px);
      background-size:
        \${GRID * 8}px \${GRID * 8}px,
        \${GRID * 8}px \${GRID * 8}px,
        \${GRID}px     \${GRID}px,
        \${GRID}px     \${GRID}px;
    }
  \`;
  document.head.appendChild(style);
  console.log('[Injector] Grid overlay ON — run again to toggle OFF');
})();`,
  },

  localStorageViewer: {
    name: "LocalStorage / Cookie Viewer",
    description:
      "Display all localStorage and cookies data in readable table format.",
    category: "🔧 Developer Tools",
    code: `(function storageViewer() {
  // Collect data
  const ls = Object.entries(localStorage).map(([k, v]) => ({ key: k, value: v, source: 'localStorage' }));
  const ss = Object.entries(sessionStorage).map(([k, v]) => ({ key: k, value: v, source: 'sessionStorage' }));
  const ck = document.cookie.split(';').filter(Boolean).map(c => {
    const [k, ...rest] = c.trim().split('=');
    return { key: k, value: rest.join('='), source: 'Cookie' };
  });

  const all = [...ls, ...ss, ...ck];

  const sourceColor = { localStorage: '#3dd6f5', sessionStorage: '#7c6cf8', Cookie: '#f5a623' };

  const rows = all.map(item => {
    let val = item.value;
    try { val = JSON.stringify(JSON.parse(val), null, 0); } catch {}
    if (val && val.length > 80) val = val.substring(0, 80) + '…';
    return \`<tr>
      <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06)">
        <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;
          background:rgba(255,255,255,.06);color:\${sourceColor[item.source] || '#fff'}">\${item.source}</span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-family:'Courier New',monospace;font-size:11.5px;color:#3dd6f5;word-break:break-all">\${item.key}</td>
      <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-family:'Courier New',monospace;font-size:11px;color:#9ba8c4;word-break:break-all">\${val || '—'}</td>
    </tr>\`;
  }).join('');

  const panel = document.createElement('div');
  panel.style.cssText = \`
    position:fixed;top:20px;right:20px;width:600px;max-height:70vh;
    background:#111520;border:1px solid rgba(255,255,255,.1);
    border-radius:12px;z-index:999999;overflow:hidden;
    box-shadow:0 16px 48px rgba(0,0,0,.6);
    display:flex;flex-direction:column;
    font-family:system-ui,sans-serif;
  \`;
  panel.innerHTML = \`
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;background:#0c0e14">
      <span style="font-size:13px;font-weight:700;color:#dce3f0">🗄 Storage Viewer</span>
      <span style="display:flex;gap:8px;font-size:11px;color:#5a6480">
        <span style="color:#3dd6f5">\${ls.length} LS</span>
        <span style="color:#7c6cf8">\${ss.length} SS</span>
        <span style="color:#f5a623">\${ck.length} CK</span>
        <span id="wc-sv-close" style="cursor:pointer;color:#ff5a71;font-weight:700;margin-left:8px">✕</span>
      </span>
    </div>
    <div style="overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;color:#dce3f0">
        <thead style="background:#0c0e14;position:sticky;top:0">
          <tr>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5a6480">Source</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5a6480">Key</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5a6480">Value</th>
          </tr>
        </thead>
        <tbody>\${rows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#5a6480">No storage data found</td></tr>'}</tbody>
      </table>
    </div>
  \`;
  document.body.appendChild(panel);
  document.getElementById('wc-sv-close').onclick = () => panel.remove();
})();`,
  },

  // ══════════════════════════════════════════
  // 📊 PAGE ANALYTICS
  // ══════════════════════════════════════════

  pageInfo: {
    name: "Page SEO & Meta Info",
    description:
      "Display complete SEO info: title, description, og tags, canonical, robots, heading structure.",
    category: "📊 Page Analytics",
    code: `(function pageSEOInfo() {
  const getMeta = (name) =>
    document.querySelector('meta[name="' + name + '"]')?.content ||
    document.querySelector('meta[property="' + name + '"]')?.content || '—';

  const headings = {};
  ['h1','h2','h3','h4'].forEach(tag => {
    headings[tag] = document.querySelectorAll(tag).length;
  });

  const imgs = document.querySelectorAll('img');
  const imgsNoAlt = [...imgs].filter(i => !i.alt).length;
  const links = document.querySelectorAll('a[href]').length;

  const data = [
    ['Title',         document.title],
    ['Description',   getMeta('description')],
    ['OG Title',      getMeta('og:title')],
    ['OG Description',getMeta('og:description')],
    ['OG Image',      getMeta('og:image')],
    ['Canonical',     document.querySelector('link[rel="canonical"]')?.href || '—'],
    ['Robots',        getMeta('robots')],
    ['Viewport',      getMeta('viewport')],
    ['H1 count',      headings.h1],
    ['H2 count',      headings.h2],
    ['H3 count',      headings.h3],
    ['Images total',  imgs.length],
    ['Images no-alt', imgsNoAlt + (imgsNoAlt > 0 ? ' ⚠️' : ' ✓')],
    ['Links',         links],
  ];

  const rows = data.map(([k, v]) => \`
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11.5px;font-weight:600;color:#5a6480;white-space:nowrap">\${k}</td>
      <td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#dce3f0;word-break:break-all;max-width:340px">\${v}</td>
    </tr>\`).join('');

  const panel = document.createElement('div');
  panel.style.cssText = \`
    position:fixed;top:20px;left:20px;width:500px;max-height:75vh;
    background:#111520;border:1px solid rgba(255,255,255,.1);
    border-radius:12px;z-index:999999;overflow:hidden;
    box-shadow:0 16px 48px rgba(0,0,0,.6);
    font-family:system-ui,sans-serif;display:flex;flex-direction:column;
  \`;
  panel.innerHTML = \`
    <div style="padding:12px 16px;background:#0c0e14;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;font-weight:700;color:#dce3f0">📊 SEO & Meta Info</span>
      <span id="wc-seo-close" style="cursor:pointer;color:#ff5a71;font-weight:700;font-size:13px">✕</span>
    </div>
    <div style="overflow-y:auto"><table style="width:100%;border-collapse:collapse">\${rows}</table></div>
  \`;
  document.body.appendChild(panel);
  document.getElementById('wc-seo-close').onclick = () => panel.remove();
})();`,
  },

  scrollDepthTracker: {
    name: "Scroll Depth Tracker",
    description:
      "Track and display reading progress bar at top of article.",
    category: "📊 Page Analytics",
    code: `(function scrollDepthTracker() {
  const id = 'injector-progress';
  if (document.getElementById(id)) { document.getElementById(id).remove(); return; }

  const bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = \`
    position: fixed; top: 0; left: 0; height: 3px; width: 0%;
    background: linear-gradient(90deg, #3dd6f5, #7c6cf8);
    z-index: 999999; transition: width .1s ease;
    box-shadow: 0 0 8px rgba(61,214,245,.5);
  \`;

  const pct = document.createElement('span');
  pct.style.cssText = \`
    position:fixed;top:6px;right:12px;
    font-family:system-ui;font-size:11px;font-weight:700;
    color:#3dd6f5;z-index:999999;
    background:rgba(12,14,20,.8);padding:2px 7px;border-radius:5px;
  \`;

  document.body.appendChild(bar);
  document.body.appendChild(pct);

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? Math.round((scrolled / total) * 100) : 0;
    bar.style.width = progress + '%';
    pct.textContent = progress + '%';
  });

  console.log('[Injector] Scroll tracker ON — run again to toggle OFF');
})();`,
  },

  // ══════════════════════════════════════════
  // 🔔 MONITORING / ALERTS
  // ══════════════════════════════════════════

  priceMonitor: {
    name: "Price Change Monitor",
    description:
      "Monitor product price changes on page, send Telegram notification when price changes.",
    category: "🔔 Monitoring",
    code: `(function priceMonitor() {
  // ── Config ──
  const BOT_TOKEN  = 'YOUR_BOT_TOKEN';
  const CHAT_ID    = 'YOUR_CHAT_ID';
  const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  const STORAGE_KEY       = 'wc_price_' + location.hostname;

  // ── Auto-detect price ──
  const priceSelectors = [
    '[class*="price"]', '[class*="Price"]',
    '[class*="cost"]',  '[itemprop="price"]',
    '[data-price]',     '.product-price',
    '#price',           '.sale-price',
    '.current-price',
  ];

  function extractPrice() {
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text  = el.innerText || el.getAttribute('content') || '';
        const match = text.match(/[\d.,]+/);
        if (match) return { text: text.trim(), num: parseFloat(match[0].replace(',', '.')) };
      }
    }
    return null;
  }

  function sendTelegram(msg) {
    const event = new CustomEvent('web-customizer-send-telegram', {
      detail: { botToken: BOT_TOKEN, chatId: CHAT_ID, message: msg }
    });
    document.dispatchEvent(event);
  }

  function check() {
    const current = extractPrice();
    if (!current) return;

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      console.log('[PriceMonitor] Initial price saved:', current.text);
      return;
    }

    if (current.num !== stored.num) {
      const diff    = current.num - stored.num;
      const pct     = ((diff / stored.num) * 100).toFixed(1);
      const arrow   = diff < 0 ? '📉' : '📈';
      const msg = \`\${arrow} <b>Price changed!</b>\\n\\n\` +
        \`🔗 \${document.title}\\n\` +
        \`Before: <s>\${stored.text}</s>\\n\` +
        \`After:  <b>\${current.text}</b>  (\${diff > 0 ? '+' : ''}\${pct}%)\\n\` +
        \`🕐 \${new Date().toLocaleString()}\\n\` +
        \`🔗 <a href="\${location.href}">View page</a>\`;

      sendTelegram(msg);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      console.log('[PriceMonitor] Price changed! New:', current.text);
    }
  }

  check();
  setInterval(check, CHECK_INTERVAL_MS);
  console.log('[PriceMonitor] Watching price every', CHECK_INTERVAL_MS / 1000, 'seconds');
})();`,
  },

  textChangeMonitor: {
    name: "Text Content Change Monitor",
    description:
      "Monitor specific element content changes on page, send Telegram when content changes.",
    category: "🔔 Monitoring",
    code: `(function textChangeMonitor() {
  // ── Config ──
  const BOT_TOKEN   = 'YOUR_BOT_TOKEN';
  const CHAT_ID     = 'YOUR_CHAT_ID';
  const SELECTOR    = '.target-element'; // CSS selector of element to monitor
  const LABEL       = 'My Monitor';      // Name to identify in Telegram

  const el = document.querySelector(SELECTOR);
  if (!el) {
    console.warn('[TextMonitor] Element not found:', SELECTOR);
    return;
  }

  let lastContent = el.innerText.trim();
  console.log('[TextMonitor] Watching:', SELECTOR, '| Initial:', lastContent.substring(0, 80));

  function sendTelegram(msg) {
    const event = new CustomEvent('web-customizer-send-telegram', {
      detail: { botToken: BOT_TOKEN, chatId: CHAT_ID, message: msg }
    });
    document.dispatchEvent(event);
  }

  const observer = new MutationObserver(() => {
    const current = el.innerText.trim();
    if (current !== lastContent) {
      const msg = \`🔔 <b>\${LABEL} — Content Changed!</b>\\n\\n\` +
        \`📌 Element: <code>\${SELECTOR}</code>\\n\` +
        \`🕐 Time: \${new Date().toLocaleString()}\\n\` +
        \`🔗 <a href="\${location.href}">\${document.title}</a>\\n\\n\` +
        \`<b>Before:</b> <i>\${lastContent.substring(0, 200)}</i>\\n\` +
        \`<b>After:</b>  <i>\${current.substring(0, 200)}</i>\`;

      sendTelegram(msg);
      console.log('[TextMonitor] Changed!', current.substring(0, 100));
      lastContent = current;
    }
  });

  observer.observe(el, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  console.log('[TextMonitor] Active — watching for changes in:', SELECTOR);
})();`,
  },

  // ══════════════════════════════════════════
  // 🛒 E-COMMERCE
  // ══════════════════════════════════════════

  couponFinder: {
    name: "Coupon Code Finder",
    description:
      "Find and display all coupon codes hidden in page source code.",
    category: "🛒 E-Commerce",
    code: `(function couponFinder() {
  const couponPatterns = [
    /coupon[_-]?code[\"'\s:=]+([A-Z0-9_-]{4,20})/gi,
    /promo[_-]?code[\"'\s:=]+([A-Z0-9_-]{4,20})/gi,
    /discount[_-]?code[\"'\s:=]+([A-Z0-9_-]{4,20})/gi,
    /voucher[_-]?code[\"'\s:=]+([A-Z0-9_-]{4,20})/gi,
    /gift[_-]?code[\"'\s:=]+([A-Z0-9_-]{4,20})/gi,
    /code[\"':\s]+([A-Z]{2,4}[0-9]{2,8})/g,
  ];

  const source = document.documentElement.innerHTML;
  const found  = new Set();

  couponPatterns.forEach(pattern => {
    let m;
    while ((m = pattern.exec(source)) !== null) {
      if (m[1] && m[1].length >= 4 && m[1].length <= 20) {
        found.add(m[1].toUpperCase());
      }
    }
  });

  // Also search in script tags
  document.querySelectorAll('script').forEach(s => {
    const text = s.textContent;
    couponPatterns.forEach(pattern => {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(text)) !== null) {
        if (m[1]) found.add(m[1].toUpperCase());
      }
    });
  });

  const codes = [...found];
  const panel = document.createElement('div');
  panel.style.cssText = \`
    position:fixed;top:20px;right:20px;width:300px;
    background:#111520;border:1px solid rgba(61,214,245,.25);
    border-radius:12px;z-index:999999;overflow:hidden;
    box-shadow:0 16px 48px rgba(0,0,0,.6);
    font-family:system-ui,sans-serif;
  \`;

  const items = codes.length > 0
    ? codes.map(c => \`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">
        <code style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#3dd6f5">\${c}</code>
        <button onclick="navigator.clipboard.writeText('\${c}');this.textContent='✓ Copied!';setTimeout(()=>this.textContent='Copy',1500)"
          style="font-size:10px;padding:3px 9px;background:rgba(61,214,245,.1);border:1px solid rgba(61,214,245,.25);
          border-radius:5px;color:#3dd6f5;cursor:pointer;font-family:inherit">Copy</button>
      </div>\`).join('')
    : '<div style="padding:16px;text-align:center;color:#5a6480;font-size:12px">No coupon codes found in page source</div>';

  panel.innerHTML = \`
    <div style="padding:12px 16px;background:#0c0e14;border-bottom:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:700;color:#dce3f0">🎟 Coupon Finder · \${codes.length} found</span>
      <span id="wc-cf-close" style="cursor:pointer;color:#ff5a71;font-weight:700">✕</span>
    </div>
    \${items}
  \`;
  document.body.appendChild(panel);
  document.getElementById('wc-cf-close').onclick = () => panel.remove();
})();`,
  },

  // ══════════════════════════════════════════
  // 🖱 AUTOMATION
  // ══════════════════════════════════════════

  infiniteScrollLoader: {
    name: "Auto Infinite Scroll",
    description:
      "Automatically scroll page to load more content, useful for infinite scroll pages.",
    category: "🖱 Automation",
    code: `(function autoScroll() {
  const SCROLL_SPEED  = 3;     // px per tick
  const TICK_INTERVAL = 30;    // ms
  const PAUSE_AT_BOTTOM = 2000; // ms pause when reaching bottom to wait for more content
  const MAX_SCROLLS   = 50;    // max number of scroll-to-bottom cycles (0 = unlimited)

  const id = 'injector-autoscroll';
  if (window[id]) {
    clearInterval(window[id]);
    window[id] = null;
    console.log('[AutoScroll] Stopped');
    return;
  }

  let bottomCount = 0;
  let waiting     = false;

  window[id] = setInterval(() => {
    if (waiting) return;

    window.scrollBy(0, SCROLL_SPEED);

    const isBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 50;
    if (isBottom) {
      bottomCount++;
      if (MAX_SCROLLS > 0 && bottomCount >= MAX_SCROLLS) {
        clearInterval(window[id]);
        window[id] = null;
        console.log('[AutoScroll] Reached max scroll limit:', MAX_SCROLLS);
        return;
      }
      waiting = true;
      setTimeout(() => { waiting = false; }, PAUSE_AT_BOTTOM);
      console.log('[AutoScroll] Bottom reached, waiting for more content... (' + bottomCount + ')');
    }
  }, TICK_INTERVAL);

  console.log('[AutoScroll] Started — run again to STOP');
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearInterval(window[id]);
      window[id] = null;
      console.log('[AutoScroll] Stopped by ESC');
    }
  }, { once: true });
})();`,
  },

  copyAllLinks: {
    name: "Copy All Links on Page",
    description:
      "Collect and copy all valid URLs on page to clipboard, one link per line.",
    category: "🖱 Automation",
    code: `(function copyAllLinks() {
  const links = [...new Set(
    [...document.querySelectorAll('a[href]')]
      .map(a => a.href)
      .filter(href =>
        href.startsWith('http') &&
        !href.includes('javascript:') &&
        !href.includes('#')
      )
  )];

  if (links.length === 0) {
    console.log('[Injector] No links found');
    return;
  }

  navigator.clipboard.writeText(links.join('\\n')).then(() => {
    const toast = document.createElement('div');
    toast.style.cssText = \`
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#141720;border:1px solid rgba(45,212,160,.3);
      color:#2dd4a0;font-family:system-ui;font-size:13px;font-weight:600;
      padding:10px 20px;border-radius:10px;z-index:999999;
      box-shadow:0 4px 20px rgba(0,0,0,.4);
    \`;
    toast.textContent = '✓ Copied ' + links.length + ' links to clipboard';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  });

  console.log('[Injector] Copied', links.length, 'links');
})();`,
  },

  downloadAllImages: {
    name: "Download All Images",
    description:
      "Download all images on page (only significant size images, skip small icons).",
    category: "🖱 Automation",
    code: `(function downloadImages() {
  const MIN_SIZE   = 100; // px — skip images smaller than this
  const MAX_BATCH  = 20;  // max images at once

  const imgs = [...document.querySelectorAll('img')]
    .filter(img => {
      const src = img.src || img.dataset.src || img.dataset.lazySrc;
      return src &&
        !src.startsWith('data:') &&
        img.naturalWidth  >= MIN_SIZE &&
        img.naturalHeight >= MIN_SIZE;
    });

  if (imgs.length === 0) {
    console.log('[Injector] No qualifying images found');
    return;
  }

  const toDownload = imgs.slice(0, MAX_BATCH);
  if (!confirm('Download ' + toDownload.length + ' images?\n(Min size: ' + MIN_SIZE + 'px, max batch: ' + MAX_BATCH + ')')) return;

  toDownload.forEach((img, i) => {
    setTimeout(() => {
      const src = img.src || img.dataset.src;
      const ext = src.split('.').pop().split('?')[0] || 'jpg';
      const a   = document.createElement('a');
      a.href     = src;
      a.download = 'image-' + (i + 1) + '.' + ext;
      a.target   = '_blank';
      a.click();
    }, i * 300); // delay to avoid browser blocking
  });

  console.log('[Injector] Downloading', toDownload.length, 'images...');
})();`,
  },

  // ══════════════════════════════════════════
  // 💬 SOCIAL MEDIA
  // ══════════════════════════════════════════

  twitterClean: {
    name: "Clean Twitter / X UI",
    description:
      "Hide Trends, Who to Follow, ad suggestions and annoying widgets on Twitter/X.",
    category: "💬 Social Media",
    code: `(function cleanTwitter() {
  const css = \`
    /* Hide right sidebar: Trends, Who to follow */
    [data-testid="sidebarColumn"] { display: none !important; }

    /* Hide Promoted tweets */
    [data-testid="placementTracking"] { display: none !important; }

    /* Hide "Who to follow" in timeline */
    [data-testid="UserCell"] ~ div[class] { }
    aside[aria-label*="follow" i]        { display: none !important; }

    /* Hide Topics to follow */
    [data-testid="TopicsModule"]         { display: none !important; }

    /* Hide Download app banner */
    [id="layers"] [href*="download"]     { display: none !important; }

    /* Wider content when no sidebar */
    [data-testid="primaryColumn"] { max-width: 700px !important; }
  \`;

  const style = document.createElement('style');
  style.id = 'injector-twitter-clean';
  style.textContent = css;
  document.head.appendChild(style);

  console.log('[Injector] Twitter/X cleaned');
})();`,
  },

  facebookClean: {
    name: "Clean Facebook Feed",
    description:
      "Hide sidebar, Stories, Reels, suggested users, ads from Facebook news feed.",
    category: "💬 Social Media",
    code: `(function cleanFacebook() {
  const css = \`
    /* Hide right column (ads, birthday, events) */
    [data-pagelet="RightRail"]  { display: none !important; }

    /* Hide Stories bar */
    [data-pagelet="Stories"]    { display: none !important; }
    [aria-label="Stories"]      { display: none !important; }

    /* Hide Reels */
    [data-pagelet*="Reels"]     { display: none !important; }

    /* Hide Suggested for you / Sponsored */
    [data-pagelet="FeedUnit_0"] [aria-label*="Suggested"],
    [aria-label="Sponsored"]    { display: none !important; }

    /* Hide left sidebar (bookmarks, groups list) */
    [data-pagelet="LeftRail"]   { display: none !important; }

    /* Expand feed */
    [data-pagelet="FeedUnit_0"] { max-width: 680px !important; margin: 0 auto !important; }
  \`;

  const style = document.createElement('style');
  style.id = 'injector-fb-clean';
  style.textContent = css;
  document.head.appendChild(style);

  // Continuously remove dynamic sponsored posts
  const observer = new MutationObserver(() => {
    document.querySelectorAll('[aria-label="Sponsored"]')
      .forEach(el => el.closest('[data-pagelet]')?.remove());
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[Injector] Facebook cleaned');
})();`,
  },

  // ══════════════════════════════════════════
  // 🔑 SESSION SHARING
  // ══════════════════════════════════════════

  sessionExport: {
    name: "Session Exporter",
    description:
      "Export cookies + localStorage of current page as code to share with others (no password sharing needed).",
    category: "🔑 Session Sharing",
    code: `(function sessionExport() {
  const domain = location.hostname;

  // ── Collect Cookies ──
  // Note: cookies with HttpOnly flag (set by server) CANNOT be read by JS
  // This is browser limitation, not script error
  const cookies = document.cookie
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .reduce((obj, c) => {
      const sep = c.indexOf('=');
      if (sep === -1) return obj;
      obj[c.substring(0, sep).trim()] = c.substring(sep + 1).trim();
      return obj;
    }, {});

  // ── Collect localStorage ──
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    ls[key] = localStorage.getItem(key);
  }

  // ── Collect sessionStorage ──
  const ss = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    ss[key] = sessionStorage.getItem(key);
  }

  const ckCount = Object.keys(cookies).length;
  const lsCount = Object.keys(ls).length;
  const ssCount = Object.keys(ss).length;

  if (ckCount === 0 && lsCount === 0) {
    alert('⚠️ No session data found.\n\nThis page likely uses HttpOnly cookies — cannot export via JavaScript.');
    return;
  }

  const payload = JSON.stringify({ domain, cookies, localStorage: ls, sessionStorage: ss }, null, 2);
  const encoded = btoa(unescape(encodeURIComponent(payload)));

  // ── Show UI ──
  const panel = document.createElement('div');
  panel.style.cssText = \`
    position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;z-index:999999;
    font-family:system-ui,sans-serif;
  \`;
  panel.innerHTML = \`
    <div style="background:#111520;border:1px solid rgba(61,214,245,.2);border-radius:14px;
      padding:24px;width:min(560px,95vw);max-height:85vh;overflow-y:auto;
      box-shadow:0 24px 60px rgba(0,0,0,.6)">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700;color:#dce3f0">📤 Session Export</div>
        <span id="wc-ex-close" style="cursor:pointer;color:#ff5a71;font-weight:700;font-size:16px">✕</span>
      </div>

      <div style="background:rgba(245,166,35,.07);border:1px solid rgba(245,166,35,.2);
        border-radius:8px;padding:10px 13px;margin-bottom:16px;font-size:12px;color:#9ba8c4;line-height:1.6">
        ⚠️ <strong style="color:#f5a623">Warning:</strong>
        This code lets the recipient log in as you.
        <strong style="color:#dce3f0">Only send to people you truly trust.</strong>
        Session can expire at any time.
      </div>

      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div style="flex:1;background:#1c2133;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:#3dd6f5">\${ckCount}</div>
          <div style="font-size:10px;color:#5a6480;margin-top:2px">Cookies</div>
        </div>
        <div style="flex:1;background:#1c2133;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:#7c6cf8">\${lsCount}</div>
          <div style="font-size:10px;color:#5a6480;margin-top:2px">LocalStorage</div>
        </div>
        <div style="flex:1;background:#1c2133;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:#2dd4a0">\${ssCount}</div>
          <div style="font-size:10px;color:#5a6480;margin-top:2px">SessionStorage</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:600;color:#5a6480;margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em">
        Session Code — send this to recipient
      </div>
      <textarea id="wc-ex-code" readonly style="width:100%;height:100px;background:#0c0e14;border:1px solid rgba(255,255,255,.1);
        border-radius:8px;padding:10px;color:#3dd6f5;font-family:'Courier New',monospace;font-size:11px;
        resize:none;outline:none;word-break:break-all;line-height:1.5">\${encoded}</textarea>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="wc-ex-copy" style="flex:1;padding:10px;background:linear-gradient(135deg,#3dd6f5,#7c6cf8);
          border:none;border-radius:8px;color:#0b0d13;font-weight:700;font-size:13px;cursor:pointer">
          ⎘ Copy Session Code
        </button>
        <button id="wc-ex-dl" style="padding:10px 16px;background:#1c2133;border:1px solid rgba(255,255,255,.1);
          border-radius:8px;color:#9ba8c4;font-size:13px;cursor:pointer">
          ↓ Save File
        </button>
      </div>
    </div>
  \`;

  document.body.appendChild(panel);

  document.getElementById('wc-ex-close').onclick = () => panel.remove();
  panel.addEventListener('click', e => { if (e.target === panel) panel.remove(); });

  document.getElementById('wc-ex-copy').onclick = function() {
    navigator.clipboard.writeText(encoded).then(() => {
      this.textContent = '✓ Copied!';
      setTimeout(() => { this.textContent = '⎘ Copy Session Code'; }, 2000);
    });
  };

  document.getElementById('wc-ex-dl').onclick = () => {
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = \`session-\${domain}-\${Date.now()}.json\`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Auto-select when clicking textarea
  document.getElementById('wc-ex-code').onclick = function() { this.select(); };
})();`,
  },

  sessionImport: {
    name: "Session Importer",
    description:
      "Import session code exported from Script Exporter to login to account without password.",
    category: "🔑 Session Sharing",
    code: `(function sessionImport() {
  const domain = location.hostname;

  // ── Apply session data ──
  function applySession(payload) {
    let imported = { cookies: 0, localStorage: 0, sessionStorage: 0, skipped: 0 };

    // Import localStorage
    if (payload.localStorage) {
      Object.entries(payload.localStorage).forEach(([k, v]) => {
        try { localStorage.setItem(k, v); imported.localStorage++; }
        catch { imported.skipped++; }
      });
    }

    // Import sessionStorage
    if (payload.sessionStorage) {
      Object.entries(payload.sessionStorage).forEach(([k, v]) => {
        try { sessionStorage.setItem(k, v); imported.sessionStorage++; }
        catch { imported.skipped++; }
      });
    }

    // Import cookies
    // Note: HttpOnly/Secure/SameSite cookies need server set — JS can only set regular cookies
    if (payload.cookies) {
      Object.entries(payload.cookies).forEach(([k, v]) => {
        try {
          // Set with path=/ and max-age 7 days
          document.cookie = \`\${k}=\${v}; path=/; max-age=604800; SameSite=Lax\`;
          imported.cookies++;
        } catch { imported.skipped++; }
      });
    }

    return imported;
  }

  // ── UI ──
  const panel = document.createElement('div');
  panel.style.cssText = \`
    position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;z-index:999999;
    font-family:system-ui,sans-serif;
  \`;
  panel.innerHTML = \`
    <div style="background:#111520;border:1px solid rgba(124,108,248,.2);border-radius:14px;
      padding:24px;width:min(520px,95vw);box-shadow:0 24px 60px rgba(0,0,0,.6)">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700;color:#dce3f0">📥 Session Import</div>
        <span id="wc-im-close" style="cursor:pointer;color:#ff5a71;font-weight:700;font-size:16px">✕</span>
      </div>

      <div style="background:rgba(255,90,113,.06);border:1px solid rgba(255,90,113,.2);
        border-radius:8px;padding:10px 13px;margin-bottom:16px;font-size:12px;color:#9ba8c4;line-height:1.6">
        ⚠️ <strong style="color:#ff5a71">Only import session code from people you trust.</strong>
        Importing session from unknown sources can compromise your account.
      </div>

      <div style="font-size:11px;font-weight:600;color:#5a6480;margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em">
        Paste Session Code here
      </div>
      <textarea id="wc-im-input" placeholder="Paste session code here..." style="width:100%;height:100px;
        background:#0c0e14;border:1px solid rgba(255,255,255,.1);border-radius:8px;
        padding:10px;color:#dce3f0;font-family:'Courier New',monospace;font-size:11px;
        resize:none;outline:none;line-height:1.5;margin-bottom:8px"></textarea>

      <div id="wc-im-preview" style="display:none;background:#1c2133;border:1px solid rgba(255,255,255,.07);
        border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px;color:#9ba8c4;line-height:1.7"></div>

      <div id="wc-im-domain-warn" style="display:none;background:rgba(245,166,35,.07);
        border:1px solid rgba(245,166,35,.2);border-radius:8px;padding:10px 13px;
        margin-bottom:12px;font-size:12px;color:#f5a623"></div>

      <div style="display:flex;gap:8px">
        <button id="wc-im-preview-btn" style="flex:1;padding:10px;background:#1c2133;
          border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#9ba8c4;font-size:13px;cursor:pointer">
          🔍 Preview
        </button>
        <button id="wc-im-apply" disabled style="flex:2;padding:10px;background:rgba(124,108,248,.3);
          border:none;border-radius:8px;color:#9ba8c4;font-weight:700;font-size:13px;cursor:not-allowed;
          transition:all .2s">
          📥 Import & Reload
        </button>
      </div>
    </div>
  \`;

  document.body.appendChild(panel);
  document.getElementById('wc-im-close').onclick = () => panel.remove();
  panel.addEventListener('click', e => { if (e.target === panel) panel.remove(); });

  let parsedPayload = null;

  document.getElementById('wc-im-preview-btn').onclick = () => {
    const raw = document.getElementById('wc-im-input').value.trim();
    if (!raw) return;

    try {
      const decoded = decodeURIComponent(escape(atob(raw)));
      parsedPayload  = JSON.parse(decoded);
    } catch {
      // Try parse directly if raw JSON (from downloaded file)
      try { parsedPayload = JSON.parse(raw); }
      catch {
        document.getElementById('wc-im-preview').style.display = 'block';
        document.getElementById('wc-im-preview').innerHTML =
          '<span style="color:#ff5a71">❌ Invalid session code. Please check again.</span>';
        return;
      }
    }

    const ck = Object.keys(parsedPayload.cookies || {}).length;
    const ls = Object.keys(parsedPayload.localStorage || {}).length;
    const ss = Object.keys(parsedPayload.sessionStorage || {}).length;
    const srcDomain = parsedPayload.domain || 'unknown';

    const preview = document.getElementById('wc-im-preview');
    preview.style.display = 'block';
    preview.innerHTML = \`
      <div style="margin-bottom:8px;font-weight:600;color:#dce3f0">📋 Session info:</div>
      <div>🌐 Source domain: <strong style="color:#3dd6f5">\${srcDomain}</strong></div>
      <div>🍪 Cookies: <strong style="color:#3dd6f5">\${ck}</strong></div>
      <div>💾 LocalStorage: <strong style="color:#7c6cf8">\${ls}</strong> keys</div>
      <div>📋 SessionStorage: <strong style="color:#2dd4a0">\${ss}</strong> keys</div>
    \`;
    // Domain mismatch warning
    const domainWarn = document.getElementById('wc-im-domain-warn');
    if (srcDomain !== domain) {
      domainWarn.style.display = 'block';
      domainWarn.innerHTML = '\\u26a0\\ufe0f This session was exported from <strong>' + srcDomain + '</strong> but you\\'re on <strong>' + domain + '</strong>. Different domains \\u2014 session may not work.';
    } else {
      domainWarn.style.display = 'none';
    }

    // Unlock Import button
    const applyBtn = document.getElementById('wc-im-apply');
    applyBtn.disabled = false;
    applyBtn.style.background = 'linear-gradient(135deg,#7c6cf8,#3dd6f5)';
    applyBtn.style.color = '#0b0d13';
    applyBtn.style.cursor = 'pointer';
  };

  document.getElementById('wc-im-apply').onclick = () => {
    if (!parsedPayload) return;
    const result = applySession(parsedPayload);

    const applyBtn = document.getElementById('wc-im-apply');
    applyBtn.textContent = 'â Imported ' + (result.cookies + result.localStorage + result.sessionStorage) + ' items â Reloading...';
    applyBtn.disabled = true;

    setTimeout(() => location.reload(), 1200);
  };
})();`,
  },
};

// Export for Node.js / module environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = SCRIPT_TEMPLATES;
}
