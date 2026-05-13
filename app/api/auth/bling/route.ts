/**
 * GET /api/auth/bling
 *
 * Inicia o fluxo OAuth 2.0 do Bling — redireciona para a tela de autorização.
 *
 * COMO USAR:
 * Quando o token expirar (ou na primeira configuração), acesse no navegador:
 *   https://sua-url.vercel.app/api/auth/bling?secret=SEU_CRON_SECRET
 *
 * O Bling irá pedir login e autorização. Após confirmar, redireciona
 * automaticamente para /api/auth/bling/callback com os novos tokens.
 *
 * PRÉ-REQUISITOS no Vercel:
 *   BLING_CLIENT_ID       → ID do app no painel Bling
 *   BLING_CLIENT_SECRET   → Secret do app no painel Bling
 *   BLING_REDIRECT_URI    → https://sua-url.vercel.app/api/auth/bling/callback
 *   CRON_SECRET           → senha para proteger este endpoint
 *
 * PRÉ-REQUISITO no painel Bling (developer):
 *   Cadastre a URL de callback exatamente igual ao BLING_REDIRECT_URI acima.
 */

import { NextRequest, NextResponse } from 'next/server';

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';

export async function GET(req: NextRequest) {
  // Proteção: verifica o secret para não expor o endpoint publicamente
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== cronSecret) {
      return NextResponse.json(
        { erro: 'Acesso não autorizado. Informe ?secret=SEU_CRON_SECRET na URL.' },
        { status: 401 }
      );
    }
  }

  const clientId     = process.env.BLING_CLIENT_ID;
  const redirectUri  = process.env.BLING_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        erro: 'Variáveis de ambiente não configuradas.',
        faltando: [
          !clientId    && 'BLING_CLIENT_ID',
          !redirectUri && 'BLING_REDIRECT_URI',
        ].filter(Boolean),
      },
      { status: 500 }
    );
  }

  // State aleatório para proteção CSRF
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL(BLING_AUTH_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  console.log('[BlingOAuth] Redirecionando para autorização Bling:', authUrl.toString());

  return NextResponse.redirect(authUrl.toString());
}
