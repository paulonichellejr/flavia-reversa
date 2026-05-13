/**
 * GET /api/auth/bling/callback
 *
 * Callback do OAuth 2.0 do Bling.
 * O Bling redireciona aqui após o usuário autorizar o app.
 *
 * Fluxo:
 *  1. Recebe o `code` do Bling via query string
 *  2. Troca o code por access_token + refresh_token
 *  3. Salva no Supabase (tabela bling_tokens)
 *  4. Exibe página de confirmação
 *
 * Esta URL precisa estar cadastrada exatamente no painel do Bling Developer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setupBlingToken } from '@/lib/bling-token';

const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code        = searchParams.get('code');
  const error       = searchParams.get('error');
  const stateParam  = searchParams.get('state');
  const stateCookie = req.cookies.get('bling_oauth_state')?.value;

  // Valida CSRF: o state retornado pelo Bling deve bater com o cookie salvo no início do fluxo
  if (!stateCookie || stateParam !== stateCookie) {
    console.error('[BlingOAuth Callback] Falha na validação CSRF — state não confere.');
    return paginaResultado({
      sucesso: false,
      titulo: 'Sessão inválida',
      mensagem: 'A sessão de autorização expirou ou foi adulterada. Inicie o fluxo novamente.',
    });
  }

  // Bling retornou erro de autorização
  if (error) {
    console.error('[BlingOAuth Callback] Erro retornado pelo Bling:', error);
    return paginaResultado({
      sucesso: false,
      titulo: 'Autorização negada',
      mensagem: `O Bling retornou um erro: ${error}. Tente novamente.`,
    });
  }

  if (!code) {
    return paginaResultado({
      sucesso: false,
      titulo: 'Código ausente',
      mensagem: 'O Bling não enviou o código de autorização. Inicie o fluxo novamente.',
    });
  }

  const clientId     = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const redirectUri  = process.env.BLING_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return paginaResultado({
      sucesso: false,
      titulo: 'Configuração incompleta',
      mensagem: 'Variáveis BLING_CLIENT_ID, BLING_CLIENT_SECRET ou BLING_REDIRECT_URI não configuradas no Vercel.',
    });
  }

  // Troca o code por tokens
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  let tokens: { access_token: string; refresh_token: string; expires_in: number };

  try {
    const res = await fetch(BLING_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization':  `Basic ${credentials}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Accept':         'application/json',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const json = await res.json();

    if (!res.ok || !json.access_token) {
      console.error('[BlingOAuth Callback] Falha ao trocar code por token:', json);
      return paginaResultado({
        sucesso: false,
        titulo: 'Falha na troca de tokens',
        mensagem: `Bling retornou: ${res.status} — ${JSON.stringify(json)}`,
      });
    }

    tokens = {
      access_token:  json.access_token,
      refresh_token: json.refresh_token,
      expires_in:    json.expires_in ?? 21600,
    };
  } catch (err) {
    console.error('[BlingOAuth Callback] Exceção ao trocar code:', err);
    return paginaResultado({
      sucesso: false,
      titulo: 'Erro de comunicação',
      mensagem: `Não foi possível conectar ao Bling: ${String(err)}`,
    });
  }

  // Salva tokens no Supabase
  try {
    await setupBlingToken(tokens.access_token, tokens.refresh_token, tokens.expires_in);
  } catch (err) {
    console.error('[BlingOAuth Callback] Erro ao salvar no Supabase:', err);
    return paginaResultado({
      sucesso: false,
      titulo: 'Tokens obtidos mas não salvos',
      mensagem: `Token Bling gerado, mas falhou ao salvar no Supabase: ${String(err)}. Verifique SUPABASE_SERVICE_ROLE_KEY.`,
    });
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  console.log('[BlingOAuth Callback] ✅ Tokens salvos com sucesso. Expira:', expiresAt.toISOString());

  return paginaResultado({
    sucesso: true,
    titulo: 'Bling conectado com sucesso! ✅',
    mensagem: `Tokens salvos no Supabase. Access token válido até ${expiresAt.toLocaleString('pt-BR')}. O sistema renovará automaticamente antes do vencimento.`,
  });
}

// ─── Página HTML de resultado ────────────────────────────────
function paginaResultado(p: { sucesso: boolean; titulo: string; mensagem: string }) {
  const cor    = p.sucesso ? '#16a34a' : '#dc2626';
  const fundo  = p.sucesso ? '#f0fdf4' : '#fef2f2';
  const borda  = p.sucesso ? '#86efac' : '#fca5a5';
  const icone  = p.sucesso ? '✅' : '❌';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${p.titulo} — Loja Flávia Organiza</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #faf8f5; display: flex;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
    .card { background: white; border-radius: 16px; padding: 40px 36px; max-width: 480px; width: 100%;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; }
    .badge { background: ${fundo}; border: 1px solid ${borda}; border-radius: 12px;
             padding: 20px 24px; margin: 20px 0; }
    h1 { color: ${cor}; font-size: 22px; margin: 0 0 8px; }
    p  { color: #4a3728; font-size: 15px; line-height: 1.6; margin: 0; }
    .sub { color: #9c7a5a; font-size: 13px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:48px; margin-bottom:16px;">${icone}</div>
    <h1>${p.titulo}</h1>
    <div class="badge"><p>${p.mensagem}</p></div>
    <p class="sub">🛍️ Loja Flávia Organiza — Logística Reversa</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
