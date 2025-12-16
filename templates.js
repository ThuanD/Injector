// Script Templates for Web Customizer
// Common script templates for users to quickly use/modify

const SCRIPT_TEMPLATES = {
    removeById: {
        name: "Remove Elements by ID Pattern",
        description: "Remove elements with IDs containing specific text patterns",
        category: "DOM Manipulation",
        code: `// Remove elements with IDs containing "ads" or "banner"
const patterns = ['ads', 'banner', 'popup'];

patterns.forEach(pattern => {
    document.querySelectorAll('[id*="' + pattern + '"]').forEach(el => {
        console.log('Removed element with ID:', el.id);
        el.remove();
    });
});`
    },

    removeByClass: {
        name: "Remove Elements by Class Pattern",
        description: "Remove elements with classes containing specific text patterns",
        category: "DOM Manipulation",
        code: `// Remove elements with classes containing "advertisement" or "sponsored"
const patterns = ['advertisement', 'sponsored', 'promo'];

patterns.forEach(pattern => {
    document.querySelectorAll('[class*="' + pattern + '"]').forEach(el => {
        console.log('Removed element with class:', el.className);
        el.remove();
    });
});`
    },

    hideElements: {
        name: "Hide Elements by Selector",
        description: "Hide elements by CSS selector",
        category: "DOM Manipulation",
        code: `// Hide elements by selector
const selectors = [
    '.sidebar-ads',
    '#popup-modal',
    '[data-ad-slot]'
];

selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        console.log('Hidden element:', selector);
    });
});`
    },

    autoClickButton: {
        name: "Auto Click Button",
        description: "Automatically click buttons/links when page loads",
        category: "Automation",
        code: `// Automatically click button after page loads
function autoClick() {
    const button = document.querySelector('button.accept-cookies'); // Change selector
    if (button) {
        button.click();
        console.log('Auto-clicked button');
        return true;
    }
    return false;
}

// Try clicking immediately
if (!autoClick()) {
    // If button not found, wait 2 seconds and try again
    setTimeout(autoClick, 2000);
}`
    },

    autoFillForm: {
        name: "Auto Fill Form Fields",
        description: "Automatically fill form information",
        category: "Automation",
        code: `// Automatically fill form
const formData = {
    '#email': 'your-email@example.com',
    '#username': 'your-username',
    'input[name="phone"]': '0123456789'
};

Object.entries(formData).forEach(([selector, value]) => {
    const field = document.querySelector(selector);
    if (field) {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Filled field:', selector);
    }
});`
    },

    modifyText: {
        name: "Replace Text Content",
        description: "Replace text content on the page",
        category: "Content Modification",
        code: `// Replace text on the page
const replacements = {
    'Old Text': 'New Text',
    'Price: $99': 'Price: $0',
    'Subscribe': 'No Thanks'
};

function replaceText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent;
        Object.entries(replacements).forEach(([oldText, newText]) => {
            text = text.replace(new RegExp(oldText, 'gi'), newText);
        });
        if (text !== node.textContent) {
            node.textContent = text;
        }
    } else {
        node.childNodes.forEach(replaceText);
    }
}

replaceText(document.body);
console.log('Text replacement completed');`
    },

    addCustomCSS: {
        name: "Inject Custom CSS",
        description: "Add custom CSS to the page",
        category: "Styling",
        code: `// Add custom CSS
const customCSS = \`
    /* Hide ads */
    .ad-container { display: none !important; }
    
    /* Change background color */
    body { background-color: #f5f5f5 !important; }
    
    /* Customize font */
    * { font-family: 'Arial', sans-serif !important; }
\`;

const style = document.createElement('style');
style.textContent = customCSS;
document.head.appendChild(style);
console.log('Custom CSS injected');`
    },

    darkMode: {
        name: "Force Dark Mode",
        description: "Enable dark mode for any website",
        category: "Styling",
        code: `// Force dark mode
const darkModeCSS = \`
    html {
        filter: invert(1) hue-rotate(180deg);
        background-color: #000 !important;
    }
    
    img, video, [style*="background-image"] {
        filter: invert(1) hue-rotate(180deg);
    }
\`;

const style = document.createElement('style');
style.textContent = darkModeCSS;
document.head.appendChild(style);
console.log('Dark mode enabled');`
    },

    removeOverlay: {
        name: "Remove Overlay/Paywall",
        description: "Remove overlay and enable scrolling",
        category: "DOM Manipulation",
        code: `// Remove overlay and enable scroll
// Remove common overlays
const overlaySelectors = [
    '.modal-backdrop',
    '.overlay',
    '[class*="paywall"]',
    '[id*="overlay"]'
];

overlaySelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => el.remove());
});

// Enable scroll
document.body.style.overflow = 'auto';
document.documentElement.style.overflow = 'auto';

// Remove inline styles that block scrolling
document.querySelectorAll('[style*="overflow"]').forEach(el => {
    el.style.overflow = 'auto';
});

console.log('Overlay removed, scroll enabled');`
    },

    downloadImages: {
        name: "Download All Images",
        description: "Download all images on the page",
        category: "Utility",
        code: `// Download all images
const images = document.querySelectorAll('img');
let count = 0;

images.forEach((img, index) => {
    if (img.src && !img.src.startsWith('data:')) {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = \`image-\${index + 1}.jpg\`;
            a.click();
        }, index * 200); // Add delay to prevent browser blocking
        count++;
    }
});

console.log(\`Downloaded \${count} images\`);
alert(\`Started downloading \${count} images\`);`
    },

    copyAllLinks: {
        name: "Copy All Links",
        description: "Copy all links on the page",
        category: "Utility",
        code: `// Copy all links
const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => a.href)
    .filter(href => href.startsWith('http'))
    .join('\\n');

navigator.clipboard.writeText(links).then(() => {
    const count = links.split('\\n').length;
    console.log(\`Copied \${count} links to clipboard\`);
    alert(\`Copied \${count} links to clipboard!\`);
}).catch(err => {
    console.error('Failed to copy:', err);
});`
    },

    highlightKeywords: {
        name: "Highlight Keywords",
        description: "Highlight keywords on the page",
        category: "Content Modification",
        code: `// Highlight keywords
const keywords = ['important', 'note', 'warning']; // Change keywords
const highlightColor = '#ffff00';

function highlightText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent;
        if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
            const span = document.createElement('span');
            // Create a single regex for all keywords to avoid replacing HTML tags or attributes
            const regex = new RegExp('(' + keywords.map(k => k.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('|') + ')', 'gi');
            
            span.innerHTML = text.replace(regex, 
                \`<mark style="background: \${highlightColor};">$1</mark>\`);
            node.parentNode.replaceChild(span, node);
        }
    } else if (node.nodeType === Node.ELEMENT_NODE && 
               node.tagName !== 'SCRIPT' && 
               node.tagName !== 'STYLE') {
        Array.from(node.childNodes).forEach(highlightText);
    }
}

highlightText(document.body);
console.log('Keywords highlighted');`
    },

    autoScroll: {
        name: "Auto Scroll Page",
        description: "Automatically scroll page (useful for infinite scroll)",
        category: "Automation",
        code: `// Auto scroll
let scrollInterval;
let scrollSpeed = 50; // pixels per interval
let scrollDelay = 100; // milliseconds

function startAutoScroll() {
    scrollInterval = setInterval(() => {
        window.scrollBy(0, scrollSpeed);
        
        // Stop when reaching the bottom (with 10px buffer)
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 10) {
            stopAutoScroll();
            console.log('Reached end of page');
        }
    }, scrollDelay);
    console.log('Auto scroll started');
}

function stopAutoScroll() {
    clearInterval(scrollInterval);
    console.log('Auto scroll stopped');
}

// Bắt đầu scroll
startAutoScroll();

// Dừng khi nhấn ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        stopAutoScroll();
    }
});`
    },

    blockRequests: {
        name: "Block Network Requests",
        description: "Block unwanted network requests (analytics, ads)",
        category: "Performance",
        code: `// Block unwanted requests
const blockedDomains = [
    'google-analytics.com',
    'doubleclick.net',
    'facebook.com/tr',
    'googletagmanager.com'
];

// Override fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && blockedDomains.some(domain => url.includes(domain))) {
        console.log('Blocked fetch request:', url);
        return Promise.reject(new Error('Blocked by script'));
    }
    return originalFetch.apply(this, args);
};

// Override XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (blockedDomains.some(domain => url.includes(domain))) {
        console.log('Blocked XHR request:', url);
        return;
    }
    return originalOpen.apply(this, [method, url, ...rest]);
};

console.log('Request blocking enabled');`
    },

    customAlert: {
        name: "Custom Alert Message",
        description: "Display custom alert message when entering the page",
        category: "Utility",
        code: `// Custom alert
const message = "Welcome to this website!";
const style = \`
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 999999;
    font-family: Arial, sans-serif;
    animation: slideIn 0.3s ease-out;
\`;

const alertBox = document.createElement('div');
alertBox.textContent = message;
alertBox.style.cssText = style;
document.body.appendChild(alertBox);

// Auto remove after 5 seconds
setTimeout(() => {
    alertBox.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => alertBox.remove(), 300);
}, 5000);

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = \`
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
\`;
document.head.appendChild(styleSheet);`
    }
};

// Export for use in options.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SCRIPT_TEMPLATES;
}
