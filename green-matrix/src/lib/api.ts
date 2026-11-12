import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Central API access for the Expo app.
 *
 * The Next.js rewrites are gone: requests go straight to FastAPI using the
 * EXPO_PUBLIC_API_URL env var (see .env). Paths are passed exactly as they
 * were in the Next.js app, e.g. apiFetch('/api/auth/login').
 */

const legacyConstants = Constants as typeof Constants & {
  manifest?: { debuggerHost?: string };
  manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
};

function normalizeEnvApiUrl(rawUrl?: string): string | null {
  const candidate = rawUrl?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (!parsed.protocol || !parsed.host || !parsed.hostname) {
      return null;
    }

    const blockedHosts = new Set(['api', 'localhost', '0.0.0.0', '127.0.0.1']);
    if (blockedHosts.has(host)) {
      return null;
    }

    return candidate.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function resolveApiUrl() {
  const envUrl = normalizeEnvApiUrl(process.env.EXPO_PUBLIC_API_URL);
  if (envUrl) {
    return envUrl;
  }

  const debuggerHost =
    legacyConstants.expoConfig?.hostUri ??
    legacyConstants.manifest?.debuggerHost ??
    legacyConstants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host && host !== 'localhost') {
      return `http://${host}:8000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Serialized as JSON automatically. */
  body?: unknown;
}

/**
 * Fetch wrapper: prefixes the FastAPI base URL, sends JSON headers and
 * parses the response. Throws ApiError on non-2xx responses.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const url = `${API_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
          ? (data as { error: string }).error
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data as T;
  } catch (error) {
    console.error(`API request failed for ${url}. Check EXPO_PUBLIC_API_URL and ensure FastAPI runs on 0.0.0.0:8000.`, error);
    throw error;
  }
}

/** Same as apiFetch but returns null instead of throwing on network/HTTP errors. */
export async function apiTry<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    console.warn(`API call failed: ${path}`, error);
    return null;
  }
}
