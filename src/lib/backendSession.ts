const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
const STORAGE_KEY = "face-finder-auth";

export type BackendUser = {
  id: string;
  email: string;
  created_at: string;
};

export type BackendAuthState = {
  token: string;
  user: BackendUser;
};

type AuthResponse = {
  token: string;
  user: BackendUser;
};

type AuthRequest = {
  email: string;
  password: string;
};

function readStoredAuth(): BackendAuthState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BackendAuthState;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeAuth(auth: BackendAuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function getStoredAuth(): BackendAuthState | null {
  return readStoredAuth();
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

async function requestAuth(path: "/auth/login" | "/auth/register", body: AuthRequest): Promise<BackendAuthState> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<AuthResponse> & { detail?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Authentication failed");
  }

  if (!data.token || !data.user) {
    throw new Error("Authentication response was incomplete");
  }

  const auth = { token: data.token, user: data.user };
  storeAuth(auth);
  return auth;
}

export async function login(email: string, password: string) {
  return requestAuth("/auth/login", { email, password });
}

export async function register(email: string, password: string) {
  return requestAuth("/auth/register", { email, password });
}

export async function me(token: string): Promise<BackendUser> {
  const response = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => ({}))) as Partial<BackendUser> & { detail?: string };
  if (!response.ok) {
    throw new Error(data.detail || "Unable to load current user");
  }
  if (!data.id || !data.email || !data.created_at) {
    throw new Error("Invalid user response");
  }
  return data;
}

export function authHeaders() {
  const auth = readStoredAuth();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

export function syncAuth(auth: BackendAuthState | null) {
  if (auth) storeAuth(auth);
  else clearStoredAuth();
}

export function backendUrl() {
  return BACKEND_URL;
}
