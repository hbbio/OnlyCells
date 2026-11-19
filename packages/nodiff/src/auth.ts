import { isObject, Sheet, type ValueCell } from "@okcontract/cells";
import { createLocalCache } from "./cache.ts";
import { defineSchema, type Schema, ValidationError } from "./schema.ts";
import { type ControllerOptions, patchCell, readCell } from "./state.ts";

export type AuthToken = {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
  tokenType?: string | undefined;
};

export const AuthTokenSchema = defineSchema((input): AuthToken => {
  if (
    !isObject(input) ||
    typeof input.accessToken !== "string" ||
    input.accessToken.length === 0 ||
    (input.refreshToken !== undefined && typeof input.refreshToken !== "string") ||
    (input.expiresAt !== undefined &&
      (typeof input.expiresAt !== "number" || !Number.isFinite(input.expiresAt))) ||
    (input.tokenType !== undefined && typeof input.tokenType !== "string")
  ) {
    throw new ValidationError([{ path: [], message: "Invalid authentication token." }]);
  }
  return input as AuthToken;
});

export type AuthState<TUser = unknown, TToken extends AuthToken = AuthToken> = {
  token: TToken | null;
  user: TUser | null;
  status: "anonymous" | "authenticated";
  setToken(token: TToken, user?: TUser | null): void;
  setUser(user: TUser | null): void;
  clear(): void;
};

export type AuthOptions<TToken extends AuthToken> = {
  storageKey?: string;
  tokenSchema?: Schema<TToken>;
  persist?: boolean;
  allowRefreshTokenPersistence?: boolean;
};

export type AuthController<TUser = unknown, TToken extends AuthToken = AuthToken> = {
  cell: ValueCell<AuthState<TUser, TToken>>;
  getToken(): string | null;
  requireToken(): TToken;
  authHeaders(): HeadersInit;
  requiredHeaders(): HeadersInit;
  isExpired(skewMs?: number): boolean;
  isAuthenticated(): boolean;
  setToken(token: TToken, user?: TUser | null): void;
  setUser(user: TUser | null): void;
  logout(): void;
};

type AuthControllerOptions<TUser, TToken extends AuthToken> = AuthOptions<TToken> &
  ControllerOptions<AuthState<TUser, TToken>>;

export function createAuth<TUser = unknown, TToken extends AuthToken = AuthToken>(
  options: AuthControllerOptions<TUser, TToken> = {},
): AuthController<TUser, TToken> {
  const storageKey = options.storageKey ?? "nodiff:auth";
  const schema = options.tokenSchema ?? (AuthTokenSchema as Schema<TToken>);
  const cache = createLocalCache("");
  const persist = options.persist ?? false;

  function tokenExpired(token: TToken, skewMs = 0): boolean {
    if (!token.expiresAt) return false;
    return token.expiresAt - skewMs <= Date.now();
  }

  function readSavedToken(): TToken | null {
    const savedToken = cache.get<TToken>(storageKey, schema)?.value ?? null;
    if (!savedToken) return null;
    if (savedToken.refreshToken && !options.allowRefreshTokenPersistence) {
      cache.remove(storageKey);
      return null;
    }
    if (tokenExpired(savedToken)) {
      cache.remove(storageKey);
      return null;
    }
    return savedToken;
  }

  const savedToken = persist ? readSavedToken() : null;

  const initial: AuthState<TUser, TToken> = {
    token: savedToken,
    user: null,
    status: savedToken ? "authenticated" : "anonymous",
    setToken,
    setUser: (user) => patchCell(cell, { user }),
    clear,
  };
  const suppliedCell = options.cell;
  const cell =
    suppliedCell ?? (options.sheet ?? new Sheet(Object.is)).new(initial, undefined, "session");
  // Subscribers to the supplied Cell can call session actions as soon as it updates.
  if (suppliedCell) cell.set(initial);

  function clear(): void {
    patchCell(cell, { token: null, user: null, status: "anonymous" });
  }

  function setToken(token: TToken, user?: TUser | null): void {
    if (persist && token.refreshToken && !options.allowRefreshTokenPersistence) {
      throw new Error("Refusing to persist a refresh token without explicit opt-in.");
    }
    if (tokenExpired(token)) {
      clear();
      return;
    }
    const state = readCell(cell);
    cell.set({
      ...state,
      token,
      user: user === undefined ? state.user : user,
      status: "authenticated",
    });
  }

  if (persist) {
    let previousToken = savedToken;
    cell.subscribe(({ token }) => {
      if (token === previousToken) return;
      previousToken = token;
      if (
        !token ||
        (token.refreshToken && !options.allowRefreshTokenPersistence) ||
        tokenExpired(token)
      ) {
        cache.remove(storageKey);
        return;
      }
      const ttl = token.expiresAt ? token.expiresAt - Date.now() : undefined;
      if (ttl !== undefined && ttl <= 0) {
        cache.remove(storageKey);
        return;
      }
      cache.set(storageKey, token, ttl === undefined ? {} : { ttl });
    });
  }

  function activeToken(): TToken | null {
    const token = readCell(cell).token;
    if (!token?.accessToken || tokenExpired(token)) return null;
    return token;
  }

  function getToken(): string | null {
    return activeToken()?.accessToken ?? null;
  }

  function requireToken(): TToken {
    const token = activeToken();
    if (!token) throw new Error("Authentication token is required.");
    return token;
  }

  function authHeaders(): HeadersInit {
    const token = activeToken();
    if (!token) return {};
    return {
      Authorization: `${token.tokenType ?? "Bearer"} ${token.accessToken}`,
    };
  }

  function requiredHeaders(): HeadersInit {
    const token = requireToken();
    return {
      Authorization: `${token.tokenType ?? "Bearer"} ${token.accessToken}`,
    };
  }

  function isExpired(skewMs = 30_000): boolean {
    const token = readCell(cell).token;
    if (!token) return false;
    return tokenExpired(token, skewMs);
  }

  function isAuthenticated(): boolean {
    return Boolean(readCell(cell).token?.accessToken) && !isExpired();
  }

  return {
    cell,
    getToken,
    requireToken,
    authHeaders,
    requiredHeaders,
    isExpired,
    isAuthenticated,
    setToken: (token, user) => readCell(cell).setToken(token, user),
    setUser: (user) => readCell(cell).setUser(user),
    logout: () => readCell(cell).clear(),
  };
}

export function cookieSessionRequest() {
  return {
    auth: "required" as const,
    credentials: "include" as const,
    csrf: true as const,
  };
}
