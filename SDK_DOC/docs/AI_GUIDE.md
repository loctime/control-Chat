# AI Guide

## System purpose

ControlFile SDK is a standalone TypeScript client for the ControlFile backend.

Primary purpose:

1. authenticate requests with bearer tokens
2. manage files and folders
3. upload files through presigned URLs
4. create public share links
5. access user profile and settings
6. manage app-scoped file areas

## Root entrypoint

```ts
import { ControlFileClient } from '@controlfile/sdk';
```

Create client:

```ts
const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => token,
});
```

## SDK entrypoints

- `client.files`
- `client.folders`
- `client.shares`
- `client.users`
- `client.appFiles`
- `client.forApp(appId, userId)` compatibility alias

## Main entities

Direct SDK entities:

- `File`
- `Folder`
- `Share`
- `UserProfile`
- `TaskbarItem`

Conceptual integration entities:

- `Company`
- `Employee`
- `Vehicle`
- `Document`
- `ApprovedDocument`
- `RequiredDocument`
- `Backup`

Important:

- the SDK does not currently expose first-class methods such as `listCompanies()`
- company and vehicle style records are usually modeled by the integrating application
- documents are represented by SDK `File` objects

## Authentication rules

Use bearer tokens.

Expected header:

```http
Authorization: Bearer <token>
```

Rules:

1. provide `getAuthToken(): Promise<string>`
2. return the latest valid access token
3. refresh token before expiry when possible
4. public share reads do not require auth

## Error handling rules

SDK throws typed errors.

Primary classes:

- `AuthenticationError`
- `ForbiddenError`
- `NotFoundError`
- `ValidationError`
- `QuotaExceededError`
- `ServerError`
- `NetworkError`

Handling rules:

1. if `AuthenticationError`, refresh token or re-authenticate
2. if `NetworkError` or `ServerError`, retry with backoff
3. if `ValidationError`, fix request input
4. if `NotFoundError`, stop retrying unless resource is expected to appear later
5. if `QuotaExceededError`, stop upload and surface quota information

## Typical workflow

Storage-centric workflow:

1. create client
2. authenticate
3. initialize user if needed
4. create or resolve folder path
5. upload file
6. create share link
7. read or update user settings

Business workflow used by many integrations:

1. create company record in your app backend
2. create employees
3. define required documents
4. upload documents into app-scoped folders using this SDK
5. approve documents in your app backend
6. generate backups as files

## Common SDK workflows

### List files

```ts
await client.files.list({ parentId: null, pageSize: 20 });
```

### Upload file into known folder

```ts
await client.files.upload({
  file,
  name: file.name,
  parentId: 'folder_123',
});
```

### Upload file into app path

```ts
const appFiles = client.appFiles.forApp('controldoc', 'user_123');

await appFiles.uploadFile({
  file,
  path: ['documents', 'approved'],
});
```

### Create public share

```ts
await client.shares.create({
  fileId: 'file_123',
  expiresIn: 24,
});
```

### Read user profile

```ts
await client.users.getProfile();
```

## Public methods summary

`client.files`

- `list`
- `getDownloadUrl`
- `upload`
- `uploadFile`
- `replace`
- `rename`
- `delete`
- `permanentDelete`
- `emptyTrash`

`client.folders`

- `ensurePath`
- `create`
- `permanentDelete`

`client.shares`

- `create`
- `getInfo`
- `get`
- `getDownloadUrl`
- `download`
- `list`
- `revoke`
- `getImageUrl`
- `buildShareUrl`
- `buildImageUrl`

`client.users`

- `getProfile`
- `updateProfile`
- `initialize`
- `getSettings`
- `updateSettings`
- `getTaskbar`
- `updateTaskbar`

`client.appFiles.forApp(...)`

- `initialize`
- `setUserId`
- `listFiles`
- `ensurePath`
- `uploadFile`

## Decision rules for agents

1. prefer `client.appFiles.forApp()` for external app integrations that should stay scoped to an app root
2. use `client.files` and `client.folders` when working with legacy or global paths
3. use `client.shares` for public delivery workflows
4. do not invent company-level SDK methods that do not exist
5. if business entities exist, map them to folders, files, and your own backend metadata unless a dedicated API is available elsewhere
