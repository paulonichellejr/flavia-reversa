'use client';

import { CheckCircle2, Loader2, XCircle, Package, Truck, ClipboardCheck, Mail } from 'lucide-react';
import { FlaviaCard, FlaviaButton } from '@/components/design-system';
import type { StatusSolicitacao as TStatus, EtiquetaMelhorEnvio } from '@/types';
import { clsx } from 'clsx';

interface StatusSolicitacaoProps {
  status: TStatus;
  etiqueta?: EtiquetaMelhorEnvio;
  erro?: string;
  numeroPedido?: string;
  onReiniciar: () => void;
}

type Etapa = {
  id: TStatus[];
  label: string;
  icon: typeof Loader2;
};

const ETAPAS: Etapa[] = [
  { id: ['validando_pedido', 'pedido_validado'], label: 'Pedido validado', icon: ClipboardCheck },
  { id: ['criando_bling'], label: 'Processo registrado', icon: Package },
  { id: ['gerando_etiqueta', 'concluido'], label: 'Etiqueta gerada', icon: Truck },
];

const ORDEM_STATUS: TStatus[] = [
  'idle',
  'validando_pedido',
  'pedido_validado',
  'criando_bling',
  'gerando_etiqueta',
  'concluido',
  'erro',
];

function getEtapaAtual(status: TStatus) {
  return ORDEM_STATUS.indexOf(status);
}

export function StatusSolicitacaoCard({
  status,
  etiqueta,
  erro,
  numeroPedido,
  onReiniciar,
}: StatusSolicitacaoProps) {
  const etapaAtual = getEtapaAtual(status);
  const isCarregando = ['validando_pedido', 'criando_bling', 'gerando_etiqueta'].includes(status);
  const isConcluido = status === 'concluido';
  const isErro = status === 'erro';

  if (status === 'idle') return null;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Progresso visual */}
      {!isErro && (
        <div className="flex items-center justify-between gap-1 px-2">
          {ETAPAS.map((etapa, i) => {
            const etapaIdx = getEtapaAtual(etapa.id[etapa.id.length - 1]);
            const concluida = etapaAtual > etapaIdx;
            const ativa = etapa.id.includes(status);
            const Icon = etapa.icon;

            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
                    concluida && 'bg-success-500 text-white',
                    ativa && !concluida && 'bg-flavia-500 text-white ring-4 ring-flavia-200',
                    !ativa && !concluida && 'bg-cream-200 text-mocha-500'
                  )}
                  aria-hidden="true"
                >
                  {ativa && !concluida ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={clsx(
                    'text-xs text-center leading-tight',
                    (concluida || ativa) ? 'text-mocha-700 font-medium' : 'text-mocha-400'
                  )}
                >
                  {etapa.label}
                </span>
                {/* Linha conectora */}
                {i < ETAPAS.length - 1 && (
                  <div
                    className={clsx(
                      'absolute h-0.5 w-full',
                      concluida ? 'bg-success-500' : 'bg-cream-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mensagem de carregamento */}
      {isCarregando && (
        <FlaviaCard variant="default" padding="md">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-flavia-500 animate-spin shrink-0" />
            <div>
              <p className="font-medium text-mocha-800">
                {status === 'validando_pedido' && 'Verificando seu pedido...'}
                {status === 'criando_bling' && 'Registrando o processo de devolução...'}
                {status === 'gerando_etiqueta' && 'Gerando sua etiqueta de envio...'}
              </p>
              <p className="text-sm text-mocha-500">Aguarde um instante, estamos cuidando de tudo 💛</p>
            </div>
          </div>
        </FlaviaCard>
      )}

      {/* Sucesso */}
      {isConcluido && etiqueta && (
        <FlaviaCard variant="success" padding="md" className="animate-slide-up">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-success-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-success-700 text-lg">
                  Tudo pronto! 🎉
                </h2>
                <p className="text-sm text-mocha-700 mt-1">
                  Sua solicitação de devolução foi recebida com carinho e já estamos processando tudo por aqui.
                  {numeroPedido && ` Protocolo referente ao pedido #${numeroPedido}.`}
                </p>
              </div>
            </div>

            {/* Código de postagem */}
            <div className="bg-white rounded-flavia p-4 border border-success-500/20">
              <p className="text-sm font-semibold text-mocha-800 mb-1">
                📦 Seu código de postagem
              </p>
              <p className="text-xs text-mocha-600 mb-3">
                {etiqueta.instrucoes}
              </p>

              {/* Código destacado */}
              {etiqueta.codigo_postagem && (
                <div className="bg-mocha-50 border-2 border-dashed border-mocha-300 rounded-flavia px-4 py-3 mb-3 text-center">
                  <p className="text-xs text-mocha-500 mb-1 uppercase tracking-wide font-medium">
                    Código para apresentar nos Correios
                  </p>
                  <p className="text-xl font-bold tracking-widest text-mocha-900 select-all">
                    {etiqueta.codigo_postagem}
                  </p>
                  <p className="text-xs text-mocha-400 mt-1">
                    Toque para selecionar
                  </p>
                </div>
              )}

              <p className="text-xs text-mocha-500">
                ⏰ Prazo para postagem: <strong>{etiqueta.prazo_postagem}</strong>
              </p>
            </div>

            {/* Aviso: PDF enviado por e-mail */}
            <div className="flex items-start gap-3 bg-flavia-50 border border-flavia-200 rounded-flavia px-4 py-3">
              <Mail className="h-5 w-5 text-flavia-500 shrink-0 mt-0.5" />
              <p className="text-sm text-mocha-700 leading-relaxed">
                O <strong>PDF com a etiqueta e a Declaração de Conteúdo</strong> foi enviado para o seu e-mail.
                Imprima, cole na embalagem e leve até qualquer agência dos Correios. O envio é gratuito! 💛
              </p>
            </div>
          </div>
        </FlaviaCard>
      )}

      {/* Erro */}
      {isErro && (
        <FlaviaCard variant="danger" padding="md" className="animate-slide-up">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-danger-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-danger-700">
                  Algo não saiu como esperado
                </h2>
                <p className="text-sm text-mocha-700 mt-1">
                  {erro || 'Tivemos um problema inesperado. Nossa equipe já foi notificada e entrará em contato em breve.'}
                </p>
              </div>
            </div>
            <FlaviaButton variant="secondary" size="sm" onClick={onReiniciar}>
              Tentar novamente
            </FlaviaButton>
          </div>
        </FlaviaCard>
      )}
    </div>
  );
}
