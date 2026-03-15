import {
  User,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { ensureUserWorkspace } from "../infrastructure/firebase/workspace";

export const watchUser = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);
export const ensureUserProfile = async (user: User) => ensureUserWorkspace(user);

export const completeRedirectSignIn = async () => {
  const result = await getRedirectResult(auth);
  if (result?.user) await ensureUserProfile(result.user);
};

export const loginWithGoogle = async () => {
  googleProvider.setCustomParameters({ prompt: "select_account" });
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    await signInWithRedirect(auth, googleProvider);
  } else {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
};

export const registerWithEmail = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(result.user);
    return;
  } catch (error) {
    const firebaseError = error as { code?: string };
    if (firebaseError.code !== "auth/email-already-in-use") {
      throw error;
    }
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
};

export const logout = () => signOut(auth);
