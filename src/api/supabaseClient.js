/**
 * Supabase data layer — mirrors base44Client shape for gradual migration.
 * Enable with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env
 */
import { supabase } from '@/lib/supabase.js';

function rowToCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tin: row.tin,
    business_type: row.business_type,
    phone: row.phone,
    email: row.email,
    address: row.address,
    vat_registered: row.vat_registered,
    vat_rate: row.vat_rate,
    owner_email: row.owner_email,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function rowToTeamMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    user_email: row.user_email,
    user_name: row.user_name,
    role: row.role,
    status: row.status,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function rowToReceipt(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    photo_url: row.photo_url,
    document_url: row.document_url,
    document_name: row.document_name,
    supplier_name: row.supplier_name,
    supplier_tin: row.supplier_tin,
    receipt_number: row.receipt_number,
    receipt_date: row.receipt_date,
    due_date: row.due_date,
    currency: row.currency,
    subtotal: row.subtotal,
    vat_type: row.vat_type,
    vat_rate: row.vat_rate,
    vat_amount: row.vat_amount,
    total_amount: row.total_amount,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    category: row.category,
    item_lines: row.item_lines ?? [],
    ai_confidence: row.ai_confidence,
    ai_missing_fields: row.ai_missing_fields ?? [],
    status: row.status,
    notes: row.notes,
    uploaded_by: row.uploaded_by,
    reviewed_by: row.reviewed_by,
    reviewed_date: row.reviewed_date,
    created_date: row.created_at,
    updated_date: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function rowToSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    plan: row.plan,
    billing_cycle: row.billing_cycle,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    next_payment_date: row.next_payment_date,
    amount_due: row.amount_due,
    notes: row.notes,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function rowToPaymentProof(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    subscription_id: row.subscription_id,
    proof_url: row.proof_url,
    proof_filename: row.proof_filename,
    payment_method: row.payment_method,
    amount_paid: row.amount_paid,
    payment_date: row.payment_date,
    reference_number: row.reference_number,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_date: row.reviewed_date,
    review_notes: row.review_notes,
    submitted_by: row.submitted_by,
    plan_requested: row.plan_requested,
    billing_cycle_requested: row.billing_cycle_requested,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function camelToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

function buildEntityClient(table, serializer, defaultOrder = 'created_at', extraFilter) {
  return {
    list: async (_orderBy, limit = 100) => {
      let q = supabase.from(table).select('*').order(defaultOrder, { ascending: false });
      if (extraFilter) q = extraFilter(q);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map(serializer);
    },
    filter: async (where, _orderBy, limit = 100) => {
      let q = supabase.from(table).select('*');
      const w = camelToSnake(where || {});
      for (const [k, v] of Object.entries(w)) {
        if (v === undefined || v === null || v === '') continue;
        q = q.eq(k, v);
      }
      if (extraFilter) q = extraFilter(q);
      q = q.order(defaultOrder, { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map(serializer);
    },
    get: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return serializer(data);
    },
    create: async (payload) => {
      const { data, error } = await supabase
        .from(table)
        .insert(camelToSnake(payload))
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return serializer(data);
    },
    update: async (id, payload) => {
      const { data, error } = await supabase
        .from(table)
        .update(camelToSnake(payload))
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return serializer(data);
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
      return null;
    },
  };
}

async function profileToUser(profile, authUser) {
  if (profile) {
    return {
      id: profile.id,
      email: profile.email || authUser?.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      email_verified: Boolean(authUser?.email_confirmed_at),
      email_delivery: 'inbox',
      data: {
        current_company_id: profile.current_company_id,
        current_company_role: profile.current_company_role,
      },
    };
  }
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
    avatar_url: authUser.user_metadata?.avatar_url,
    role: 'user',
    email_verified: Boolean(authUser.email_confirmed_at),
    email_delivery: 'inbox',
    data: {},
  };
}

async function fetchProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) console.warn('[auth] getUser:', userError.message);
  if (!user) return { user: null, profile: null };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[auth] profile fetch:', error.message);
    return { user, profile: null };
  }
  return { user, profile };
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api`
  : '/api';

async function supabaseAuthedFetch(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || res.statusText || 'Request failed');
  }
  return res.json();
}

export const supabaseApi = {
  auth: {
    me: async () => {
      const { user, profile } = await fetchProfile();
      if (!user) {
        const err = new Error(
          'Your session expired or email is not confirmed yet. Log in again, or check your inbox for the confirmation link.',
        );
        err.status = 401;
        throw err;
      }
      return profileToUser(profile, user);
    },
    updateMe: async (data) => {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) throw new Error('Not logged in. Please refresh and sign in again.');
      const patch = {};
      if (data.current_company_id !== undefined) patch.current_company_id = data.current_company_id;
      if (data.current_company_role !== undefined) patch.current_company_role = data.current_company_role;
      if (data.full_name !== undefined) patch.full_name = data.full_name;
      const { data: profile, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', authUser.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return profileToUser(profile, authUser);
    },
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error('Sign-in failed. Confirm your email first, then try again.');
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileError) console.warn('[auth] login profile fetch:', profileError.message);
      return profileToUser(profile, data.user);
    },
    signup: async (email, password, full_name) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name } },
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Sign-up failed');

      if (!data.session) {
        const err = new Error(
          'Account created. Check your email for a confirmation link, then log in to continue.',
        );
        err.code = 'EMAIL_CONFIRMATION_REQUIRED';
        throw err;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      return profileToUser(profile, data.user);
    },
    logout: async (redirectUrl = '/login') => {
      await supabase.auth.signOut();
      try { window.location.href = redirectUrl; } catch { /* ignore */ }
    },
    logoutEverywhere: async () => {
      await supabase.auth.signOut({ scope: 'global' });
      try { window.location.href = '/login'; } catch { /* ignore */ }
    },
    redirectToLogin: (fromUrl) => {
      const target = fromUrl ? `/login?from=${encodeURIComponent(fromUrl)}` : '/login';
      try { window.location.href = target; } catch { /* ignore */ }
    },
    getGoogleLoginUrl: (fromUrl) => {
      const redirectTo = fromUrl || `${window.location.origin}/`;
      void supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      }).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        if (data?.url) window.location.href = data.url;
      });
      return '#';
    },
    loginWithGoogle: async (fromUrl) => {
      const redirectTo = fromUrl || `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
      if (data?.url) window.location.href = data.url;
      else throw new Error('Google sign-in is not configured. Enable Google in Supabase → Authentication → Providers.');
    },
    googleStatus: async () => ({ configured: true }),
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      return { ok: true, email_delivery: 'inbox' };
    },
    confirmPasswordReset: async (_token, password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    resendVerification: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No email on account');
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    confirmVerification: async () => ({ ok: true }),
    changePassword: async (_current, newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return { ok: true };
    },
    loginWithTwoFa: async () => {
      throw new Error('2FA via Supabase MFA — migrate in phase 2');
    },
  },

  entities: {
    Company: buildEntityClient('companies', rowToCompany),
    Receipt: buildEntityClient('receipts', rowToReceipt, 'created_at', (q) => q.is('deleted_at', null)),
    TeamMember: buildEntityClient('team_members', rowToTeamMember),
    Subscription: buildEntityClient('subscriptions', rowToSubscription),
    PaymentProof: buildEntityClient('payment_proofs', rowToPaymentProof),
  },

  integrations: {
    Core: {
      UploadFile: async ({ file, companyId }) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not logged in. Refresh and sign in again.');

        let cid = companyId;
        if (!cid) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('current_company_id')
            .eq('id', session.user.id)
            .maybeSingle();
          cid = profile?.current_company_id;
        }
        if (!cid) throw new Error('No company selected. Finish setup first.');

        const ext = file.name?.split('.').pop() || 'bin';
        const key = `${cid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('receipts').upload(key, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(key, 3600);
        return {
          file_url: signed?.signedUrl,
          key,
          url: signed?.signedUrl,
        };
      },
      InvokeLLM: (body) => supabaseAuthedFetch('POST', '/ai/invoke-llm', body),
      ExtractReceipt: (body) => supabaseAuthedFetch('POST', '/ai/extract-receipt', body),
    },
  },

  agents: {
    createConversation: async ({ agent_id, metadata }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, agent_id, metadata })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    addMessage: async (convOrId, { role = 'user', content }) => {
      const id = typeof convOrId === 'string' ? convOrId : convOrId?.id;
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: id, role, content })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      // AI reply still via Vercel/Express API
      const aiRes = await fetch(`${API_BASE}/ai/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
      if (aiRes.ok) return aiRes.json();
      return data;
    },
    subscribeToConversation: (id, callback) => {
      const channel = supabase
        .channel(`messages:${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
          async () => {
            const { data } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', id)
              .order('created_at', { ascending: true });
            callback({ messages: data ?? [] });
          },
        )
        .subscribe();
      supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .then(({ data }) => callback({ messages: data ?? [] }));
      return () => { supabase.removeChannel(channel); };
    },
    getAiStatus: () =>
      fetch(`${API_BASE}/ai/status`).then((r) => r.json()).catch(() => ({ ok: false })),
  },

  audit: {
    list: async (params) => {
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
      if (params?.company_id) q = q.eq('company_id', params.company_id);
      if (params?.limit) q = q.limit(params.limit);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { logs: data ?? [] };
    },
  },

  twofa: {
    status: () => Promise.reject(new Error('Use Supabase MFA in dashboard settings (phase 2)')),
    setup: () => Promise.reject(new Error('Use Supabase MFA (phase 2)')),
    confirm: () => Promise.reject(new Error('Use Supabase MFA (phase 2)')),
    disable: () => Promise.reject(new Error('Use Supabase MFA (phase 2)')),
    regenerateBackupCodes: () => Promise.reject(new Error('Use Supabase MFA (phase 2)')),
  },

  users: {
    inviteUser: async () => ({ ok: true }),
  },
};
