/**
 * Autenticação de endpoints administrativos/debug.
 *
 * USO:
 *   import { verificarAdmin } from '@/lib/auth-admin';
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = verificarAdmin(req);
 *     if (auth) return auth; // retorna 401 se não autorizado
 *     // ... lógica do endpoint
 *   }
 *
 * Passa se:
 *   - Authorization: Bearer <CRON_SECRET>  (header)
 *   - ?secret=<CRON_SECRET>                (query param — conveniente no browser)
 */

import { NextRequest, NextResponse } from 'next/server';

export function verificarAdmin(req: NextRequest | Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // Se CRON_SECRET não estiver configurado, bloqueia tudo por segurança
  if (!secret) {
    console.error('[Auth] CRON_SECRET não configurado — endpoint bloqueado por segurança.');
    return NextResponse.json(
      { erro: 'Endpoint administrativo indisponível. Configure CRON_SECRET no Vercel.' },
      { status: 503 }
    );
  }

  // Verifica Authorization: Bearer <secret>
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader === `Bearer ${secret}`) return null; // autorizado

  // Verifica ?secret=<secret> (para abrir no browser)
  const url = req instanceof NextRequest ? req.nextUrl : new URL(req.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === secret) return null; // autorizado

  return NextResponse.json(
    { erro: 'Acesso não autorizado. Passe Authorization: Bearer <CRON_SECRET> ou ?secret=<CRON_SECRET>.' },
    { status: 401 }
  );
}
