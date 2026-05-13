import Image from 'next/image';
import Link from 'next/link';


interface FlaviaHeaderProps {
  titulo?: string;
  subtitulo?: string;
  mostrarLogo?: boolean;
}

export function FlaviaHeader({
  titulo = 'Troca e Devolução',
  subtitulo = 'Estamos aqui para ajudar você a resolver rapidinho 💛',
  mostrarLogo = true,
}: FlaviaHeaderProps) {
  return (
    <header className="w-full bg-white shadow-flavia" style={{ borderBottom: '1px solid #DED5C8' }}>
      {/* Barra do topo — rosa-mauve real #D2B6C2 */}
      <div className="w-full py-1.5 text-center" style={{ backgroundColor: '#D2B6C2' }}>
        <p className="text-xs tracking-wide" style={{ color: '#485059' }}>
          Olá, seja bem-vindo(a)!
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col items-center gap-2">
        {mostrarLogo && (
          <Link
            href="https://www.lojaflaviaorganiza.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
            aria-label="Ir para a Loja Flávia Organiza"
          >
            <Image
              src="/logo.png"
              alt="Flávia Organiza"
              width={160}
              height={52}
              priority
              style={{ objectFit: 'contain', height: '52px', width: 'auto' }}
            />
          </Link>
        )}

        <div className="text-center">
          <h1 className="text-xl font-display font-semibold" style={{ color: '#333333' }}>
            {titulo}
          </h1>
          {subtitulo && (
            <p className="text-sm mt-0.5" style={{ color: '#706E6F' }}>{subtitulo}</p>
          )}
        </div>
      </div>
    </header>
  );
}
