import controlFileClient, { getAppFiles } from './controlfileClient';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  fileId: string;
  downloadUrl: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadFile(
  file: File,
  workspaceId: string,
  conversationId: string,
  messageId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const appFiles = getAppFiles('controlchat', workspaceId);
  
  // Build storage path following the proposed structure
  const path = ['workspaces', workspaceId, 'conversations', conversationId, 'attachments', messageId];
  
  try {
    // Upload file using ControlFile SDK with correct method signature
    const uploadResult = await appFiles.uploadFile({
      file,
      path,
      onProgress: (progress: number) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: Math.round(progress * file.size),
            totalBytes: file.size,
            percentage: Math.round(progress * 100)
          });
        }
      }
    });

    // Get download URL
    const downloadResponse = await controlFileClient.files.getDownloadUrl(uploadResult.fileId);

    return {
      fileId: uploadResult.fileId,
      downloadUrl: (downloadResponse as any).downloadUrl || downloadResponse, // Handle both string and object responses
      name: file.name,
      size: file.size,
      mimeType: file.type
    };
  } catch (error) {
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  try {
    await controlFileClient.files.delete(fileId);
  } catch (error) {
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getDownloadUrl(fileId: string): Promise<string> {
  try {
    const downloadResponse = await controlFileClient.files.getDownloadUrl(fileId);
    // Handle both string and object response types
    return (downloadResponse as any).downloadUrl || downloadResponse;
  } catch (error) {
    throw new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
