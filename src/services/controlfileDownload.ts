import controlFileClient from './controlfileClient';

export async function getDownloadUrl(fileId: string): Promise<string> {
  try {
    const downloadResponse = await controlFileClient.files.getDownloadUrl(fileId);
    // Handle both string and object response types
    return (downloadResponse as any).downloadUrl || downloadResponse;
  } catch (error) {
    throw new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function refreshDownloadUrl(fileId: string): Promise<string> {
  try {
    // For ControlFile, we can just call getDownloadUrl again
    return await getDownloadUrl(fileId);
  } catch (error) {
    throw new Error(`Failed to refresh download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function isControlFileId(storagePath: string): boolean {
  // ControlFile IDs are typically UUIDs or similar unique identifiers
  // Firebase Storage paths usually start with 'workspaces/'
  return !storagePath.startsWith('workspaces/') && storagePath.length > 10;
}
