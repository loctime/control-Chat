import { ControlFileClient } from '@loctime/controlfile-sdk';
import { getAuth } from 'firebase/auth';
import { auth } from '../lib/firebase';

const controlFileClient = new ControlFileClient({
  baseUrl: import.meta.env.VITE_CONTROLFILE_API_URL || 'https://api.controlfile.dev',
  getAuthToken: async () => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }
});

export default controlFileClient;

export function getAppFiles(appId: string, userId?: string) {
  return controlFileClient.appFiles.forApp(appId, userId);
}

export { controlFileClient };
