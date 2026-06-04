// BULA AUDIT - local API client.
// Same `base44.*` surface as before; talks to our Express backend at /api/*.
// Handles short-lived access tokens via /api/auth/refresh on 401.

// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js).
// In prod (Cloudflare Pages), the frontend domain is different from the API
// domain, so use the full URL from VITE_API_URL build-time env var.
const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api`
  : '/api';
const ACCESS_KEY = 'bula_token';
const REFRESH_KEY = 'bula_refresh_token';

export function getToken() {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem(ACCESS_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(ACCESS_KEY); } catch { /* ignore */ }
}
export function getRefreshToken() {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setRefreshToken(token) {
  try { localStorage.setItem(REFRESH_KEY, token); } catch { /* ignore */ }
}
export function clearRefreshToken() {
  try { localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}
export function clearAllTokens() {
  clearToken();
  clearRefreshToken();
}

let refreshInflight = null;

async function tryRefreshAccessToken() {
  if (refreshInflight) return refreshInflight;
  const refresh = getRefreshToken();
  refreshInflight = (async () => {
    if (!refresh) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      // (uses API_BASE so it works on Cloudflare Pages too)
      if (!res.ok) {
        clearAllTokens();
        return null;
      }
      const data = await res.json();
      if (data?.token) setToken(data.token);
      if (data?.refresh_token) setRefreshToken(data.refresh_token);
      return data?.token || null;
    } catch {
      return null;
    } finally {
      setTimeout(() => { refreshInflight = null; }, 100);
    }
  })();
  return refreshInflight;
}

async function rawRequest(method, path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const fetchOpts = {
    method,
    headers,
    credentials: 'include',
  };
  if (body !== undefined) {
    fetchOpts.body = body instanceof FormData ? body : JSON.stringify(body);
  }
  return fetch(`${API_BASE}${path}`, fetchOpts);
}

async function request(method, path, body, opts = {}) {
  let res = await rawRequest(method, path, body, opts);

  // Auto-refresh on 401 (once) for non-auth endpoints
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const newAccess = await tryRefreshAccessToken();
    if (newAccess) {
      res = await rawRequest(method, path, body, opts);
    }
  }

  if (res.status === 401) {
    clearAllTokens();
  }
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch { /* ignore */ }
    const err = new Error(payload.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = payload;
    throw err;
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function buildQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function entityClient(resource) {
  return {
    list: (_orderBy, limit) => request('GET', `${resource}${buildQuery({ limit })}`),
    filter: (where, _orderBy, limit) =>
      request('GET', `${resource}${buildQuery({ ...(where || {}), limit })}`),
    get: (id) => request('GET', `${resource}/${id}`),
    create: (data) => request('POST', resource, data),
    update: (id, data) => request('PATCH', `${resource}/${id}`, data),
    delete: (id) => request('DELETE', `${resource}/${id}`),
  };
}

export const base44 = {
  auth: {
    me: async () => {
      const { user } = await request('GET', '/auth/me');
      return user;
    },
    updateMe: async (data) => {
      const { user } = await request('PATCH', '/auth/me', data);
      return user;
    },
    login: async (email, password) => {
      const result = await request('POST', '/auth/login', { email, password });
      // 2FA challenge — caller must call loginWithTwoFa next
      if (result?.requires_2fa) {
        return {
          requires2fa: true,
          challengeToken: result.challenge_token,
        };
      }
      if (result?.token) setToken(result.token);
      if (result?.refresh_token) setRefreshToken(result.refresh_token);
      return result?.user;
    },
    loginWithTwoFa: async (challengeToken, code) => {
      const result = await request('POST', '/auth/login/2fa', {
        challenge_token: challengeToken,
        code,
      });
      if (result?.token) setToken(result.token);
      if (result?.refresh_token) setRefreshToken(result.refresh_token);
      return result?.user;
    },
    signup: async (email, password, full_name, turnstile_token) => {
      const body = { email, password, full_name };
      if (turnstile_token) body.turnstile_token = turnstile_token;
      const result = await request('POST', '/auth/signup', body);
      if (result?.token) setToken(result.token);
      if (result?.refresh_token) setRefreshToken(result.refresh_token);
      return result?.user;
    },
    logout: async (redirectUrl) => {
      const refresh = getRefreshToken();
      try { await request('POST', '/auth/logout', { refresh_token: refresh }); } catch { /* ignore */ }
      clearAllTokens();
      const target =
        typeof redirectUrl === 'string' && redirectUrl.startsWith('/')
          ? redirectUrl
          : '/login';
      try { window.location.href = target; } catch { /* ignore */ }
    },
    logoutEverywhere: async () => {
      try { await request('POST', '/auth/logout-all'); } catch { /* ignore */ }
      clearAllTokens();
      try { window.location.href = '/login'; } catch { /* ignore */ }
    },
    redirectToLogin: (fromUrl) => {
      const target = fromUrl ? `/login?from=${encodeURIComponent(fromUrl)}` : '/login';
      try { window.location.href = target; } catch { /* ignore */ }
    },
    getGoogleLoginUrl: (fromUrl) => {
      const q = fromUrl ? `?from_url=${encodeURIComponent(fromUrl)}` : '';
      return `${API_BASE}/auth/google${q}`;
    },
    googleStatus: () => request('GET', '/auth/google/status'),

    requestPasswordReset: (email, turnstile_token) => {
      const body = { email };
      if (turnstile_token) body.turnstile_token = turnstile_token;
      return request('POST', '/auth/password-reset/request', body);
    },
    confirmPasswordReset: (token, password) =>
      request('POST', '/auth/password-reset/confirm', { token, password }),

    resendVerification: () => request('POST', '/auth/verify-email/resend'),
    confirmVerification: (token) =>
      request('POST', '/auth/verify-email/confirm', { token }),

    changePassword: async (current_password, new_password) => {
      const result = await request('POST', '/auth/change-password', {
        current_password,
        new_password,
      });
      // Server returns new access + refresh after a successful change
      if (result?.token) setToken(result.token);
      if (result?.refresh_token) setRefreshToken(result.refresh_token);
      return result;
    },
  },

  twofa: {
    status:    () => request('GET',  '/2fa/status'),
    setup:     () => request('POST', '/2fa/setup'),
    confirm:   (token) => request('POST', '/2fa/confirm', { token }),
    disable:   (password, token) => request('POST', '/2fa/disable', { password, token }),
    regenerateBackupCodes: () => request('POST', '/2fa/backup-codes/regenerate'),
  },

  audit: {
    list: (params) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
      }
      const qs = sp.toString() ? `?${sp}` : '';
      return request('GET', `/audit-logs${qs}`);
    },
  },

  entities: {
    Company:      entityClient('/companies'),
    Receipt:      entityClient('/receipts'),
    TeamMember:   entityClient('/team-members'),
    Subscription: entityClient('/subscriptions'),
    PaymentProof: entityClient('/payment-proofs'),
  },

  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const form = new FormData();
        form.append('file', file);
        return request('POST', '/uploads', form);
      },
      InvokeLLM: ({ prompt, file_urls, response_json_schema, model }) =>
        request('POST', '/ai/invoke-llm', {
          prompt, file_urls, response_json_schema, model,
        }),
    },
  },

  agents: {
    createConversation: ({ agent_id, metadata }) =>
      request('POST', '/ai/conversations', { agent_id, metadata }),
    addMessage: (convOrId, { role = 'user', content }) => {
      const id = typeof convOrId === 'string' ? convOrId : convOrId?.id;
      if (!id) throw new Error('addMessage: conversation id required');
      return request('POST', `/ai/conversations/${id}/messages`, { role, content });
    },
    subscribeToConversation: (id, callback) => {
      let lastTs = '';
      let stopped = false;
      const tick = async () => {
        if (stopped) return;
        try {
          const q = lastTs ? `?since=${encodeURIComponent(lastTs)}` : '';
          const data = await request('GET', `/ai/conversations/${id}/messages${q}`);
          if (data?.messages?.length) {
            for (const m of data.messages) {
              callback({ message: m });
              lastTs = m.created_date;
            }
          }
        } catch { /* polling errors swallowed */ }
      };
      const interval = setInterval(tick, 2500);
      tick();
      return () => { stopped = true; clearInterval(interval); };
    },
  },

  users: {
    inviteUser: async (_email, _role) => ({ ok: true }),
  },
};
