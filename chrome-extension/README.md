# ToolStack Chrome Extension

Access your assigned tools with automatic credential sync and cookie injection.

## Version 1.1.0

### Features

- **Automatic Cookie Injection**: Cookies are injected BEFORE opening the tool tab, then reloaded for proper session initialization
- **Subdomain Support**: Handles cookies for both exact domains and subdomain wildcards (`.example.com`)
- **Secure Cookie Handling**: Properly handles `Secure`, `SameSite`, and `HttpOnly` attributes
- **localStorage/sessionStorage Support**: Can inject storage-based credentials
- **Token Injection**: Supports bearer token authentication
- **Verification**: Reads back cookies after setting to verify success
- **Detailed Error Messages**: Shows exact failure reasons (domain mismatch, secure flag, etc.)

## Installation

### Method 1: Manual Installation (Development)

1. Download or clone this extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder

### Method 2: From ZIP

1. Download the `chrome-extension.zip` file
2. Extract to a folder
3. Follow steps 2-5 from Method 1

## Usage

### Initial Setup

1. Click the extension icon in Chrome toolbar
2. Click "Configure API" and enter your ToolStack API URL
3. Login with your ToolStack credentials

### Opening Tools

1. Click on any tool in the list
2. If prompted, grant permission for that domain
3. The extension will:
   - Fetch credentials from ToolStack API
   - Inject cookies BEFORE opening the tab
   - Open the tool website
   - Reload the page to ensure cookies are applied
   - Verify cookies were set correctly

### Credential Types

The extension supports multiple credential types:

#### 1. Cookies (Most Common)
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

**Cookie Properties:**
- `name` (required): Cookie name
- `value` (required): Cookie value
- `domain` (optional): Cookie domain (defaults to tool domain)
  - Use `.example.com` for subdomain cookies
  - Use `example.com` for exact domain
- `path` (optional): Cookie path (defaults to `/`)
- `secure` (optional): HTTPS only (defaults to `true`)
- `httpOnly` (optional): Not accessible via JavaScript (defaults to `false`)
- `sameSite` (optional): `strict`, `lax`, or `none` (defaults to `lax`)
  - Note: `SameSite=None` requires `Secure=true`
- `expirationDate` (optional): Unix timestamp (defaults to 30 days from now)

#### 2. localStorage/sessionStorage
```json
{
  "type": "localStorage",
  "data": {
    "auth_token": "eyJhbGc...",
    "user_id": "12345"
  }
}
```

If automatic injection fails, the extension will show manual instructions.

#### 3. Bearer Token
```json
{
  "type": "token",
  "data": {
    "value": "eyJhbGc...",
    "header": "Authorization",
    "prefix": "Bearer "
  }
}
```

## Troubleshooting

### Cookies Not Being Set

**Error: SECURE_FLAG_REQUIRES_HTTPS**
- The cookie has `secure: true` but the target URL is HTTP
- Solution: Use HTTPS URL or set `secure: false`

**Error: SAMESITE_NONE_REQUIRES_SECURE**
- `SameSite=None` cookies must have `Secure=true`
- Solution: Either set `secure: true` or use `sameSite: "lax"`

**Error: DOMAIN_MISMATCH**
- Cookie domain doesn't match the target URL
- Solution: Use a compatible domain or remove the domain property

### Still Not Logged In After Cookie Injection

1. **Check the console**: Open DevTools (F12) and check for errors
2. **Verify cookies**: Go to Application tab > Cookies in DevTools
3. **Check domain matching**: Ensure cookie domains match the site
4. **Try subdomain format**: Use `.example.com` instead of `example.com`
5. **Check for additional requirements**:
   - Some sites need localStorage tokens in addition to cookies
   - Some sites verify additional headers or fingerprints

### Permission Issues

If you see "Grant Access" on a tool:
1. Click "Grant" button
2. Approve the permission request
3. The tool will open automatically

## Technical Details

### Cookie Injection Flow

1. **Pre-injection**: Cookies are set via `chrome.cookies.set()` BEFORE opening the tab
2. **Tab Open**: New tab is created with the tool URL
3. **Wait for Load**: Extension waits for tab to finish loading
4. **Reload**: Tab is reloaded to ensure cookies are sent with initial requests
5. **Verification**: Cookies are read back to confirm they were set

### Subdomain Handling

- Cookies with domain `.example.com` will be sent to:
  - `example.com`
  - `www.example.com`
  - `api.example.com`
  - Any other subdomain

- Cookies with domain `example.com` (no dot) will only be sent to:
  - `example.com`

### Security Considerations

- Extension only requests permissions for domains you explicitly grant
- Credentials are stored in Chrome's secure local storage
- Cookies are set with appropriate security flags
- The extension never sends credentials to third parties

## API Reference

### Extension API Endpoints

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
```

## Changelog

### 1.1.0
- Fixed cookie injection to happen BEFORE tab opens
- Added tab reload after cookie injection for proper session initialization
- Added cookie verification to confirm successful injection
- Added detailed error messages for failed cookies
- Added subdomain support with proper domain handling
- Added localStorage/sessionStorage credential support
- Added proper Secure and SameSite attribute handling
- Improved error diagnostics

### 1.0.0
- Initial release
- Basic cookie injection
- Tool synchronization
- Permission management
