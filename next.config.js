/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // ─── Headers de segurança HTTP ──────────────────────────────────────────
  // Aplicados em todas as respostas. Protegem contra XSS, clickjacking,
  // sniffing de MIME e outras ameaças comuns.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impede que o browser adivinhe o MIME type (evita ataques MIME-sniffing)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Impede que a página seja carregada em iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Força HTTPS por 1 ano (HSTS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Não envia Referer para outros domínios
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Desativa acesso a câmera, microfone e geolocalização
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Permite scripts/styles apenas do mesmo domínio + Vercel + Supabase
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval necessário para Next.js dev
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co https://viacep.com.br https://www.bling.com.br https://melhorenvio.com.br https://sandbox.melhorenvio.com.br",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      // CORS restritivo nas rotas de API — aceita apenas do próprio domínio
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'https://flavia-reversa.vercel.app',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
