# ToolStack Chrome Extension

Enterprise-grade auto-login system with intelligent strategy fallback for web tools.

## Version 2.0.0

### New Features

- **Content Script Auto-Login**: Automatically detects login pages and triggers authentication
- **Pluggable Strategy Engine**: Multiple login strategies with intelligent fallback
- **SPA Support**: Works with React, Next.js, Vue, and Angular applications
- **One-Click Login**: Click a tool → opens & auto-authenticates seamlessly
- **Silent Authentication**: Minimal UX disruption, reload only when necessary

## Architecture

```
chrome-extension/
├── manifest.json           # Manifest V3 configuration
├── popup.html              # Extension popup UI
├── css/
│   └── popup.css           # Popup styles
├── icons/                  # Extension icons
└── js/
    ├── api.js              # API client & utilities
    ├── background.js       # Service worker (central controller)
    ├── popup.js            # Popup UI logic
    ├── content.js          # Content script (runs in pages)
    ├── config/
    │   └── toolConfigs.js  # Per-tool configurations
    └── strategies/
        ├── BaseStrategy.js     # Base class for strategies
        ├── StrategyEngine.js   # Strategy orchestrator
        ├── CookieStrategy.js   # Session/cookie injection
        ├── TokenStrategy.js    # JWT/localStorage/sessionStorage
        ├── FormStrategy.js     # Form auto-fill & submit
        └── OAuthStrategy.js    # OAuth/SSO foundation
```

## Login Strategies

### 1. Cookie Strategy
Injects session cookies before opening the tool tab.

```json
{
  "type": "cookies",
  "data": [
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
}
```

### 2. Token Strategy
Injects tokens into localStorage or sessionStorage.

```json
{
  "type": "localStorage",
  "data": {
    "auth_token": "eyJhbGc...",
    "user_id": "12345",
    "refresh_token": "xyz789"
  }
}
```

### 3. Form Strategy
Auto-fills and submits login forms (generic + per-tool selectors).

```json
{
  "type": "form",
  "data": {
    "username": "user@example.com",
    "password": "secret123"
  },
  "selectors": {
    "username": "#email-input",
    "password": "#password-input",
    "submit": "#login-button"
  }
}
```

### 4. OAuth Strategy
Handles OAuth/SSO authentication flows.

```json
{
  "type": "oauth",
  "data": {
    "provider": "google",
    "tokens": {
      "accessToken": "ya29...",
      "refreshToken": "1//...",
      "expiresAt": 1735689600
    }
  }
}
```

### 5. Mixed/Multi Strategy
Combines multiple strategies with fallback.

```json
{
  "type": "mixed",
  "strategies": ["cookie", "token", "form"],
  "cookies": [...],
  "storage": {...},
  "formData": {...}
}
```

## Installation

### Development Installation

1. Clone or download this extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder

### From ZIP

1. Download the `chrome-extension.zip` file
2. Extract to a folder
3. Follow steps 2-5 from Development Installation

## Usage

### Initial Setup

1. Click the extension icon in Chrome toolbar
2. Click "Configure API" and enter your ToolStack API URL
3. Login with your ToolStack client credentials

### One-Click Login

1. Click on any tool in the list
2. If prompted, grant permission for that domain
3. The extension will:
   - Fetch credentials from ToolStack API
   - Execute appropriate login strategy (cookie → token → form → oauth)
   - Open the tool website with authentication
   - Verify login success

### Auto-Login (Content Script)

When you navigate to a configured tool's website:
1. Content script detects the login page
2. Background service worker fetches credentials
3. Strategy engine executes appropriate login method
4. Page is refreshed if needed to apply authentication

## Strategy Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Strategy Engine                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Pre-Execute (no tab needed)                                 │
│     ├── Cookie Strategy ────────────► Set cookies via API      │
│     │                                                            │
│  2. Open Tab                                                     │
│     ├── Create tab with tool URL                                │
│     ├── Wait for page load                                      │
│     └── Reload if cookies were set                              │
│                                                                  │
│  3. Post-Execute (tab required)                                 │
│     ├── Token Strategy ─────────────► Inject localStorage       │
│     ├── Form Strategy ──────────────► Auto-fill & submit        │
│     └── OAuth Strategy ─────────────► Click OAuth button        │
│                                                                  │
│  4. Verify & Complete                                           │
│     ├── Check login indicators                                  │
│     ├── Reload if needed                                        │
│     └── Log tool opened                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## SPA Support

The extension detects and handles Single Page Applications:

- **Route Change Detection**: Monitors `pushState`, `replaceState`, `popstate`, and `hashchange`
- **Mutation Observer**: Detects when login forms are dynamically added to DOM
- **Framework Support**: Works with React, Vue, Angular, Next.js
- **Controlled Input Handling**: Properly sets values on React/Vue controlled inputs

## Per-Tool Configuration

Tools can be configured with specific settings:

```javascript
{
  id: 'tool-123',
  name: 'My Tool',
  domain: 'app.example.com',
  targetUrl: 'https://app.example.com/dashboard',
  loginUrl: 'https://app.example.com/login',
  strategies: ['cookie', 'token', 'form'],
  selectors: {
    username: '#email',
    password: '#password',
    submit: 'button[type="submit"]'
  },
  options: {
    reloadAfterLogin: true,
    waitForNavigation: true,
    spaMode: true
  }
}
```

## API Endpoints

The extension expects these endpoints from your ToolStack API:

```
POST /api/crm/extension/auth
  Body: { email, password }
  Response: { token, expiresAt, user }

GET /api/crm/extension/tools
  Response: { tools: [...] }

GET /api/crm/extension/tools/:id/credentials
  Response: { tool, credentials }

POST /api/crm/extension/tools/:id/opened
  Response: { success: true }

GET /api/crm/extension/profile
  Response: { user, token }

GET /api/crm/extension/tools/versions
  Response: { versions: {...} }
```

## Credential Types from Backend

The backend can return credentials in any of these formats:

| Type | Description |
|------|-------------|
| `cookies` | Array of cookie objects to inject |
| `localStorage` | Object with key-value pairs for localStorage |
| `sessionStorage` | Object with key-value pairs for sessionStorage |
| `token` | JWT/bearer token data |
| `form` | Username/password with optional selectors |
| `oauth` | OAuth tokens or provider configuration |
| `mixed` | Combination of multiple types |

## Troubleshooting

### Cookies Not Being Set

**SECURE_FLAG_REQUIRES_HTTPS**: Cookie has `secure: true` but URL is HTTP
- Solution: Use HTTPS URL or set `secure: false`

**SAMESITE_NONE_REQUIRES_SECURE**: `SameSite=None` requires `Secure=true`
- Solution: Set `secure: true` or use `sameSite: "lax"`

**DOMAIN_MISMATCH**: Cookie domain doesn't match target URL
- Solution: Use compatible domain or remove domain property

### Form Auto-Fill Not Working

1. Check if selectors match the actual form elements
2. Verify the form is visible (not hidden by CSS)
3. For SPAs, wait for the form to be rendered
4. Check console for strategy execution logs

### Token Injection Failing

1. Ensure the tab is fully loaded before injection
2. Check for CSP restrictions on the target site
3. Verify localStorage is accessible

### Permission Issues

If you see "Grant Access" on a tool:
1. Click "Grant" button
2. Approve the permission request
3. The tool will open automatically with login

## Security Considerations

- Extension only requests permissions for domains you explicitly grant
- Credentials are stored in Chrome's secure local storage
- Cookies are set with appropriate security flags
- Form passwords are never logged or stored beyond injection
- All communication with backend uses secure tokens

## Changelog

### 2.0.0
- Complete architecture rewrite with pluggable strategy engine
- Added content script for automatic login detection
- Added FormStrategy for auto-fill and submit
- Added OAuthStrategy foundation for SSO
- Added SPA support with route change detection
- Added one-click login from popup
- Added toast notifications for status feedback
- Improved error handling and diagnostics

### 1.1.0
- Fixed cookie injection to happen BEFORE tab opens
- Added tab reload after cookie injection
- Added cookie verification
- Added localStorage/sessionStorage support
- Added subdomain support

### 1.0.0
- Initial release
- Basic cookie injection
- Tool synchronization
- Permission management
