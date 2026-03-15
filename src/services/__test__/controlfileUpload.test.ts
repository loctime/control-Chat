// Simple test file to verify ControlFile SDK integration
// This is for development/testing purposes only

import { uploadFile } from '../controlfileUpload';

// Test function to verify upload works
export async function testControlFileUpload() {
  try {
    // Create a test file
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    console.log('Testing ControlFile upload...');
    
    const result = await uploadFile(
      testFile,
      'test-workspace',
      'test-conversation',
      'test-message',
      (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      }
    );
    
    console.log('Upload successful:', result);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  (window as any).testControlFileUpload = testControlFileUpload;
}
