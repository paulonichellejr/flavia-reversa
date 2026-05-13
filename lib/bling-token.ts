/**
 * Gestão automática do token OAuth do Bling ERP v3
 *
 * O access_token do Bling expira em ~6 horas.
 * Esta lib armazena os tokens no Supabase e faz refresh automático
 * sempre que o token estiver a menos de 15 min de expirar.
 *
 * Fluxo:
 *   1. Lê o token da tabela `bling_tokens` no Supabase
 *   2. Se expirando em < 15 min → chama OAuth /refresh_token automaticamente
 *   3. Salva os novos tokens no Supabase
 *   4. Retorna o access_token válido
 *
 * Fallback local (npm run dev):
 *   Se a tabela estiver vazia, usa process.env.BLING_API_KEY
 */

import { supabaseAdmin } from './supabase';

const BLING_OAUTH_URL  = 'https://www.bling.com.br/Api/v3/oauth/token';
const BUFFER_MIN       = 15; // renova 15 min antes de expirar

// ─── Tipo da linha no Supabase ────────────────────────────────
interface BlingTokenRow {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
}

// ─── Cache em memória para a mesma instância Vercel ──────────
// Evita round-trips ao Supabase em cada request dentro da mesma lambda
let _cache: { token: string; expiresAt: Date } | null = null;

// ─── Principal ────────────────────────────────────────────────
export async function getBlingToken(): Promise<string> {
  const now = new Date();
  const buffer = BUFFER_MIN * 60 * 1000;

  // 1. Cache em memória ainda válido?
  if (_cache && _cache.expiresAt.getTime() - now.getTime() > buffer) {
    return _cache.token;
  }

  // 2. Busca token no Supabase
  const { data: row, error } = await supabaseAdmin
    .from('bling_tokens')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single<BlingTokenRow>();

  if (error || !row) {
    // Fallback para env var (desenvolvimento local)
    const envToken = process.env.BLING_API_KEY;
    if (envToken) {
      console.warn('[BlingToken] Supabase sem token — usando env BLING_API_KEY (dev)');
      return envToken;
    }
    throw new Error('[BlingToken] Nenhum token encontrado no Supabase nem em BLING_API_KEY');
  }

  const expiresAt = new Date(row.expires_at);

  // 3. Ainda válido → atualiza cache e retorna
  if (expiresAt.getTime() - now.getTime() > buffer) {
    _cache = { token: row.access_token, expiresAt };
    return row.access_token;
  }

  // 4. Expirado ou expirando → refresh
  console.log('[BlingToken] Token expirando às', expiresAt.toISOString(), '— renovando...');
  const newTokens = await refreshBlingOAuth(row.refresh_token);

  const newExpiresAt = new Date(Date.now() + (newTokens.expires_in ?? 21600) * 1000);

  // 5. Salva no Supabase
  const { error: saveErr } = await supabaseAdmin
    .from('bling_tokens')
    .update({
      access_token:  newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at:    newExpiresAt.toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq('id', row.id);

  if (saveErr) {
    console.error('[BlingToken] Erro ao salvar novo token no Supabase:', saveErr);
    // Continua com o novo token mesmo sem conseguir salvar
  } else {
    console.log('[BlingToken] ✅ Token renovado e salvo. Expira em:', newExpiresAt.toISOString());
  }

  // 6. Atualiza cache
  _cache = { token: newTokens.access_token, expiresAt: newExpiresAt };
  return newTokens.access_token;
}

// ─── OAuth refresh_token ──────────────────────────────────────
export async function refreshBlingOAuth(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId     = process.env.BLING_CLIENT_ID!;
  const clientSecret = process.env.BLING_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    throw new Error('[BlingToken] BLING_CLIENT_ID ou BLING_CLIENT_SECRET não configurados');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(BLING_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization':  `Basic ${credentials}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Accept':         'application/json',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  const json = await res.json();

  if (!res.ok || !json.access_token) {
    console.error('[BlingToken] Falha no refresh OAuth:', json);
    throw new Error(`[BlingToken] Refresh OAuth falhou: ${res.status} — ${JSON.stringify(json)}`);
  }

  return {
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_in:    json.expires_in ?? 21600,
  };
}

// ─── Setup inicial (chamado uma vez para inserir token no Supabase) ──
export async function setupBlingToken(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds = 21600
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  // Verifica se já existe um registro
  const { data: existing } = await supabaseAdmin
    .from('bling_tokens')
    .select('id')
    .limit(1)
    .single<{ id: number }>();

  if (existing) {
    await supabaseAdmin
      .from('bling_tokens')
      .update({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('bling_tokens')
      .insert({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt });
  }

  // Invalida cache
  _cache = null;
  console.log('[BlingToken] ✅ Token inicial salvo no Supabase. Expira:', expiresAt);
}
