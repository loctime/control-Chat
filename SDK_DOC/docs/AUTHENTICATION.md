# Authentication

## Overview

ControlFile SDK uses bearer token authentication.

The SDK does not log users in. It only asks your application for a token through `getAuthToken()`.

## Header format

Expected request header:

```http
Authorization: Bearer <token>
```

Additional SDK headers:

```http
X-SDK-Client: @controlfile/sdk
X-SDK-Version: <package-version>
x-request-id: <generated-request-id>
```

## How tokens are passed to the SDK

Provide a function when creating the client:

```ts
import { ControlFileClient } from '@controlfile/sdk';

const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => {
    return authStore.accessToken;
  },
});
```

The SDK calls `getAuthToken()` before authenticated requests.

## Public vs authenticated endpoints

Authenticated methods:

- `client.files.*`
- `client.folders.*`
- `client.users.*`
- `client.shares.create()`
- `client.shares.list()`
- `client.shares.revoke()`
- `client.appFiles.forApp(...).*`

Public share methods:

- `client.shares.getInfo(token)`
- `client.shares.getDownloadUrl(token)`
- `client.shares.download(token)`
- `client.shares.getImageUrl(token)`

These public share methods do not require a bearer token.

## Token refresh strategy

Recommended pattern:

1. store the current access token in your auth layer
2. refresh it before expiration
3. have `getAuthToken()` always return the latest valid token

Example:

```ts
const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => {
    if (auth.isExpiringSoon()) {
      await auth.refresh();
    }

    return auth.getAccessToken();
  },
});
```

## Failure behavior

If `getAuthToken()` throws, the SDK throws `AuthenticationError`.

Typical causes:

- missing session
- expired refresh token
- auth provider failure

Example handling:

```ts
try {
  await client.files.list();
} catch (error) {
  if (error instanceof AuthenticationError) {
    await redirectToLogin();
  }
}
```
