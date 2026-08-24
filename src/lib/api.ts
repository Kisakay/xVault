import type { ExportedVault, User, VaultData } from './types';

export interface AuthStatus {
  authenticated: boolean;
  loginId?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  loginId?: string;
  error?: string;
  attemptsLeft?: number;
}

export interface ApiError extends Error {
  status?: number;
  attemptsLeft?: number;
  lockoutTime?: number;
}

let apiBase: string | null = null;

const getBase = async (): Promise<string> => {
  if (apiBase) {
    return apiBase;
  }

  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const config = (await response.json()) as { SERVER_URL?: string };
      const serverUrl = config.SERVER_URL?.replace(/\/+$/, '');
      if (serverUrl) {
        apiBase = `${serverUrl}/api`;
        return apiBase;
      }
    }
  } catch (error) {
    console.error('Failed to load config.json:', error);
  }

  apiBase = `${window.location.origin}/api`;
  return apiBase;
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const base = await getBase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Corps non JSON (ex. réponse vide).
  }

  if (!response.ok) {
    const error = new Error(
      (data?.error as string) ?? `Request failed (${response.status})`,
    ) as ApiError;
    error.status = response.status;
    error.attemptsLeft = data?.attemptsLeft as number | undefined;
    error.lockoutTime = data?.lockoutTime as number | undefined;
    throw error;
  }

  return data as T;
};

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const registerUser = async (
  password: string,
): Promise<AuthResult> => {
  try {
    const data = await post<{ success: boolean; loginId?: string; error?: string }>(
      '/auth/register',
      { password },
    );
    if (!data.success || !data.loginId) {
      return { success: false, error: data.error ?? 'Failed to register' };
    }
    return { success: true, loginId: data.loginId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const loginUser = async (
  loginId: string,
  password: string,
): Promise<AuthResult> => {
  try {
    const data = await post<{ success: boolean; user?: User; error?: string }>(
      '/auth/login',
      { loginId, password },
    );
    if (!data.success || !data.user) {
      return { success: false, error: data.error ?? 'Failed to login' };
    }
    return { success: true, user: data.user };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      attemptsLeft: (error as ApiError).attemptsLeft,
    };
  }
};

export const logoutUser = async (): Promise<void> => {
  await post('/auth/logout');
};

export const checkAuthStatus = async (): Promise<AuthStatus> => {
  try {
    return await request<AuthStatus>('/auth/status');
  } catch {
    return { authenticated: false };
  }
};

export const getUserProfile = async (): Promise<{ user?: User; error?: string }> => {
  try {
    const data = await request<{ success: boolean; user: User; error?: string }>(
      '/user/profile',
    );
    return { user: data.user };
  } catch (error) {
    return { error: (error as Error).message };
  }
};

export const updateUserProfile = async (updates: {
  name?: string;
  logo?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    await request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await post('/user/change-password', { currentPassword, newPassword });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const deleteAccount = async (
  password: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await post('/user/delete-account', { password });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const loadVaultData = async (password: string): Promise<VaultData> => {
  const data = await post<VaultData>('/vault/data', { password });
  return {
    entries: data.entries ?? [],
    folders: data.folders ?? [],
  };
};

export const saveVaultData = async (
  data: VaultData,
  password: string,
): Promise<void> => {
  await post('/vault/save', { data, password });
};

export const exportVault = async (password: string): Promise<ExportedVault> =>
  post<ExportedVault>('/vault/export', { password });

export const importVault = async (
  importData: ExportedVault,
  password: string,
): Promise<void> => {
  await post('/vault/import', { importData, password });
};
