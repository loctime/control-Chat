# Errors

## Error model

The SDK throws typed errors that extend `ControlFileError`.

Base shape:

```ts
{
  name: string,
  message: string,
  code?: string,
  statusCode?: number,
  originalError?: unknown
}
```

For API-oriented handling, you can normalize this into:

```json
{
  "code": "NOT_FOUND",
  "message": "Resource not found",
  "details": {
    "statusCode": 404
  }
}
```

## Error classes

| Class | Typical status | Meaning |
| --- | --- | --- |
| `AuthenticationError` | 401 | missing or invalid authentication |
| `ForbiddenError` | 403 | insufficient permissions |
| `NotFoundError` | 404 | resource does not exist |
| `ValidationError` | 400 | invalid input |
| `QuotaExceededError` | 413 | storage quota exceeded |
| `ServerError` | 500, 502, 503, 504 | backend failure |
| `NetworkError` | none | connectivity, timeout, transport failure |
| `ControlFileError` | varies | generic SDK-wrapped error |

## Common error codes

| Code | Status | Meaning | Typical handling |
| --- | --- | --- | --- |
| `AUTH_ERROR` | 401 | token missing or invalid | refresh token or redirect to login |
| `FORBIDDEN` | 403 | operation not allowed | show permission error |
| `NOT_FOUND` | 404 | target file, folder, share, or user not found | show not found state |
| `VALIDATION_ERROR` | 400 | invalid request data | correct request payload |
| `QUOTA_EXCEEDED` | 413 | upload exceeds available quota | stop upload and inform user |
| `SERVER_ERROR` | 500+ | backend failed | retry or escalate |
| `NETWORK_ERROR` | none | timeout or network issue | retry with backoff |

## Examples

### Catch by class

```ts
import {
  AuthenticationError,
  NotFoundError,
  NetworkError,
} from '@controlfile/sdk';

try {
  await client.files.delete('file_123');
} catch (error) {
  if (error instanceof AuthenticationError) {
    await auth.refresh();
  } else if (error instanceof NotFoundError) {
    console.error('File not found');
  } else if (error instanceof NetworkError) {
    console.error('Retry later');
  }
}
```

### Normalize for logs

```ts
function toLogObject(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as Error & {
      code?: string;
      statusCode?: number;
      originalError?: unknown;
    };

    return {
      code: anyError.code ?? 'UNKNOWN',
      message: anyError.message,
      details: {
        statusCode: anyError.statusCode,
        originalError: anyError.originalError,
      },
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Non-error thrown',
    details: error,
  };
}
```

## Retry guidance

Retry-safe cases:

- `NetworkError`
- `ServerError`
- transient 5xx responses

Do not auto-retry:

- `ValidationError`
- `ForbiddenError`
- `NotFoundError`

Conditional retry:

- `AuthenticationError` after token refresh
