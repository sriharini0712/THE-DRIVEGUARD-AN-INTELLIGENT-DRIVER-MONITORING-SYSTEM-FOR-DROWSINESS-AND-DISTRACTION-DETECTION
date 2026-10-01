// Authentication service.
//
// By default this uses a simple local (browser-only) auth implementation so
// the app runs immediately with zero setup. Set VITE_AUTH_PROVIDER=firebase
// and fill in the VITE_FIREBASE_* variables in .env to switch to real
// Firebase Authentication with no other code changes required by the app.

export interface AppUser {
  uid: string;
  name: string;
  email: string;
}

const PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'local';

function isAppUser(value: unknown): value is AppUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppUser>;
  return typeof candidate.uid === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string';
}

// ---------------------------------------------------------------------------
// Local (browser-only) auth — passwords hashed with SubtleCrypto, never sent
// anywhere. Good enough for a student prototype; swap to Firebase for
// production use.
// ---------------------------------------------------------------------------

interface LocalUserRecord {
  uid: string;
  name: string;
  email: string;
  passwordHash: string;
}

const USERS_KEY = 'dms_local_users';
const SESSION_KEY = 'dms_local_session';

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((user): user is LocalUserRecord =>
      typeof user?.uid === 'string' &&
      typeof user?.name === 'string' &&
      typeof user?.email === 'string' &&
      typeof user?.passwordHash === 'string'
    );
  } catch {
    localStorage.removeItem(USERS_KEY);
    return [];
  }
}

function saveLocalUsers(users: LocalUserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function localRegister(name: string, email: string, password: string): Promise<AppUser> {
  const users = getLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const uid = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  users.push({ uid, name, email, passwordHash });
  saveLocalUsers(users);
  const user: AppUser = { uid, name, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

async function localLogin(email: string, password: string): Promise<AppUser> {
  const users = getLocalUsers();
  const record = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!record) throw new Error('No account found with this email.');
  const passwordHash = await hashPassword(password);
  if (passwordHash !== record.passwordHash) {
    throw new Error('Incorrect password.');
  }
  const user: AppUser = { uid: record.uid, name: record.name, email: record.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

function localLogout(): void {
  localStorage.removeItem(SESSION_KEY);
}

function localGetCurrentUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isAppUser(parsed)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firebase auth (optional) — only imported/initialized if selected, so the
// firebase package is not a hard requirement for running the local demo.
// ---------------------------------------------------------------------------

let firebaseAuthPromise: Promise<import('firebase/auth').Auth> | null = null;

async function getFirebaseAuth() {
  if (!firebaseAuthPromise) {
    firebaseAuthPromise = (async () => {
      const { getApp, getApps, initializeApp } = await import('firebase/app');
      const { getAuth } = await import('firebase/auth');
      const app = getApps().length > 0
        ? getApp()
        : initializeApp({
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
          });
      return getAuth(app);
    })();
  }
  return firebaseAuthPromise;
}

async function firebaseRegister(name: string, email: string, password: string): Promise<AppUser> {
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return { uid: cred.user.uid, name, email };
}

async function firebaseLogin(email: string, password: string): Promise<AppUser> {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return {
    uid: cred.user.uid,
    name: cred.user.displayName || 'Driver',
    email: cred.user.email || email
  };
}

// ---------------------------------------------------------------------------
// Public API — the rest of the app only talks to these functions.
// ---------------------------------------------------------------------------

export async function registerUser(name: string, email: string, password: string): Promise<AppUser> {
  if (PROVIDER === 'firebase') return firebaseRegister(name, email, password);
  return localRegister(name, email, password);
}

export async function loginUser(email: string, password: string): Promise<AppUser> {
  if (PROVIDER === 'firebase') return firebaseLogin(email, password);
  return localLogin(email, password);
}

export function logoutUser(): void {
  localLogout();
  if (PROVIDER === 'firebase') {
    void getFirebaseAuth().then(async (auth) => {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }).catch(() => undefined);
  }
}

export function getCurrentUser(): AppUser | null {
  if (PROVIDER === 'firebase') return null;
  return localGetCurrentUser();
}

export function subscribeToAuthState(onChange: (user: AppUser | null) => void): () => void {
  if (PROVIDER !== 'firebase') {
    onChange(localGetCurrentUser());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) onChange(localGetCurrentUser());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }

  let unsubscribe: () => void = () => undefined;
  void getFirebaseAuth().then(async (auth) => {
    const { onAuthStateChanged } = await import('firebase/auth');
    unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      onChange(firebaseUser ? {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'Driver',
        email: firebaseUser.email || ''
      } : null);
    });
  }).catch(() => onChange(null));
  return () => unsubscribe();
}
