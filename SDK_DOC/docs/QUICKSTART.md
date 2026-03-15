# Quickstart

This guide gets you from install to first API call in about 3 minutes.

## Step 1 - Install

```bash
npm install @controlfile/sdk
```

## Step 2 - Create a client

```ts
import { ControlFileClient } from '@controlfile/sdk';

export const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      throw new Error('Missing token');
    }

    return token;
  },
});
```

## Step 3 - Authenticate

The SDK expects your `getAuthToken()` function to return a bearer token string.

```ts
const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => session.accessToken,
});
```

The SDK will send:

```http
Authorization: Bearer <token>
```

## Step 4 - Call the API

List files in the root folder:

```ts
const page = await client.files.list({
  parentId: null,
  pageSize: 25,
});

console.log(page.items);
```

## Simple workflow example

The current SDK is storage-centric. If your application models "companies" as app-owned folders or metadata records, a common workflow is:

1. create a client
2. resolve the company folder path
3. list company folders
4. upload a document into the selected company path

Example:

```ts
const appFiles = client.appFiles.forApp('controlfleet', 'user_123');

await appFiles.ensurePath(['companies', 'acme']);

const companies = await appFiles.listFiles({
  path: ['companies'],
});

const file = new File(['hello'], 'insurance.pdf', {
  type: 'application/pdf',
});

const upload = await appFiles.uploadFile({
  file,
  path: ['companies', 'acme', 'documents'],
});

console.log(companies.items);
console.log(upload.fileId);
```

If your backend exposes first-class company APIs outside this SDK, call those separately and use this SDK for document storage and sharing.
