# ControlFile SDK

ControlFile SDK is the standalone JavaScript and TypeScript client for the ControlFile backend API.

It solves these integration problems:

- authenticates requests with bearer tokens
- normalizes HTTP errors into typed SDK errors
- uploads files through presigned URLs
- exposes a stable client API for files, folders, shares, users, and app-scoped file spaces
- works in browser and Node.js runtimes without frontend framework coupling

## Public API

Root export:

```ts
import { ControlFileClient } from '@controlfile/sdk';
```

Client modules:

- `client.files`
- `client.folders`
- `client.shares`
- `client.users`
- `client.appFiles`

Compatibility alias:

- `client.forApp(appId, userId)` -> same as `client.appFiles.forApp(appId, userId)`

## Supported environments

| Environment | Status | Notes |
| --- | --- | --- |
| Node.js 18+ | Supported | Uses built-in `fetch`, `Blob`, `FormData` |
| Vite | Supported | Works in browser builds |
| Next.js | Supported | Use in client or server code with a valid token provider |
| Serverless environments | Supported | Suitable for Node 18+ runtimes and modern edge-compatible fetch runtimes |
| Browser SPA | Supported | Upload progress available through XHR path |

## Installation

```bash
npm install @controlfile/sdk
```

## Minimal example

```ts
import { ControlFileClient } from '@controlfile/sdk';

const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      throw new Error('Missing token');
    }

    return token;
  },
});

const result = await client.files.list({ parentId: null, pageSize: 20 });

console.log(result.items);
```

## What the SDK covers

- file listing, upload, replace, rename, delete, trash operations
- folder creation and path resolution
- public share link creation and download access
- user profile, settings, and taskbar operations
- app-scoped file operations through `client.appFiles.forApp()`

## What the SDK does not do

- user login UI
- token issuance
- React, Next.js, or Firestore state management
- application-specific business entities such as `Company` or `Vehicle` as first-class SDK modules

Those business entities can still be modeled by external apps on top of ControlFile storage and metadata. See [ENTITIES.md](./ENTITIES.md).
