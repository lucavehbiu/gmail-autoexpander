# Gmail DOM Structure Debugger

If the extension isn't finding clipped messages, run this in the browser console on Gmail to check the DOM structure:

## Step 1: Check Main Content Area

```javascript
// Check if main content area exists
console.log('Main content:', document.querySelector('div[role="main"]'));

// Alternative selectors to try
console.log('Alternative 1:', document.querySelector('[role="main"]'));
console.log('Alternative 2:', document.querySelector('.AO'));
console.log('Alternative 3:', document.querySelector('.nH'));
console.log('Body classes:', document.body.className);
```

## Step 2: Check for Clipped Message Indicators

```javascript
// Search for clipped message text
const bodyText = document.body.innerText;
console.log('Has [Message clipped]:', bodyText.includes('[Message clipped]'));
console.log('Has View entire message:', bodyText.includes('View entire message'));
console.log('Has Show trimmed content:', bodyText.includes('Show trimmed content'));

// Find all links
const allLinks = Array.from(document.querySelectorAll('a'));
const viewFullLinks = allLinks.filter(a => a.href.includes('view=full'));
console.log('View full links found:', viewFullLinks.length);
if (viewFullLinks.length > 0) {
  console.log('Example link:', viewFullLinks[0]);
}
```

## Step 3: Check Message Containers

```javascript
// Check different container selectors
console.log('Articles:', document.querySelectorAll('div[role="article"]').length);
console.log('Data-message-id:', document.querySelectorAll('div[data-message-id]').length);
console.log('.a3s elements:', document.querySelectorAll('div.a3s').length);

// Show first article if exists
const firstArticle = document.querySelector('div[role="article"]');
if (firstArticle) {
  console.log('First article:', firstArticle);
  console.log('First article text (first 200 chars):', firstArticle.innerText.substring(0, 200));
}
```

## Step 4: Manual Test Expansion

```javascript
// Find and click expand button manually
const expandBtn = document.querySelector('a[href*="view=full"]');
if (expandBtn) {
  console.log('Expand button found:', expandBtn);
  console.log('Will click in 3 seconds...');
  setTimeout(() => {
    expandBtn.click();
    console.log('Clicked!');
  }, 3000);
} else {
  console.log('No expand button found - email might not be clipped');
}
```

## What to Look For

### ✅ Good Signs
- Main content area is found
- Clipped message text appears in body
- Expand button with `view=full` exists
- Articles are detected

### ❌ Problem Signs
- Main content area is `null`
- No clipped message indicators found
- Selectors return 0 results
- Gmail layout is very different

## Common Issues

### Issue 1: Wrong Gmail View
**Problem**: You're on inbox.google.com instead of mail.google.com
**Fix**: Go to https://mail.google.com

### Issue 2: Gmail Layout Changed
**Problem**: Google updated Gmail's HTML structure
**Fix**: We need to update selectors in the extension

### Issue 3: Email Isn't Actually Clipped
**Problem**: The email is under 102KB
**Fix**: Find a longer email or compose one with lots of text

### Issue 4: Timing Issue
**Problem**: Extension loads before Gmail finishes rendering
**Fix**: Extension uses MutationObserver, should auto-fix after a few seconds

## Send Me the Results

Copy the console output and share it with me so I can:
1. Update selectors if Gmail changed
2. Fix any bugs in detection logic
3. Add fallback selectors for reliability
