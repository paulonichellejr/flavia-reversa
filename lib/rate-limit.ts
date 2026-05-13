/**
 * Rate limiting simples em memória para Next.js / Vercel.
 *
 * Funcionamento:
 *   - Cada "janela" é resetada após `windowMs` milissegundos
 *   - Se um IP fizer mais de `max` requisições na janela → retorna 429
 *   - Em memória: funciona bem no Vercel (cada lambda tem sua instância)
 *     Para escalar horizontalmente use Upstash Redis.
 *
 * USO:
 *   import { rateLimit } from '@/lib/rate-limit';
 *
 *   const limited = rateLimit(req, { max: 5, windowMs: 60_000 });
 *   if (limited) return limited; // retorna NextResponse 429
 */

import { NextRequest, NextResponse } from 'next/server';

interface Options {
  max: number;       // máximo de requisições na janela
  windowMs: number;  // duração da janela em ms
}

const store = new Map<string, { count: number; resetAt: number }>();

// Limpa entradas expiradas a cada 5 minutos para evitar memory leak
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}, 5 * 60 * 1000);

export function rateLimit(
  req: NextRequest | Request,
  opts: Options
): NextResponse | null {
  // Extrai IP do cliente
  const ip =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    (req.headers.get('x-real-ip') ?? '') ||
    'unknown';

  // Chave única por IP + URL path
  const url = req instanceof NextRequest ? req.nextUrl.pathname : new URL(req.url).pathname;
  const key = `${ip}::${url}`;

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Janela nova
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null; // permitido
  }

  entry.count += 1;

  if (entry.count > opts.max) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    console.warn(`[RateLimit] IP ${ip} bloqueado em ${url} (${entry.count}/${opts.max})`);
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(opts.max),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null; // permitido
}
