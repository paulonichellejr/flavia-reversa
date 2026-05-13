import { FlaviaHeader } from '@/components/design-system';
import { FormularioReversa } from '@/components/reversa/FormularioReversa';

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      {/* Header */}
      <FlaviaHeader />

      {/* Conteúdo principal */}
      <main
        className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 pb-12"
        id="main-content"
      >
        <FormularioReversa />
      </main>

      {/* Rodapé */}
      <footer className="w-full border-t border-flavia-200 bg-white py-4 px-4 text-center text-xs text-mocha-400">
        <p>
          Dúvidas? Fale conosco pelo{' '}
          <a
            href="https://wa.me/5547992273939"
            className="text-sage-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </p>
        <p className="mt-1">
          © {new Date().getFullYear()} Loja Flávia Organiza. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
