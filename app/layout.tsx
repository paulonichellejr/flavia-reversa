import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Troca e Devolução | Loja Flávia Organiza',
  description:
    'Solicite sua troca ou devolução de forma simples e rápida. Estamos aqui para resolver tudo com cuidado.',
  robots: { index: false, follow: false }, // Não indexar páginas internas
  openGraph: {
    title: 'Troca e Devolução | Loja Flávia Organiza',
    description: 'Processo de devolução simples, rápido e sem complicação.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#B07880',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
