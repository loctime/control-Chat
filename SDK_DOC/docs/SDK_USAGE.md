# SDK Usage

## Client creation

### `new ControlFileClient(config)`

Description:
Creates the SDK client.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | yes | ControlFile backend base URL |
| `getAuthToken` | `() => Promise<string>` | yes | async bearer token provider |
| `options.timeout` | `number` | no | request timeout in milliseconds |
| `options.retries` | `number` | no | retry count for retryable failures |

Returns:

- `ControlFileClient`

Example:

```ts
const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => auth.accessToken,
  options: {
    timeout: 30000,
    retries: 3,
  },
});
```

## App namespace

### `client.appFiles.forApp(appId, userId?)`

Description:
Creates an app-scoped file module.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `appId` | `string` | yes | application identifier |
| `userId` | `string` | no | authenticated user identifier |

Returns:

- `AppFilesModule`

Example:

```ts
const appFiles = client.appFiles.forApp('controldoc', 'user_123');
```

### `client.forApp(appId, userId?)`

Description:
Compatibility alias for `client.appFiles.forApp()`.

Returns:

- `AppFilesModule`

## Files module

### `client.files.list(params?)`

Description:
Lists files and folders under a parent.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `parentId` | `string \| null` | no | parent folder id |
| `pageSize` | `number` | no | max items per page |
| `cursor` | `string` | no | pagination cursor |

Returns:

- `Promise<ListFilesResponse>`

Example:

```ts
const page = await client.files.list({
  parentId: null,
  pageSize: 50,
});
```

### `client.files.getDownloadUrl(fileId)`

Description:
Creates a temporary download URL for a file.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `fileId` | `string` | yes | file identifier |

Returns:

- `Promise<GetDownloadUrlResponse>`

Example:

```ts
const download = await client.files.getDownloadUrl('file_123');
```

### `client.files.upload(params)`

Description:
Uploads a file directly to a known parent folder.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | `File \| Blob` | yes | binary payload |
| `name` | `string` | yes | file name |
| `parentId` | `string \| null` | yes | target folder id |
| `onProgress` | `(progress: number) => void` | no | upload progress callback |

Returns:

- `Promise<UploadResponse>`

Example:

```ts
const result = await client.files.upload({
  file,
  name: file.name,
  parentId: 'folder_123',
});
```

### `client.files.uploadFile(params)`

Description:
Ensures a folder path exists and uploads the file into it.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | `File \| Blob` | yes | binary payload |
| `path` | `string[]` | yes | folder path |
| `userId` | `string` | yes | user identifier |
| `onProgress` | `(progress: number) => void` | no | upload progress callback |

Returns:

- `Promise<FileResponse>`

Example:

```ts
await client.files.uploadFile({
  file,
  path: ['companies', 'acme', 'documents'],
  userId: 'user_123',
});
```

### `client.files.replace(fileId, file)`

Description:
Replaces the content of an existing file.

Returns:

- `Promise<ReplaceFileResponse>`

### `client.files.rename(fileId, newName)`

Description:
Renames a file.

Returns:

- `Promise<void>`

### `client.files.delete(fileId)`

Description:
Soft deletes a file.

Returns:

- `Promise<void>`

### `client.files.permanentDelete(fileId)`

Description:
Permanently deletes a file.

Returns:

- `Promise<void>`

### `client.files.emptyTrash(fileIds)`

Description:
Permanently deletes multiple trashed files.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `fileIds` | `string[]` | yes | trashed file ids |

Returns:

- `Promise<EmptyTrashResponse>`

## Folders module

### `client.folders.ensurePath(params)`

Description:
Ensures a folder path exists by creating missing segments.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string[]` | yes | folder path |
| `userId` | `string` | yes | user identifier |

Returns:

- `Promise<string>`

Example:

```ts
const folderId = await client.folders.ensurePath({
  path: ['companies', 'acme'],
  userId: 'user_123',
});
```

### `client.folders.create(params)`

Description:
Creates a folder with explicit folder options.

Returns:

- `Promise<CreateFolderResponse>`

### `client.folders.permanentDelete(folderId)`

Description:
Permanently deletes a folder.

Returns:

- `Promise<void>`

## Shares module

### `client.shares.create(params)`

Description:
Creates a public share link for a file.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `fileId` | `string` | yes | file identifier |
| `expiresIn` | `number` | no | expiration in hours |

Returns:

- `Promise<CreateShareResponse>`

### `client.shares.getInfo(token)`

Description:
Reads public share metadata.

Returns:

- `Promise<ShareInfo>`

### `client.shares.get(token)`

Description:
Alias for `getInfo(token)`.

Returns:

- `Promise<ShareInfo>`

### `client.shares.getDownloadUrl(token)`

Description:
Gets a temporary download URL for a public share.

Returns:

- `Promise<ShareDownloadResponse>`

### `client.shares.download(token)`

Description:
Alias for `getDownloadUrl(token)`.

Returns:

- `Promise<ShareDownloadResponse>`

### `client.shares.list()`

Description:
Lists share links for the authenticated user.

Returns:

- `Promise<Share[]>`

### `client.shares.revoke(token)`

Description:
Revokes a share link.

Returns:

- `Promise<void>`

### `client.shares.getImageUrl(token, baseUrl?)`

Description:
Builds a public image URL for a shared file.

Returns:

- `string`

### `client.shares.buildShareUrl(token)`

Description:
Builds the public share page URL.

Returns:

- `string`

### `client.shares.buildImageUrl(token)`

Description:
Builds the public image endpoint URL.

Returns:

- `string`

## Users module

### `client.users.getProfile()`

Description:
Returns the authenticated user's profile.

Returns:

- `Promise<UserProfileResponse>`

### `client.users.updateProfile(body)`

Description:
Updates editable profile fields.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `body` | `UpdateUserProfileInput` | yes | profile update payload |

Returns:

- `Promise<UpdateUserProfileResponse>`

### `client.users.initialize()`

Description:
Ensures the authenticated user exists in the backend.

Returns:

- `Promise<InitializeUserResponse>`

### `client.users.getSettings()`

Description:
Gets user settings.

Returns:

- `Promise<UserSettingsResponse>`

### `client.users.updateSettings(input)`

Description:
Updates user settings.

Returns:

- `Promise<SuccessResponse>`

### `client.users.getTaskbar()`

Description:
Gets saved taskbar items.

Returns:

- `Promise<{ items: TaskbarItem[] }>`

### `client.users.updateTaskbar(items)`

Description:
Replaces saved taskbar items.

Returns:

- `Promise<UpdateTaskbarResponse>`

## AppFilesModule

### `appFiles.initialize()`

Description:
Initializes the app root.

Returns:

- `Promise<void>`

### `appFiles.setUserId(userId)`

Description:
Sets the user id after construction.

Returns:

- `void`

### `appFiles.listFiles(params?)`

Description:
Lists files relative to the app root.

Returns:

- `Promise<ListFilesResponse>`

Example:

```ts
const appFiles = client.appFiles.forApp('controldoc', 'user_123');
const docs = await appFiles.listFiles({ path: ['documents'] });
```

### `appFiles.ensurePath(pathOrParams)`

Description:
Ensures a relative path exists below the app root.

Returns:

- `Promise<string>`

### `appFiles.uploadFile(params)`

Description:
Uploads a file relative to the app root.

Returns:

- `Promise<UploadResponse>`

Example:

```ts
await appFiles.uploadFile({
  file,
  path: ['documents', 'approved'],
});
```
