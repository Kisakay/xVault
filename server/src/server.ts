import { Elysia } from "elysia";
import { join, normalize } from "node:path";

import {
  authenticateUser,
  changeUserPassword,
  createUser,
  deleteUserAccount,
  getDb,
  getUserProfile,
  getVaultData,
  saveVaultData,
  updateUserProfile,
  type VaultData,
} from "./db";

interface ServerConfig {
  SERVER_HOST: string;
  SERVER_PORT: number;
  SERVER_URL: string;
}

interface FailedLoginState {
  count: number;
  lastAttempt: number;
  MAX_ATTEMPTS: number;
  RESET_TIME: number;
}

interface SessionData {
  userId: number;
  loginId: string;
  expiresAt: number;
}

interface ExportedVault {
  data: string;
  timestamp: string;
  format: string;
}

type BunResponseHeaders = Headers | Record<string, string>;

interface BunResponseInit extends Omit<ResponseInit, "headers"> {
  headers?: BunResponseHeaders;
}

const SESSION_COOKIE_NAME = "xvault_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RESET_TIME_MS = 30 * 60 * 1000;
const DIST_DIR = join(import.meta.dir, "..", "..", "dist");
const CONFIG_PATH = join(import.meta.dir, "..", "..", "config.json");
const DEFAULT_CONFIG: ServerConfig = {
  SERVER_HOST: "localhost",
  SERVER_PORT: 58951,
  SERVER_URL: "http://localhost:58951",
};

const failedLoginAttempts = new Map<string, FailedLoginState>();
const sessions = new Map<string, SessionData>();

const config = await loadConfig();

const parseJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch (error) {
    console.error("Invalid JSON payload:", error);
    return null;
  }
};

async function loadConfig(): Promise<ServerConfig> {
  const configFile = Bun.file(CONFIG_PATH);

  if (!(await configFile.exists())) {
    return DEFAULT_CONFIG;
  }

  try {
    const fileConfig = (await configFile.json()) as Partial<ServerConfig>;

    return {
      SERVER_HOST: fileConfig.SERVER_HOST ?? DEFAULT_CONFIG.SERVER_HOST,
      SERVER_PORT: Number(fileConfig.SERVER_PORT ?? DEFAULT_CONFIG.SERVER_PORT),
      SERVER_URL: fileConfig.SERVER_URL ?? DEFAULT_CONFIG.SERVER_URL,
    };
  } catch (error) {
    console.error("Failed to load config.json, falling back to defaults:", error);
    return DEFAULT_CONFIG;
  }
}

const getRequestOrigin = (request: Request): string =>
  request.headers.get("origin") ?? config.SERVER_URL;

const applyCorsHeaders = (request: Request, response: Response): Response => {
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", getRequestOrigin(request));
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const mergeHeaders = (headersInit?: BunResponseHeaders): Headers => {
  const headers = new Headers();

  if (headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      headers.set(key, value);
    });

    return headers;
  }

  if (!headersInit) {
    return headers;
  }

  for (const [key, value] of Object.entries(headersInit)) {
    headers.set(key, value);
  }

  return headers;
};

const jsonResponse = (
  request: Request,
  payload: unknown,
  init: BunResponseInit = {},
): Response => {
  const headers = mergeHeaders(init.headers);
  headers.set("Content-Type", "application/json");

  return applyCorsHeaders(
    request,
    new Response(JSON.stringify(payload), {
      ...init,
      headers,
    }),
  );
};

const errorResponse = (
  request: Request,
  status: number,
  message: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(request, { error: message, ...details }, { status });

const buildSessionCookie = (token: string, expiresAt: number): string => {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = config.SERVER_URL.startsWith("https://") ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
};

const buildClearedSessionCookie = (): string =>
  `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

const parseCookies = (headerValue: string | null): Record<string, string> => {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...valueParts] = part.trim().split("=");

    if (!key) {
      return acc;
    }

    acc[key] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
};

const createSession = (userId: number, loginId: string) => {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  sessions.set(token, { userId, loginId, expiresAt });

  return {
    token,
    expiresAt,
  };
};

const destroySession = (request: Request): void => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];

  if (token) {
    sessions.delete(token);
  }
};

const getSessionFromRequest = (request: Request): SessionData | null => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_DURATION_MS;
  sessions.set(token, session);

  return session;
};

const resetFailedAttemptsIfNeeded = (loginId: string): FailedLoginState => {
  const now = Date.now();
  const currentState = failedLoginAttempts.get(loginId);

  if (!currentState) {
    const initialState: FailedLoginState = {
      count: 0,
      lastAttempt: now,
      MAX_ATTEMPTS: 5,
      RESET_TIME: DEFAULT_RESET_TIME_MS,
    };

    failedLoginAttempts.set(loginId, initialState);
    return initialState;
  }

  if (now - currentState.lastAttempt > currentState.RESET_TIME) {
    currentState.count = 0;
  }

  currentState.lastAttempt = now;
  failedLoginAttempts.set(loginId, currentState);

  return currentState;
};

const handleApiError = (
  request: Request,
  error: unknown,
  customMessage = "Server error",
): Response => {
  console.error(customMessage, error);
  return errorResponse(request, 500, customMessage);
};

const getSafeAssetPath = (pathname: string): string | null => {
  const trimmedPath = pathname.replace(/^\/+/, "");
  const normalizedPath = normalize(trimmedPath);

  if (!normalizedPath || normalizedPath.startsWith("..")) {
    return null;
  }

  return normalizedPath;
};

const serveFile = async (filePath: string): Promise<Response | null> => {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  return new Response(file);
};

const serveClient = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  if (url.pathname === "/config.json") {
    const configResponse = await serveFile(CONFIG_PATH);
    return configResponse ?? new Response("Not found", { status: 404 });
  }

  const safeAssetPath = getSafeAssetPath(url.pathname);

  if (safeAssetPath) {
    const assetResponse = await serveFile(join(DIST_DIR, safeAssetPath));

    if (assetResponse) {
      return assetResponse;
    }
  }

  const indexResponse = await serveFile(join(DIST_DIR, "index.html"));
  return indexResponse ?? new Response("Build not found", { status: 404 });
};

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }

  for (const [loginId, state] of failedLoginAttempts.entries()) {
    if (now - state.lastAttempt > state.RESET_TIME) {
      failedLoginAttempts.delete(loginId);
    }
  }
}, 15 * 60 * 1000);

cleanupTimer.unref?.();

getDb();
console.log("Database initialized successfully");

const app = new Elysia()
  .options("/api/*", ({ request }) =>
    applyCorsHeaders(request, new Response(null, { status: 204 })),
  )
  .post("/api/auth/register", async ({ request }) => {
    try {
      const body = await parseJson<{ password?: string }>(request);
      const password = body?.password;

      if (!password) {
        return errorResponse(request, 400, "Password is required");
      }

      const result = createUser(password);

      if (!result.success || !result.userId || !result.loginId) {
        return errorResponse(
          request,
          500,
          result.error ?? "Failed to create user account",
        );
      }

      const session = createSession(result.userId, result.loginId);

      return jsonResponse(
        request,
        {
          success: true,
          loginId: result.loginId,
        },
        {
          headers: {
            "Set-Cookie": buildSessionCookie(session.token, session.expiresAt),
          },
        },
      );
    } catch (error) {
      return handleApiError(request, error, "Error registering user");
    }
  })
  .post("/api/auth/login", async ({ request }) => {
    try {
      const body = await parseJson<{ loginId?: string; password?: string }>(
        request,
      );
      const loginId = body?.loginId;
      const password = body?.password;

      if (!loginId || !password) {
        return errorResponse(
          request,
          400,
          "Login ID and password are required",
        );
      }

      const failedAttempts = resetFailedAttemptsIfNeeded(loginId);

      if (failedAttempts.count >= failedAttempts.MAX_ATTEMPTS) {
        return errorResponse(
          request,
          429,
          "Too many failed login attempts. Please try again later.",
          {
            attemptsLeft: 0,
            lockoutTime: failedAttempts.RESET_TIME / 60000,
          },
        );
      }

      const result = authenticateUser(loginId, password);

      if (!result.success || !result.user) {
        failedAttempts.count += 1;
        failedLoginAttempts.set(loginId, failedAttempts);

        return errorResponse(
          request,
          401,
          result.error ?? "Invalid login credentials",
          {
            attemptsLeft: Math.max(
              failedAttempts.MAX_ATTEMPTS - failedAttempts.count,
              0,
            ),
          },
        );
      }

      failedAttempts.count = 0;
      failedLoginAttempts.set(loginId, failedAttempts);

      const session = createSession(result.user.id, result.user.loginId);

      return jsonResponse(
        request,
        {
          success: true,
          user: result.user,
        },
        {
          headers: {
            "Set-Cookie": buildSessionCookie(session.token, session.expiresAt),
          },
        },
      );
    } catch (error) {
      return handleApiError(request, error, "Error logging in");
    }
  })
  .post("/api/auth/logout", ({ request }) => {
    destroySession(request);

    return jsonResponse(
      request,
      { success: true },
      {
        headers: {
          "Set-Cookie": buildClearedSessionCookie(),
        },
      },
    );
  })
  .get("/api/auth/status", ({ request }) => {
    const session = getSessionFromRequest(request);

    if (!session) {
      return jsonResponse(request, { authenticated: false });
    }

    return jsonResponse(request, {
      authenticated: true,
      loginId: session.loginId,
    });
  })
  .get("/api/user/profile", ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const user = getUserProfile(session.userId);

      if (!user) {
        return errorResponse(request, 404, "User not found");
      }

      return jsonResponse(request, {
        success: true,
        user,
      });
    } catch (error) {
      return handleApiError(request, error, "Error fetching user profile");
    }
  })
  .put("/api/user/profile", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{ name?: string; logo?: string | null }>(
        request,
      );

      if (!body) {
        return errorResponse(request, 400, "Invalid request body");
      }

      const result = updateUserProfile(session.userId, body);

      if (!result.success) {
        return errorResponse(
          request,
          500,
          result.error ?? "Failed to update user profile",
        );
      }

      return jsonResponse(request, { success: true });
    } catch (error) {
      return handleApiError(request, error, "Error updating user profile");
    }
  })
  .post("/api/user/change-password", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{
        currentPassword?: string;
        newPassword?: string;
      }>(request);

      if (!body?.currentPassword || !body?.newPassword) {
        return errorResponse(
          request,
          400,
          "Current and new passwords are required",
        );
      }

      const result = changeUserPassword(
        session.userId,
        body.currentPassword,
        body.newPassword,
      );

      if (!result.success) {
        return errorResponse(
          request,
          400,
          result.error ?? "Failed to change password",
        );
      }

      return jsonResponse(request, { success: true });
    } catch (error) {
      return handleApiError(request, error, "Error changing password");
    }
  })
  .post("/api/user/delete-account", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{ password?: string }>(request);

      if (!body?.password) {
        return errorResponse(request, 400, "Password is required");
      }

      const result = deleteUserAccount(session.userId, body.password);

      if (!result.success) {
        return errorResponse(
          request,
          400,
          result.error ?? "Failed to delete account",
        );
      }

      destroySession(request);

      return jsonResponse(
        request,
        { success: true },
        {
          headers: {
            "Set-Cookie": buildClearedSessionCookie(),
          },
        },
      );
    } catch (error) {
      return handleApiError(request, error, "Error deleting account");
    }
  })
  .post("/api/vault/data", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{ password?: string }>(request);

      if (!body?.password) {
        return errorResponse(request, 400, "Password required");
      }

      const result = getVaultData(session.userId, body.password);

      if (!result.success || !result.data) {
        return errorResponse(
          request,
          401,
          result.error ?? "Invalid password or corrupted data",
        );
      }

      return jsonResponse(request, result.data);
    } catch (error) {
      return handleApiError(request, error, "Error fetching vault data");
    }
  })
  .post("/api/vault/save", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{
        data?: VaultData;
        password?: string;
      }>(request);

      if (!body?.password || !body.data) {
        return errorResponse(request, 400, "Password and data required");
      }

      const result = saveVaultData(session.userId, body.data, body.password);

      if (!result.success) {
        return errorResponse(
          request,
          500,
          result.error ?? "Failed to save vault data",
        );
      }

      return jsonResponse(request, { success: true });
    } catch (error) {
      return handleApiError(request, error, "Error saving vault data");
    }
  })
  .post("/api/vault/export", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{ password?: string }>(request);

      if (!body?.password) {
        return errorResponse(request, 400, "Password required");
      }

      const result = getVaultData(session.userId, body.password);

      if (!result.success || !result.data) {
        return errorResponse(
          request,
          401,
          "Invalid password or vault not found",
        );
      }

      const exportData: ExportedVault = {
        data: JSON.stringify(result.data),
        timestamp: new Date().toISOString(),
        format: "xVault-V2",
      };

      return jsonResponse(request, exportData);
    } catch (error) {
      return handleApiError(request, error, "Error exporting vault");
    }
  })
  .post("/api/vault/import", async ({ request }) => {
    try {
      const session = getSessionFromRequest(request);

      if (!session) {
        return errorResponse(request, 401, "Authentication required");
      }

      const body = await parseJson<{
        importData?: ExportedVault;
        password?: string;
      }>(request);

      if (!body?.password || !body.importData?.data) {
        return errorResponse(
          request,
          400,
          "Password and import data required",
        );
      }

      if (body.importData.format !== "xVault-V2") {
        return errorResponse(
          request,
          400,
          "Unsupported vault format. Only xVault-V2 format is supported.",
        );
      }

      let vaultData: VaultData;

      try {
        vaultData = JSON.parse(body.importData.data) as VaultData;
      } catch (error) {
        console.error("Error parsing import data:", error);
        return errorResponse(
          request,
          401,
          "Invalid password or corrupted import data",
        );
      }

      const result = saveVaultData(session.userId, vaultData, body.password);

      if (!result.success) {
        return errorResponse(
          request,
          500,
          result.error ?? "Failed to import vault",
        );
      }

      return jsonResponse(request, { success: true });
    } catch (error) {
      return handleApiError(request, error, "Error importing vault");
    }
  })
  .get("/config.json", async ({ request }) => {
    const response = await serveClient(request);
    return applyCorsHeaders(request, response);
  })
  .get("/", async ({ request }) => serveClient(request))
  .get("/*", async ({ request }) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return errorResponse(request, 404, "Not found");
    }

    return serveClient(request);
  });

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT ERROR:", error);
  console.log("The server continues to run despite an uncaught error");
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE REJECTION:", reason);
  console.log("The server continues to run despite an unhandled promise rejection");
});

app.listen({
  hostname: config.SERVER_HOST,
  port: Number(config.SERVER_PORT),
});

console.log(`Server running on ${config.SERVER_URL}`);
