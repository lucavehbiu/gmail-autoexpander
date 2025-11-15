# Testing Guide - Gmail Auto-Expander

## Quick Start

### 1. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top right corner)
3. Click **"Load unpacked"**
4. Select the **`dist`** folder from this project
5. You should see "Gmail Unlimited - Auto Expander" appear in your extensions list

### 2. Verify Extension Loaded

- Click the extension icon in Chrome toolbar (puzzle piece icon → Gmail Unlimited)
- You should see the settings popup with toggles and statistics
- All settings should be ON by default except "Error reporting"

### 3. Test on Gmail

1. Go to https://mail.google.com
2. Open an email that has "[Message clipped] View entire message" text
3. The extension should automatically expand it within 1 second
4. You should see a small "✓ Expanded" badge appear

## Finding Clipped Emails

Gmail clips emails that are **over 102KB**. To test, you need to find or create clipped emails:

### Option 1: Use Existing Clipped Emails
- Look for emails with **"[Message clipped]"** text at the bottom
- Common in:
  - Long newsletter subscriptions
  - Email threads with many replies
  - Automated reports with lots of data

### Option 2: Create a Test Email
1. Compose a new email to yourself
2. Paste a very long text (copy-paste a Wikipedia article 10+ times)
3. Send it to yourself
4. Open the received email - it should be clipped

## Testing Checklist

### ✅ Core Functionality
- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] Auto-expand works on clipped messages
- [ ] Manual refresh still expands new messages
- [ ] Multiple clipped messages in one thread all expand

### ✅ Settings
- [ ] Toggle "Auto-expand" OFF → messages don't auto-expand
- [ ] Toggle "Debug mode" ON → check browser console for logs (F12)
- [ ] Statistics update when messages expand
- [ ] "Reset Settings" button works (confirms before resetting)

### ✅ Performance
- [ ] Page loads normally (no slowdown)
- [ ] No console errors (press F12 to check)
- [ ] Extension doesn't spam expand attempts (rate limited to 5/sec)

### ✅ Edge Cases
- [ ] Works with HTML-formatted emails
- [ ] Works with emails containing images
- [ ] Works in email threads (conversations)
- [ ] Doesn't break on non-clipped emails

## Debugging

### Enable Debug Mode
1. Click extension icon
2. Toggle "Debug mode" ON
3. Open browser console (F12)
4. Look for `[Gmail Expander]` logs

### Common Issues

**Extension doesn't appear:**
- Make sure you selected the `dist` folder, not the project root
- Check `chrome://extensions/` for any errors
- Try removing and re-adding the extension

**Auto-expand not working:**
- Check if toggle is ON in settings
- Open console (F12) and look for errors
- Enable debug mode to see what's happening
- Make sure you're on `https://mail.google.com` (not inbox.google.com or other variants)

**Messages expand but badge doesn't show:**
- This is a minor UI issue
- Core functionality is working
- Check console for any DOM insertion errors

## Development Testing

### Rebuild After Changes
```bash
npm run build
```

### Live Development (HMR)
```bash
npm run dev
```
Then reload the extension in Chrome (click the reload icon on `chrome://extensions/`)

### Check for TypeScript Errors
```bash
npm run type-check
```

## Ready for Production?

Before submitting to Chrome Web Store:

- [ ] All core features working
- [ ] No console errors
- [ ] Extension icon looks professional
- [ ] Description and branding are finalized
- [ ] Tested on at least 10 different emails
- [ ] Tested in different Gmail layouts (default, compact, comfortable)
- [ ] Privacy policy created (if needed)
- [ ] Screenshots/promotional images ready

## Need Help?

- Check browser console for errors (F12)
- Review `src/content/index.tsx` for expansion logic
- Enable debug mode in settings for detailed logs
- Open an issue on GitHub with error details
