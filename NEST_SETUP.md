# Google Nest Device Access Setup Guide

This guide will walk you through setting up the Nest wrapper to work with Google's Device Access Program.

## Overview

The Nest wrapper uses Google's Smart Device Management (SDM) API to interact with Nest devices. To use this wrapper, you'll need to:

1. Register for Google's Device Access Program
2. Set up a Google Cloud Project
3. Create OAuth 2.0 credentials
4. Create a Device Access Project
5. Obtain an access token
6. Configure environment variables

## Prerequisites

- A Google Account (Gmail account)
- A supported Nest device (Thermostat, Camera, Doorbell, Nest Hub Max, etc.)
- Your Nest device must be set up and linked to your Google Account via the Google Home app
- $5 one-time registration fee for the Device Access Program

## Step-by-Step Setup

### Step 1: Register for Device Access Program

1. Visit the [Device Access Console](https://developers.google.com/nest/device-access/get-started)
2. Sign in with your Google Account
3. Accept the Terms of Service
4. Pay the one-time, non-refundable registration fee of $5

### Step 2: Set Up Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Smart Device Management API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Smart Device Management API"
   - Click "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. In your Google Cloud Project, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required fields (App name, User support email, etc.)
   - Add your email to test users
   - Save and continue through the scopes and summary
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: Choose a descriptive name (e.g., "Nest Home Automation")
   - Authorized redirect URIs: Add `https://www.google.com`
   - Click "Create"
5. **Save the Client ID and Client Secret** - you'll need these later

### Step 4: Create Device Access Project

1. Return to the [Device Access Console](https://developers.google.com/nest/device-access)
2. Click "Create Project"
3. Fill in the project details:
   - Project name: Choose a name
   - OAuth Client ID: Paste the Client ID from Step 3
   - (Optional) Enable events via Google Cloud Pub/Sub if you want real-time updates
4. Click "Create Project"
5. **Save the Project ID** - this is different from your Google Cloud Project ID and is required for API calls

### Step 5: Authorize Your Account

You need to generate an authorization URL and complete the OAuth flow to get an access token.

#### Option A: Using the Device Access Console (Easier)

1. In the Device Access Console, go to your project
2. Click "Get Authorization Code"
3. You'll be redirected to Google's authorization page
4. Sign in and grant permissions
5. You'll be redirected back with an authorization code in the URL
6. Copy the authorization code from the URL

#### Option B: Manual Authorization URL

Construct the authorization URL manually:

```
https://nestservices.google/partnerconnections/{PROJECT_ID}/auth?redirect_uri=https://www.google.com&access_type=offline&prompt=consent&client_id={CLIENT_ID}&response_type=code&scope=https://www.googleapis.com/auth/sdm.service
```

Replace:
- `{PROJECT_ID}` with your Device Access Project ID
- `{CLIENT_ID}` with your OAuth Client ID

Visit this URL in your browser, authorize the app, and copy the authorization code from the redirect URL.

### Step 6: Exchange Authorization Code for Tokens

You'll need to exchange the authorization code for an access token and refresh token. You can do this using curl or any HTTP client:

```bash
curl -X POST https://www.googleapis.com/oauth2/v4/token \
  -d "code={AUTHORIZATION_CODE}" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "redirect_uri=https://www.google.com" \
  -d "grant_type=authorization_code"
```

Replace:
- `{AUTHORIZATION_CODE}` with the code from Step 5
- `{CLIENT_ID}` with your OAuth Client ID
- `{CLIENT_SECRET}` with your OAuth Client Secret

The response will contain:
```json
{
  "access_token": "ya29...",
  "expires_in": 3600,
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/sdm.service",
  "token_type": "Bearer"
}
```

**Important**: Save both the `access_token` and `refresh_token`. The access token expires in 1 hour, but you can use the refresh token to get new access tokens.

### Step 7: Refresh Access Token (When Needed)

Access tokens expire after 1 hour. Use the refresh token to get a new access token:

```bash
curl -X POST https://www.googleapis.com/oauth2/v4/token \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "refresh_token={REFRESH_TOKEN}" \
  -d "grant_type=refresh_token"
```

The response will contain a new `access_token`.

### Step 8: Configure Environment Variables

Add the following environment variables to your `.env` file or export them:

```bash
export NEST_PROJECT_ID="your-device-access-project-id"
export NEST_ACCESS_TOKEN="your-access-token"
export NEST_REFRESH_TOKEN="your-refresh-token"  # Optional, for token refresh
export NEST_CLIENT_ID="your-oauth-client-id"    # Optional, for token refresh
export NEST_CLIENT_SECRET="your-oauth-client-secret"  # Optional, for token refresh
```

### Step 9: Update Environment Configuration

Update `src/config/env.ts` to include Nest credentials:

```typescript
const NEST_PROJECT_ID = process.env.nest_project_id || '';
const NEST_ACCESS_TOKEN = process.env.nest_access_token || '';
const NEST_REFRESH_TOKEN = process.env.nest_refresh_token || '';
const NEST_CLIENT_ID = process.env.nest_client_id || '';
const NEST_CLIENT_SECRET = process.env.nest_client_secret || '';

export {
  // ... existing exports
  NEST_PROJECT_ID,
  NEST_ACCESS_TOKEN,
  NEST_REFRESH_TOKEN,
  NEST_CLIENT_ID,
  NEST_CLIENT_SECRET,
};
```

### Step 10: Use the Nest Wrapper

In your application code (e.g., `src/app.ts`), initialize the Nest wrapper:

```typescript
import { NestWrapper } from './model/nestWrapper';
import { NEST_PROJECT_ID, NEST_ACCESS_TOKEN } from './config/env';

const deviceCache = new DeviceCacheService();
const nest = new NestWrapper(NEST_PROJECT_ID, NEST_ACCESS_TOKEN, deviceCache);
const triggers = new TriggerService(deviceCache, [nest]);
```

## Token Refresh Implementation

Since access tokens expire after 1 hour, you may want to implement automatic token refresh. Here's a simple example:

```typescript
async function refreshNestToken(): Promise<string> {
  const response = await axios.post('https://www.googleapis.com/oauth2/v4/token', {
    client_id: NEST_CLIENT_ID,
    client_secret: NEST_CLIENT_SECRET,
    refresh_token: NEST_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  
  return response.data.access_token;
}

// Refresh token every 50 minutes (before 1 hour expiration)
setInterval(async () => {
  const newToken = await refreshNestToken();
  // Update your NestWrapper instance with the new token
  nest.accessToken = newToken;
  nest.api.defaults.headers.Authorization = `Bearer ${newToken}`;
}, 50 * 60 * 1000);
```

## Supported Devices and Actions

### Thermostats
- **Actions**: `setTemperature`, `setMode`, `turnOn`, `turnOff`
- **Modes**: `HEAT`, `COOL`, `HEATCOOL`, `OFF`, `ECO`
- **Status**: Current mode (e.g., "HEAT", "COOL", "OFF")

### Cameras
- **Status**: Motion detection status ("motion" or "idle")
- **Note**: Camera control actions are not yet implemented

### Doorbells
- **Actions**: `setVolume`
- **Status**: Motion detection status ("motion" or "idle")

## Troubleshooting

### "Invalid credentials" error
- Verify your access token hasn't expired (they expire after 1 hour)
- Check that your Project ID matches your Device Access Project ID (not Google Cloud Project ID)
- Ensure your OAuth Client ID and Secret are correct

### "Permission denied" error
- Make sure you've authorized your Google Account in the Device Access Console
- Verify your Nest device is linked to the same Google Account
- Check that the SDM API is enabled in your Google Cloud Project

### "Device not found" error
- Ensure your Nest device is set up in the Google Home app
- Verify the device is linked to the same Google Account used for authorization
- Check that the device type is supported by the SDM API

### Access token expired
- Implement token refresh using the refresh token
- See "Token Refresh Implementation" section above

## Additional Resources

- [Google Nest Device Access Documentation](https://developers.google.com/nest/device-access)
- [SDM API Reference](https://developers.google.com/nest/device-access/api)
- [OAuth 2.0 Guide](https://developers.google.com/nest/device-access/authorize)
- [Device Traits Reference](https://developers.google.com/nest/device-access/api/traits)

## Security Notes

- **Never commit** your access tokens, refresh tokens, or client secrets to version control
- Store credentials in environment variables or a secure secrets manager
- Access tokens expire after 1 hour - implement automatic refresh
- Refresh tokens can be revoked - you may need to re-authorize if this happens
- Treat refresh tokens with the same security as passwords

## Example: Complete Setup Script

Here's a Node.js script to help with token refresh:

```javascript
const axios = require('axios');

async function getNestTokens(authCode, clientId, clientSecret) {
  const response = await axios.post('https://www.googleapis.com/oauth2/v4/token', {
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: 'https://www.google.com',
    grant_type: 'authorization_code',
  });
  
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
  };
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const response = await axios.post('https://www.googleapis.com/oauth2/v4/token', {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  
  return response.data.access_token;
}

// Usage
// const tokens = await getNestTokens(authCode, clientId, clientSecret);
// const newToken = await refreshAccessToken(tokens.refreshToken, clientId, clientSecret);
```

