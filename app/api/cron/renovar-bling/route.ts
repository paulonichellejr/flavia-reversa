/**
 * POST /api/cron/renovar-bling
 *
 * Renova o token do Bling via refresh_token e salva no Supabase.
 * Configure no cron-job.org para chamar a cada 5 horas:
 *   URL:    https://sua-url.vercel.app/api/cron/renovar-bling
 *   Method: POST
 *   Header: Authorization: Bearer {CRON_SECRET}
 *
 * GET /api/cron/renovar-bling
 * Diagnóstico: mostra o estado atual do token e orienta o próximo passo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBlingToken, refreshBlingOAuth } from '@/lib/bling-token';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/auth-admin';

export const maxDuration = 30;

// ─── POST — renova forçadamente (chamado pelo cron) ──────────
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // CRON_SECRET é obrigatório — sem ele bloqueia tudo por segurança
  if (!cronSecret) {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado no Vercel.' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { data: row } = await supabaseAdmin
      .from('bling_tokens')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single<{ id: number; refresh_token: string; expires_at: string }>();

    if (!row) {
      const reAuthUrl = _reAuthUrl(req);
      return NextResponse.json({
        erro: 'Nenhum token encontrado no Supabase.',
        acao: `Autorize o app em: ${reAuthUrl}`,
      }, { status: 404 });
    }

    try {
      const newTokens = await refreshBlingOAuth(row.refresh_token);
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in ?? 21600) * 1000).toISOString();

      await supabaseAdmin
        .from('bling_tokens')
        .update({
          access_token:  newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at:    newExpiresAt,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', row.id);

      console.log('[CronBling] ✅ Token renovado. Expira:', newExpiresAt);
      return NextResponse.json({ sucesso: true, mensagem: 'Token renovado', expires_at: newExpiresAt });

    } catch (refreshErr) {
      // refresh_token inválido ou expirado → precisa re-autenticar
      const reAuthUrl = _reAuthUrl(req);
      console.error('[CronBling] ❌ Refresh falhou — refresh_token expirado ou inválido:', refreshErr);
      return NextResponse.json({
        erro: 'Refresh token inválido ou expirado.',
        acao: `Re-autorize o app acessando: ${reAuthUrl}`,
        detalhe: String(refreshErr),
      }, { status: 401 });
    }

  } catch (e) {
    console.error('[CronBling] Erro geral:', e);
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}

// ─── GET — diagnóstico completo do token ─────────────────────
export async function GET(req: NextRequest) {
  const auth = verificarAdmin(req);
  if (auth) return auth;

  const reAuthUrl = _reAuthUrl(req);

  try {
    // 1. Busca registro no Supabase
    const { data: row } = await supabaseAdmin
      .from('bling_tokens')
      .select('expires_at, updated_at')
      .order('id', { ascending: false })
      .limit(1)
      .single<{ expires_at: string; updated_at: string }>();

    if (!row) {
      return NextResponse.json({
        status: '❌ SEM TOKEN',
        problema: 'Nenhum token no Supabase.',
        acao: `Acesse para autorizar: ${reAuthUrl}`,
      }, { status: 404 });
    }

    const expiresAt  = new Date(row.expires_at);
    const agora      = new Date();
    const minutosRestantes = Math.floor((expiresAt.getTime() - agora.getTime()) / 60000);
    const expirado   = minutosRestantes <= 0;

    // 2. Testa o token atual contra a API do Bling
    let tokenValido = false;
    let blingStatus = 0;
    let erroRefresh = '';

    try {
      const token = await getBlingToken(); // auto-renova se possível
      const res = await fetch('https://www.bling.com.br/Api/v3/pedidos/vendas?limite=1', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      tokenValido = res.ok;
      blingStatus = res.status;
    } catch (e) {
      erroRefresh = String(e);
    }

    // 3. Monta diagnóstico
    const status = tokenValido
      ? `✅ VÁLIDO (expira em ${minutosRestantes} min)`
      : expirado
        ? '❌ EXPIRADO — re-autorização necessária'
        : `⚠️ INVÁLIDO (expira em ${minutosRestantes} min) — refresh falhou`;

    return NextResponse.json({
      status,
      token_valido:        tokenValido,
      bling_http_status:   blingStatus,
      expires_at:          row.expires_at,
      updated_at:          row.updated_at,
      minutos_restantes:   minutosRestantes,
      ...(erroRefresh && { erro_refresh: erroRefresh }),
      ...(!tokenValido && { acao: `Re-autorize em: ${reAuthUrl}` }),
    });

  } catch (e) {
    return NextResponse.json({
      status: '❌ ERRO',
      erro: String(e),
      acao: `Re-autorize em: ${reAuthUrl}`,
    }, { status: 500 });
  }
}

// ─── Helper: monta URL de re-autorização (sem expor CRON_SECRET) ─────────────
// O secret NÃO é incluído na URL retornada em respostas JSON —
// quem precisar re-autorizar já conhece o secret.
function _reAuthUrl(req: Request | NextRequest): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (req as NextRequest).nextUrl?.origin
    ?? 'https://sua-url.vercel.app';
  return `${baseUrl}/api/auth/bling`;
}
