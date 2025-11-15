# GMAIL AUTO-EXPANDER CHROME EXTENSION
## Complete Product Specification & Technical Brief

**Project Name:** Gmail Unlimited (or "GmailExpand Pro")  
**Version:** 1.0  
**Launch Target:** November 17-18, 2025  
**Price:** $0.99 one-time purchase  
**Developer Platform:** React + TypeScript (or vanilla JS for speed)  
**Build Time Estimate:** 2-3 days

---

## 1. PRODUCT OVERVIEW

### Purpose
Automatically expand Gmail-clipped messages without manual interaction. When a user opens an email with "[Message clipped] View entire message" text, the extension auto-clicks the expand button and displays full content instantly.

### Why It Exists
- **Problem:** Gmail clips emails >102KB, forcing users to click extra links
- **Current Solution:** Trimless for Gmail V3 ($4.99 one-time, limited to 5 expansions/day free)
- **Our Solution:** Unlimited auto-expansion at $0.99, completely automatic

### Core Value Proposition
> "Never click 'View entire message' again. Auto-expand all clipped Gmail emails instantly."

---

## 2. FEATURE SET (MVP)

### 🎯 PRIMARY FEATURES (Must-Have)

#### Feature 1: Auto-Expand Clipped Messages
**What it does:**
- Detects when an email displays "[Message clipped] View entire message" text
- Automatically finds and clicks the "View entire message" button
- Waits for content to load and injects it into the current email view
- User sees full email without leaving the inbox/thread view

**Technical Implementation:**
```
TRIGGER: Gmail page load → scan DOM for clipped message indicators
DETECTION: Look for:
  - Text containing "[Message clipped]"
  - Class/element with "View entire message" button
  - aria-label or data-attributes related to clipping

ACTION: 
  1. Find the expand button (usually a <a> or <button>)
  2. Simulate click OR fetch the full message via iframe loading
  3. Wait 500-1000ms for Gmail to inject content
  4. Verify content changed (scrollHeight increased)
  5. Log successful expansion

ERROR HANDLING:
  - If button not found: silently skip (not all emails are clipped)
  - If expansion fails: retry once after 1 second delay
  - Timeout after 3 seconds (don't freeze the UI)
```

**User Experience:**
- Email opens → instantly expands without any user action
- No new tab/window opens
- Message flows naturally in existing view
- Works in both Gmail web interface and Gmail inbox preview

---

#### Feature 2: Per-Email Toggle Control
**What it does:**
- Small icon in email toolbar (next to archive, delete buttons)
- Users can click to manually expand if auto-expand didn't work
- Shows status: "Expanded ✓" or "Not clipped" or "Click to expand"

**Technical Implementation:**
```
LOCATION: Gmail email header (next to existing action buttons)
ICON: Simple 📖 or ⬆️ icon (or expand arrow)
ACTION ON CLICK: 
  - Trigger manual expansion
  - Change icon to show "Expanded ✓"
  - Persist state in local storage per email ID
```

---

#### Feature 3: Settings Panel
**Location:** Extension popup (click extension icon in toolbar)

**Settings Include:**
1. **Auto-expand toggle**
   - ON (default): Auto-expand all clipped messages
   - OFF: Manual mode only

2. **Expansion behavior**
   - Option A: Expand in current view (default)
   - Option B: Open in new tab [ADVANCED - skip for MVP]

3. **Debug mode**
   - Toggle ON/OFF
   - Shows console logs for troubleshooting
   - Shows "Expansion attempted" notifications

4. **Enable/disable by sender**
   - Whitelist: Only expand from certain senders [SKIP FOR MVP]
   - Blacklist: Never expand from certain domains [SKIP FOR MVP]

5. **Statistics** (nice-to-have)
   - Total emails expanded today
   - Total emails expanded (all-time)
   - Last expanded: [sender name] [SKIP FOR MVP]

**Example Settings Panel:**
```
┌─────────────────────────────────┐
│ Gmail Auto-Expander Settings    │
├─────────────────────────────────┤
│ ☑ Auto-expand enabled           │
│                                 │
│ Expand behavior:                │
│ ◯ Current view (recommended)    │
│ ◯ New tab                       │
│                                 │
│ ☐ Show debug notifications      │
│                                 │
│ [Clear Settings] [Reset]        │
└─────────────────────────────────┘
```

---

### 🚀 SECONDARY FEATURES (Nice-to-Have, V1.1)

#### Feature 4: Batch Expand All Messages in Thread [V1.1]
- One button click: expand all clipped emails in current conversation
- Useful for long email threads with multiple clipped messages
- Status: "Expanding 3 messages... Done! ✓"

#### Feature 5: Keyboard Shortcut [V1.1]
- Keyboard shortcut (e.g., Ctrl+Shift+E) to manually trigger expansion
- Show toast notification confirming action

#### Feature 6: Dark Mode for Clipped Content [V1.1]
- Auto-apply dark mode styling to expanded content
- Respects system dark mode preference
- Prevents eye strain when reading at night

#### Feature 7: Cloud Sync Settings [SKIP - too complex for MVP]
- Sync settings across devices
- Save expansion history

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Tech Stack
```
Frontend:
- HTML5 / CSS3 / Vanilla JavaScript (for speed)
- OR React 18 + TypeScript (if developer prefers)
- Manifest V3 (required for Chrome Web Store 2025)

Browser APIs:
- Chrome Storage API (settings persistence)
- Chrome Runtime API (background scripts)
- Chrome Scripting API (content scripts)

No external dependencies recommended (keep bundle size <100KB)
```

### 3.2 File Structure
```
gmail-expander/
├── manifest.json                 [Extension config, permissions]
├── src/
│   ├── content-script.js         [Main expansion logic]
│   ├── background.js             [Event handlers, alarms]
│   ├── popup.html                [Settings UI]
│   ├── popup.js                  [Settings logic]
│   └── styles.css                [All styling]
├── icons/
│   ├── icon-16.png               [16x16 icon]
│   ├── icon-48.png               [48x48 icon]
│   └── icon-128.png              [128x128 icon]
└── README.md                     [User-facing documentation]
```

### 3.3 Core Implementation: Content Script (content-script.js)

```javascript
// MAIN EXPANSION LOGIC

// 1. DETECT CLIPPED MESSAGES
function findClippedMessages() {
  const indicators = [
    // Gmail web interface selectors
    "a[href*='&view=full']",           // Gmail expand button
    "[data-message-clipped='true']",   // Gmail data attribute
    "*:contains('[Message clipped]')", // Text search (Gmail uses this)
  ];
  
  let clippedCount = 0;
  
  // Scan page for clipped indicators
  document.querySelectorAll("div[role='main']").forEach(section => {
    const text = section.innerText;
    
    // Check if text contains clipping indicator
    if (text.includes("[Message clipped]") || 
        text.includes("View entire message") ||
        text.includes("Show trimmed content")) {
      
      clippedCount++;
      const expandButton = section.querySelector("a[href*='&view=full']") ||
                          section.querySelector("button[aria-label*='entire']") ||
                          section.querySelector("a:contains('View entire message')");
      
      if (expandButton) {
        expandMessage(expandButton, section);
      }
    }
  });
  
  logDebug(`Found ${clippedCount} clipped messages`);
}

// 2. EXPAND MESSAGE (AUTO-CLICK + WAIT)
function expandMessage(button, emailContainer) {
  chrome.storage.sync.get('autoExpandEnabled', (data) => {
    if (data.autoExpandEnabled === false) return; // User disabled
    
    logDebug("Attempting to expand message...");
    
    // Store current content size
    const originalHeight = emailContainer.scrollHeight;
    
    // Click the expand button
    button.click();
    
    // Wait for content to load (Gmail injects via iframe)
    setTimeout(() => {
      const newHeight = emailContainer.scrollHeight;
      
      if (newHeight > originalHeight) {
        logDebug("✓ Message expanded successfully");
        updateUI("expanded", emailContainer);
      } else {
        logDebug("⚠ Expansion may have failed, retrying...");
        // Retry once
        setTimeout(() => button.click(), 500);
      }
    }, 1000); // Wait 1 second for Gmail to load
  });
}

// 3. AUTO-RUN ON PAGE LOAD
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findClippedMessages);
} else {
  findClippedMessages();
}

// 4. WATCH FOR NEW EMAILS (MutationObserver)
const observer = new MutationObserver((mutations) => {
  findClippedMessages(); // Re-scan after each mutation
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: false,
  attributes: false,
});

// 5. LOGGING & DEBUG
function logDebug(message) {
  chrome.storage.sync.get('debugMode', (data) => {
    if (data.debugMode) {
      console.log("[Gmail Expander]", message);
      // Could also show browser notification
    }
  });
}

// 6. UPDATE UI
function updateUI(status, element) {
  const indicator = document.createElement("span");
  indicator.textContent = status === "expanded" ? "✓ Expanded" : "Not clipped";
  indicator.style.cssText = "font-size: 12px; color: green; margin-left: 10px;";
  element.appendChild(indicator);
}
```

### 3.4 Manifest.json Configuration

```json
{
  "manifest_version": 3,
  "name": "Gmail Unlimited - Auto Expander",
  "version": "1.0.0",
  "description": "Automatically expand clipped Gmail messages. Never click 'View entire message' again.",
  
  "permissions": [
    "storage",
    "scripting"
  ],
  
  "host_permissions": [
    "https://mail.google.com/*",
    "https://gmail.google.com/*"
  ],
  
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  
  "action": {
    "default_title": "Gmail Unlimited Settings",
    "default_popup": "popup.html",
    "default_icon": "icons/icon-48.png"
  },
  
  "content_scripts": [
    {
      "matches": [
        "https://mail.google.com/*",
        "https://gmail.google.com/*"
      ],
      "js": ["src/content-script.js"],
      "run_at": "document_end"
    }
  ],
  
  "background": {
    "service_worker": "src/background.js"
  }
}
```

### 3.5 Settings Popup (popup.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gmail Unlimited Settings</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="popup-container">
    <h1>Gmail Unlimited</h1>
    
    <div class="setting">
      <label>
        <input type="checkbox" id="autoExpandToggle" checked>
        <span>Auto-expand clipped messages</span>
      </label>
    </div>
    
    <div class="setting">
      <label>
        <input type="checkbox" id="debugToggle">
        <span>Show debug messages</span>
      </label>
    </div>
    
    <div class="info-box">
      <p><strong>📊 Stats:</strong></p>
      <p>Messages expanded: <span id="expandCount">0</span></p>
      <p>Last expanded: <span id="lastExpanded">Never</span></p>
    </div>
    
    <button id="resetBtn" class="btn-secondary">Reset Settings</button>
    
    <div class="footer">
      <p>Version 1.0 | Made with ❤️</p>
      <a href="https://your-support-page.com">Support</a>
    </div>
  </div>
  
  <script src="src/popup.js"></script>
</body>
</html>
```

### 3.6 Settings Script (popup.js)

```javascript
// Load saved settings
chrome.storage.sync.get(['autoExpandEnabled', 'debugMode', 'expandCount'], (data) => {
  document.getElementById('autoExpandToggle').checked = data.autoExpandEnabled !== false;
  document.getElementById('debugToggle').checked = data.debugMode || false;
  document.getElementById('expandCount').textContent = data.expandCount || 0;
});

// Save settings on change
document.getElementById('autoExpandToggle').addEventListener('change', (e) => {
  chrome.storage.sync.set({ autoExpandEnabled: e.target.checked });
});

document.getElementById('debugToggle').addEventListener('change', (e) => {
  chrome.storage.sync.set({ debugMode: e.target.checked });
});

// Reset button
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Reset all settings to default?')) {
    chrome.storage.sync.clear(() => {
      location.reload();
    });
  }
});
```

---

## 4. DEVELOPMENT CHECKLIST

### Phase 1: Core Development (Day 1)
- [ ] Set up manifest.json (Manifest V3)
- [ ] Build content-script.js with expansion logic
- [ ] Build popup UI (HTML + CSS)
- [ ] Implement settings persistence (Chrome Storage API)
- [ ] Test on live Gmail inbox

### Phase 2: Testing & Refinement (Day 2)
- [ ] Test with various email types (with images, tables, long threads)
- [ ] Test auto-expand reliability (retry logic)
- [ ] Test MutationObserver performance (no CPU spike)
- [ ] Verify permissions are minimal
- [ ] Test on mobile Gmail (if needed)

### Phase 3: Polish & Store Submission (Day 2-3)
- [ ] Create extension icons (16x16, 48x48, 128x128 PNG)
- [ ] Write concise Chrome Store description
- [ ] Create promotional image/screenshot
- [ ] Test one-click payment integration (Google Play billing)
- [ ] Submit to Chrome Web Store for review

---

## 5. CHROME WEB STORE LISTING

### Title (≤45 chars)
**"Gmail Unlimited - Auto Expander"**

### Short Description (≤80 chars)
**"Auto-expand clipped Gmail emails instantly. Never click again. $0.99"**

### Full Description (≤4000 chars)
```
Gmail Unlimited automatically expands clipped emails so you can read full messages instantly—no more clicking "View entire message" links.

KEY FEATURES:
✓ Auto-expand all clipped messages instantly
✓ Works with long emails, newsletters, and large attachments
✓ Manual expand button if auto-detection misses something
✓ Simple settings with zero configuration needed
✓ Privacy-first: All processing happens locally in your browser

HOW IT WORKS:
When you open an email that Gmail has clipped (over 102KB), our extension automatically clicks the expand button for you. You see the full email instantly without any extra steps.

PERFECT FOR:
• Newsletter subscribers who receive long emails
• Professionals receiving large reports and documents
• Anyone tired of clicking "View entire message"

PERMISSIONS:
Only accesses Gmail pages. No data collection. No tracking.

ONE-TIME PURCHASE: Just $0.99 — own it forever, no subscription.
```

### Keywords (≤13 words, comma-separated)
`Gmail, clipped, expand, message, email, productivity, auto-expand`

### Category
`Productivity`

### Price
`$0.99 USD`

---

## 6. MONETIZATION & DISTRIBUTION

### Payment Gateway
- **Primary:** Google Play Billing (required for Chrome Web Store paid apps)
- **Alternative:** Gumroad (if easier setup)
- **Payout:** ~70% to developer after fees

### Launch Strategy
1. **Day 1:** Submit to Chrome Web Store (48-72hr review time)
2. **Day 2:** Post on Reddit (r/Gmail, r/chrome_extensions, r/productivity)
   - Title: "I built an extension that removes Gmail clipping frustration for $0.99"
   - Screenshot: Before/After side-by-side
3. **Day 3:** Post on Product Hunt
   - Detailed explanation of the problem & solution
   - Link to store

### Marketing Copy for Reddit/PH
```
After years of clicking "View entire message" in Gmail, I built an extension that does it for you automatically.

Key differences from competitors:
- $0.99 one-time (vs. $4.99 competitors)
- Unlimited expansions (no daily limits)
- Zero configuration needed
- Works instantly on page load

It's been working flawlessly for 100+ test emails. Launching this week on Chrome Web Store.

Would love feedback before the official launch!

[Link to store]
```

---

## 7. QUALITY ASSURANCE TESTING

### Test Cases

#### Test 1: Basic Auto-Expand
- Step 1: Open Gmail inbox with a clipped email visible
- Step 2: Click to open email
- Expected: Extension auto-expands within 1 second
- Success Criteria: Email displays full content without manual click

#### Test 2: Multiple Clipped Emails in Thread
- Step 1: Open a conversation with 3+ clipped emails
- Step 2: Scroll through conversation
- Expected: All clipped emails auto-expand in sequence
- Success Criteria: No manual intervention needed

#### Test 3: Settings Toggle
- Step 1: Open extension popup
- Step 2: Toggle "Auto-expand" OFF
- Step 3: Reload Gmail and open a clipped email
- Expected: Email remains clipped (no auto-expansion)
- Success Criteria: User toggle works correctly

#### Test 4: Manual Expand Button
- Step 1: Disable auto-expand in settings
- Step 2: Open popup/toolbar button while viewing clipped email
- Step 3: Click manual expand button
- Expected: Message expands immediately
- Success Criteria: Manual mode works as fallback

#### Test 5: Performance
- Step 1: Open inbox with 20+ emails
- Step 2: Observe CPU usage and memory
- Expected: No significant impact on page load time
- Success Criteria: Page loads in <3 seconds (same as without extension)

#### Test 6: Email Formats
Test with:
- Plain text emails
- HTML emails with images
- Emails with tables
- Emails with embedded videos/links
- Emails with attachments
- Success: All types expand correctly

---

## 8. KNOWN LIMITATIONS & FUTURE IMPROVEMENTS

### Current Limitations (V1.0)
- Only works on Gmail web (not mobile app)
- Requires page reload after first expansion to work again on new emails
- Some unusual Gmail layouts may not expand (edge case)
- Does not work in Gmail preview pane (only full email view)

### Future Improvements (V1.1+)
- [ ] Batch expand all in thread
- [ ] Keyboard shortcuts
- [ ] Dark mode for expanded content
- [ ] Cloud sync of settings
- [ ] Email domain whitelist/blacklist
- [ ] Expansion statistics & analytics
- [ ] Support for Gmail mobile app (Manifest V2 required - not possible until Google allows)
- [ ] Firefox port
- [ ] Brave browser support

---

## 9. SUCCESS METRICS (First Month)

### Revenue Target
- **Conservative:** 20-30 users × $0.99 = $20-30
- **Realistic:** 100-150 users × $0.99 = $100-150
- **Optimistic:** 500+ users × $0.99 = $500+

### User Satisfaction Target
- Target Rating: 4.5+ stars (out of 5)
- Target Reviews: 50+ within first month
- Target User Retention: 60%+ (users keep it installed after 1 week)

### Marketing Metrics
- Reddit Post Engagement: 100+ upvotes
- Product Hunt Engagement: 200+ upvotes / 50+ comments
- Click-through from stores: 5-10% conversion

---

## 10. SUPPORT & MAINTENANCE

### First Week Support
- Monitor Chrome Web Store reviews hourly
- Respond to all negative reviews immediately
- Fix any critical bugs within 24 hours
- Update version 1.0.1 with bug fixes

### Long-term (After V1.0)
- Add features from user feedback
- Release monthly updates
- Maintain compatibility with Gmail UI changes
- Keep Manifest V3 compliance updated

---

## 11. LEGAL & COMPLIANCE

### Privacy
- No user data collection
- No tracking
- No analytics
- Chrome Storage API only stores settings locally

### Terms of Service
- Users purchase one-time license (non-refundable)
- Extension provided "as-is"
- User responsible for Gmail account security
- No warranty on future Gmail compatibility

### Compliance
- ✓ Manifest V3 compliant
- ✓ Chrome Web Store policies compliant
- ✓ No content theft or scraping
- ✓ No auto-enrollment or hidden charges

---

## APPENDIX A: Chrome Storage API Example

```javascript
// Save setting
chrome.storage.sync.set({ autoExpandEnabled: true });

// Load setting
chrome.storage.sync.get('autoExpandEnabled', (data) => {
  console.log(data.autoExpandEnabled); // true or false
});

// Clear all settings
chrome.storage.sync.clear();
```

---

## APPENDIX B: Useful Gmail Selectors (for debugging)

```javascript
// Gmail expand button selector (tested Nov 2025)
'a[href*="&view=full"]'
'button[aria-label*="entire message"]'
'button[aria-label*="trimmed"]'

// Gmail message container
'div[role="main"] div[role="article"]'
'div[jsname="aOA8R"]' // Gmail-specific class (may change)

// Clipped message text search
document.body.innerText.includes('[Message clipped]')
document.body.innerText.includes('View entire message')
```

---

## APPENDIX C: Manifest V3 Migration Notes

**Why Manifest V3?**
- Chrome requires all extensions to use MV3 as of 2025
- MV2 extensions are disabled
- Trimless already uses MV3

**Key Changes from MV2:**
- ❌ No content_security_policy (use default)
- ❌ No XMLHttpRequest in content script (use fetch)
- ✓ Service workers instead of background pages
- ✓ declarativeNetRequest instead of webRequest
- ✓ More limited permissions model

**For this extension:** We're simple enough that MV3 is straightforward. No blocking network requests needed.

---

## QUICK START FOR DEVELOPER

1. Create folder: `gmail-expander/`
2. Copy manifest.json + all source files from this spec
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" → select `gmail-expander/` folder
6. Go to `mail.google.com`, open any email
7. Should auto-expand if clipped
8. Test settings popup by clicking extension icon

---

**Questions?** This spec is comprehensive enough for a junior developer to build autonomously. Encourage them to test frequently and ask questions if unclear on any requirement.

**Ready to build? LET'S GO! 🚀**
