/**
 * POST /api/setup/bling-token
 *
 * Setup inicial: insere o token atual do Bling (vindo das env vars) no Supabase.
 * Execute UMA VEZ após o deploy para migrar do .env para o Supabase.
 *
 * PROTEGIDO: requer Authorization: Bearer <CRON_SECRET> ou ?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { setupBlingToken } from '@/lib/bling-token';
import { verificarAdmin } from '@/lib/auth-admin';

async function executarSetup() {
  const accessToken  = process.env.BLING_API_KEY;
  const refreshToken = process.env.BLING_REFRESH_TOKEN;

  if (!accessToken || !refreshToken) {
    return NextResponse.json({
      erro: 'BLING_API_KEY e BLING_REFRESH_TOKEN precisam estar nas variáveis de ambiente do Vercel.',
    }, { status: 400 });
  }

  await setupBlingToken(accessToken, refreshToken);
  return NextResponse.json({
    sucesso: true,
    mensagem: '✅ Token Bling salvo no Supabase! A partir de agora o refresh é automático.',
  });
}

// GET — acesse direto pelo navegador com ?secret=CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = verificarAdmin(req);
  if (auth) return auth;
  try {
    return await executarSetup();
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}

// POST — para chamadas via curl/Postman com Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const auth = verificarAdmin(req);
  if (auth) return auth;
  try {
    return await executarSetup();
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
