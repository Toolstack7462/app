# ToolStack Chrome Extension

A Chrome Extension (Manifest V3) for accessing tools assigned through the ToolStack CRM with automatic credential synchronization.

## Features

- **One Extension for All Tools**: Access any assigned tool from a single extension
- **Auto-sync Credentials**: Extension automatically detects and pulls latest credentials when admin updates them
- **Multiple Credential Types**: Supports cookies, tokens/headers, and localStorage
- **Permission Management**: Requests domain permissions only when needed
- **Secure Storage**: Credentials are encrypted and stored securely

## Installation

### Development/Testing

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

### Production

Package the extension as a `.crx` file or publish to Chrome Web Store.

## Usage

### First-time Setup

1. Click the ToolStack icon in Chrome toolbar
2. Click "Configure API URL" and enter your CRM URL (e.g., `https://your-crm.com`)
3. Sign in with your ToolStack client credentials

### Accessing Tools

1. Click the extension icon to see your assigned tools
2. Click "Open" on any tool to:
   - Automatically apply the latest credentials
   - Open the tool in a new tab
3. If a tool shows "Grant Access", click to grant the necessary domain permission

### Auto-sync

- The extension checks for credential updates every 15 minutes
- When updates are available, a badge appears on the extension icon
- Click the sync button (↻) to manually check for updates

## API Endpoints

The extension communicates with the following backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/extension/auth` | POST | Authenticate and get extension token |
| `/api/crm/extension/logout` | POST | Revoke extension token |
| `/api/crm/extension/tools` | GET | Get assigned tools with versions |
| `/api/crm/extension/tools/versions` | GET | Lightweight version check |
| `/api/crm/extension/tools/:id/credentials` | GET | Get decrypted credentials |
| `/api/crm/extension/tools/:id/opened` | POST | Log tool opened event |
| `/api/crm/extension/profile` | GET | Get user profile |
| `/api/crm/extension/domains` | GET | Get list of tool domains |

## Credential Format

### Cookies
```json
[
  {
    "name": "session_id",
    "value": "abc123",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "lax",
    "expirationDate": 1735689600
  }
]
```

### Token/Header
```json
{
  "header": "Authorization",
  "prefix": "Bearer ",
  "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### LocalStorage
```json
{
  "key1": "value1",
  "key2": "value2"
}
```

## Security

- Extension tokens expire after 30 days
- Credentials are encrypted at rest in the database (AES-256-GCM)
- Each credential fetch is logged for audit purposes
- Tokens can be revoked from the admin panel

## Adding a New Tool Domain

1. In the admin panel, create or edit a tool
2. Set the Target URL (domain is extracted automatically)
3. Upload credentials (cookies, token, or localStorage data)
4. The tool will appear in assigned clients' extension
5. Clients will be prompted to grant permission for the new domain

## Troubleshooting

### "Invalid credentials" on login
- Ensure you're using your ToolStack client account (not admin)
- Check the API URL is correct

### Tool shows "Grant Access"
- Click to grant Chrome permission for that domain
- This is required for the extension to set cookies

### Credentials not working
- Click sync to get the latest credentials
- Check if the tool assignment hasn't expired
- Contact admin if credentials are outdated

## Development

### File Structure
```
chrome-extension/
├── manifest.json      # Extension manifest (MV3)
├── popup.html         # Popup UI
├── css/
│   └── popup.css      # Popup styles
├── js/
│   ├── api.js         # API client and storage utilities
│   ├── popup.js       # Popup logic
│   └── background.js  # Service worker for auto-sync
└── icons/
    └── *.png          # Extension icons
```

### Building
No build step required. The extension uses vanilla JS with ES modules.

### Testing
1. Load as unpacked extension
2. Use Chrome DevTools to debug:
   - Right-click extension icon → "Inspect popup"
   - Go to `chrome://extensions` → "service worker" link for background script
