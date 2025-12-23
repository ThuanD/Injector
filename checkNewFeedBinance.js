// ============================================
// Binance Square Post Monitor
// ============================================

(function() {
  'use strict';
  
  // ===== CONFIG =====
  const TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
  const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID_HERE";
  
  const MIN_RELOAD_SECONDS = 1;
  const MAX_RELOAD_SECONDS = 5;
  const STORAGE_KEY = 'binance_square_last_post_id';
  
  // ===== HELPER FUNCTIONS =====
  
  function getRandomReloadTime() {
    const seconds = Math.floor(Math.random() * (MAX_RELOAD_SECONDS - MIN_RELOAD_SECONDS + 1)) + MIN_RELOAD_SECONDS;
    return seconds * 1000;
  }
  
  function getLatestPostId() {
    const posts = document.querySelectorAll('.FeedBuzzBaseView_FeedBuzzBaseViewRoot__1sC8Q[data-id]');
    
    if (posts.length === 0) {
      console.log('[Binance Monitor] No posts found on page');
      return null;
    }
    
    let maxId = 0;
    let foundNonPinned = false;
    
    posts.forEach(post => {
      // Check if post is pinned
      const parent = post.closest('.FeedBuzzBaseView_FeedBuzzBaseViewRootBox__1fzEU');
      const isPinned = parent && parent.querySelector('.text-xs')?.textContent?.includes('PINNED');
      
      if (!isPinned) {
        const id = parseInt(post.getAttribute('data-id'), 10);
        if (!isNaN(id) && id > maxId) {
          maxId = id;
          foundNonPinned = true;
        }
      }
    });
    
    if (!foundNonPinned) {
      console.log('[Binance Monitor] Only pinned posts found, skipping');
      return null;
    }
    
    console.log(`[Binance Monitor] Latest non-pinned post ID: ${maxId}`);
    return maxId;
  }
  
  function getStoredPostId() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  }
  
  function savePostId(id) {
    localStorage.setItem(STORAGE_KEY, id.toString());
    console.log(`[Binance Monitor] Saved post ID: ${id}`);
  }
  
  async function sendTelegramNotification(postId) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const message = `🔔 New post detected on Binance Square!\n\nPost ID: ${postId}\nTime: ${new Date().toLocaleString()}\n\nCheck: https://www.binance.com/en/square`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      if (response.ok) {
        console.log('[Binance Monitor] ✅ Telegram notification sent successfully');
      } else {
        const error = await response.text();
        console.error('[Binance Monitor] ❌ Failed to send Telegram notification:', error);
      }
    } catch (error) {
      console.error('[Binance Monitor] ❌ Error sending Telegram notification:', error);
    }
  }
  
  function scheduleNextReload() {
    const delay = getRandomReloadTime();
    const nextReloadTime = new Date(Date.now() + delay);
    
    console.log(`[Binance Monitor] Next reload scheduled in ${delay / 1000}s at ${nextReloadTime.toLocaleTimeString()}`);
    
    setTimeout(() => {
      console.log('[Binance Monitor] Reloading page...');
      location.reload();
    }, delay);
  }
  
  // ===== MAIN LOGIC =====
  
  function init() {
    console.log('[Binance Monitor] 🚀 Initialized at', new Date().toLocaleString());
    console.log(`[Binance Monitor] ⚙️ Config: Reload interval ${MIN_RELOAD_SECONDS}s - ${MAX_RELOAD_SECONDS}s`);
    console.log(`[Binance Monitor] 💾 Storage key: ${STORAGE_KEY}`);
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkForNewPosts);
    } else {
      // Use a small delay to ensure dynamic content is loaded
      setTimeout(checkForNewPosts, 2000);
    }
  }
  
  async function checkForNewPosts() {
    console.log('[Binance Monitor] Checking for new posts...');
    
    const currentPostId = getLatestPostId();
    
    if (currentPostId === null) {
      console.log('[Binance Monitor] No valid posts found, will retry on next reload');
      scheduleNextReload();
      return;
    }
    
    const storedPostId = getStoredPostId();
    
    if (storedPostId === null) {
      // First run - just save the current post ID
      console.log('[Binance Monitor] First run - saving current post ID');
      savePostId(currentPostId);
    } else if (currentPostId > storedPostId) {
      // New post detected!
      console.log(`[Binance Monitor] 🎉 NEW POST DETECTED! Old: ${storedPostId}, New: ${currentPostId}`);
      await sendTelegramNotification(currentPostId);
      savePostId(currentPostId);
    } else {
      console.log('[Binance Monitor] No new posts');
    }
    
    // Schedule next reload
    scheduleNextReload();
  }
  
  // Start the monitor
  init();
  
})();
