import {
  User,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { appPath } from "./paths";

export const watchUser = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);

export const ensureUserProfile = async (user: User) => {
  const userRef = doc(db, ...appPath, "users", user.uid);
  const existing = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email ?? null,
      name: user.displayName ?? "Usuario",
      avatar: user.photoURL ?? null,
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt ?? serverTimestamp() : serverTimestamp()
    },
    { merge: true }
  );
};

export const completeRedirectSignIn = async () => {
  const result = await getRedirectResult(auth);
  if (result?.user) await ensureUserProfile(result.user);
};

export const loginWithGoogle = async () => {
  googleProvider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
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
