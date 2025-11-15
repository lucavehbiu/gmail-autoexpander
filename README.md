# Gmail Unlimited - Auto Expander

Automatically expand clipped Gmail messages. Never click "View entire message" again.

## Features

- ✅ Auto-expand all clipped messages instantly
- ✅ Works with long emails, newsletters, and large attachments
- ✅ Manual expand button if auto-detection misses something
- ✅ Simple settings with zero configuration needed
- ✅ Privacy-first: All processing happens locally in your browser
- ✅ Rate limiting to prevent spam (5 expansions/sec max)
- ✅ Retry logic with exponential backoff
- ✅ Opt-in error reporting

## Development

### Prerequisites

- Node.js 18+ and npm
- Chrome browser

### Setup

```bash
# Install dependencies
npm install

# Run development build with HMR
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

### Loading in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### Project Structure

```
gmail-autoexpander/
├── src/
│   ├── content/          # Content scripts (runs on Gmail)
│   ├── background/       # Service worker
│   ├── popup/            # Settings UI (React)
│   ├── types/            # TypeScript definitions
│   └── utils/            # Shared utilities
├── icons/                # Extension icons
├── manifest.json         # Extension manifest (MV3)
└── vite.config.ts        # Build configuration
```

## Tech Stack

- **Build Tool**: Vite + CRXJS (HMR support)
- **Language**: TypeScript
- **Framework**: React 18
- **Manifest**: V3 (Chrome requirement)

## License

MIT

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/your-repo/issues).
