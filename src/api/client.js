/**
 * Unified API client — Supabase when configured, otherwise Express (base44).
 */
import { isSupabaseMode } from '@/lib/supabase.js';
import { base44 } from '@/api/base44Client.js';
import { supabaseApi } from '@/api/supabaseClient.js';

export const api = isSupabaseMode() ? supabaseApi : base44;

// Back-compat: existing imports use `base44`
export { api as base44 };
