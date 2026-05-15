'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FlaviaButton,
  FlaviaInput,
  FlaviaCard,
  FlaviaSelect,
  FlaviaTextarea,
} from '@/components/design-system';
import { UploadFotos } from './UploadFotos';
import { StatusSolicitacaoCard } from './StatusSolicitacao';
import type { StatusSolicitacao, EtiquetaMelhorEnvio } from '@/types';
import type { ItemPedido, PedidoConsulta } from '@/app/api/reversa/pedido/route';

// ─── Validação com Zod ───────────────────────────────────────
const schema = z.object({
  nome: z
    .string()
    .min(3, 'Por favor, informe seu nome completo (mín. 3 caracteres).')
    .max(120),
  cpf: z
    .string()
    .regex(
      /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/,
      'CPF inválido. Use o formato 000.000.000-00.'
    ),
  email: z
    .string()
    .email('E-mail inválido. Use o formato nome@exemplo.com.')
    .max(120),
  numeroPedido: z
    .string()
    .min(4, 'O número do pedido deve ter pelo menos 4 caracteres.')
    .max(40),
  motivo: z.string().min(1, 'Por favor, selecione o motivo da devolução.'),
  descricao: z
    .string()
    .min(15, 'Conta um pouquinho mais sobre o problema (mín. 15 caracteres).')
    .max(600, 'Ops! Máximo de 600 caracteres.'),
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido. Use o formato 00000-000.'),
  endereco: z.string().min(3, 'Informe o endereço.'),
  numero: z.string().min(1, 'Informe o número.'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Informe o bairro.'),
  cidade: z.string().min(2, 'Informe a cidade.'),
  uf: z.string().length(2, 'Informe o estado (ex: SC).'),
});

type FormData = z.infer<typeof schema>;

const MOTIVOS = [
  { value: 'produto_defeituoso', label: 'Produto com defeito' },
  { value: 'produto_errado', label: 'Recebi o produto errado' },
  { value: 'produto_avariado', label: 'Produto chegou avariado' },
  { value: 'nao_gostei', label: 'Não gostei do produto' },
  { value: 'tamanho_errado', label: 'Tamanho/medida incorreta' },
  { value: 'arrependimento', label: 'Me arrependi da compra' },
  { value: 'outro', label: 'Outro motivo' },
];

// ─── Componente ───────────────────────────────────────────────
export function FormularioReversa() {
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosErro, setFotosErro] = useState('');
  const [status, setStatus] = useState<StatusSolicitacao>('idle');
  const [etiqueta, setEtiqueta] = useState<EtiquetaMelhorEnvio | undefined>();
  const [erroMensagem, setErroMensagem] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Etapas do formulário
  const [etapa, setEtapa] = useState<'identificacao' | 'detalhes'>('identificacao');
  const [buscandoPedido, setBuscandoPedido] = useState(false);
  const [erroBuscaPedido, setErroBuscaPedido] = useState('');
  const [pedidoEncontrado, setPedidoEncontrado] = useState<PedidoConsulta | null>(null);
  const [itensSelecionados, setItensSelecionados] = useState<{ id: number; quantidade: number }[]>([]);
  const [erroItens, setErroItens] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { motivo: '' },
  });

  const descricaoValue = watch('descricao', '');
  const motivoValue    = watch('motivo', '');

  // Motivos que exigem foto obrigatória
  const MOTIVOS_COM_FOTO = ['produto_defeituoso', 'produto_avariado', 'produto_errado'];
  const fotoObrigatoria  = MOTIVOS_COM_FOTO.includes(motivoValue);

  // ── Busca endereço pelo CEP ──────────────────────────────────
  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue('endereco', data.logradouro || '', { shouldValidate: true });
        setValue('bairro', data.bairro || '', { shouldValidate: true });
        setValue('cidade', data.localidade || '', { shouldValidate: true });
        setValue('uf', data.uf || '', { shouldValidate: true });
      }
    } catch { /* silencia erro de rede */ }
    finally { setBuscandoCep(false); }
  };

  const formatarCEP = (valor: string) =>
    valor.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);

  const formatarCPF = (valor: string) =>
    valor
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);

  // ── Toggle e controle de quantidade por item ─────────────────
  const toggleItem = (id: number, qtdMax: number) => {
    setItensSelecionados((prev) => {
      const existe = prev.find((i) => i.id === id);
      if (existe) return prev.filter((i) => i.id !== id);
      return [...prev, { id, quantidade: qtdMax }]; // seleciona com qtd máxima por padrão
    });
    setErroItens('');
  };

  const alterarQuantidade = (id: number, delta: number, qtdMax: number) => {
    setItensSelecionados((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const nova = Math.min(qtdMax, Math.max(1, i.quantidade + delta));
        return { ...i, quantidade: nova };
      })
    );
  };

  // ── Etapa 1: busca e valida o pedido ────────────────────────
  const buscarPedido = async () => {
    const { nome, cpf, email, numeroPedido } = getValues();

    if (!nome || !cpf || !email || !numeroPedido) {
      setErroBuscaPedido('Preencha nome, CPF, e-mail e número do pedido antes de continuar.');
      return;
    }

    const cpfOk = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(cpf);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!cpfOk) { setErroBuscaPedido('CPF inválido. Use o formato 000.000.000-00.'); return; }
    if (!emailOk) { setErroBuscaPedido('E-mail inválido.'); return; }

    setErroBuscaPedido('');
    setBuscandoPedido(true);
    setPedidoEncontrado(null);
    setItensSelecionados([]);

    try {
      const params = new URLSearchParams({ numero: numeroPedido, cpf });
      const res = await fetch(`/api/reversa/pedido?${params}`);
      const json = await res.json();

      if (!res.ok || !json.sucesso) {
        setErroBuscaPedido(json.erro || 'Não conseguimos encontrar esse pedido. Confira os dados e tente novamente.');
        return;
      }

      setPedidoEncontrado(json.dados);
      // Pré-seleciona todos os itens com quantidade máxima
      setItensSelecionados(json.dados.itens.map((i: ItemPedido) => ({ id: i.id, quantidade: i.quantidade })));
      setEtapa('detalhes');
    } catch {
      setErroBuscaPedido('Problema de conexão. Tente novamente em instantes.');
    } finally {
      setBuscandoPedido(false);
    }
  };

  // ── Etapa 2: submete o formulário completo ───────────────────
  const onSubmit = async (data: FormData) => {
    if (fotoObrigatoria && fotos.length === 0) {
      setFotosErro('Para este motivo, adicione pelo menos uma foto do produto para continuar.');
      return;
    }
    if (itensSelecionados.length === 0) {
      setErroItens('Selecione pelo menos um item para devolver.');
      return;
    }
    if (itensSelecionados.some((i) => i.quantidade < 1)) {
      setErroItens('A quantidade de cada item deve ser pelo menos 1.');
      return;
    }
    setFotosErro('');
    setErroItens('');
    setErroMensagem('');

    try {
      setStatus('validando_pedido');

      const formData = new FormData();
      formData.append('nome', data.nome);
      formData.append('cpf', data.cpf);
      formData.append('email', data.email);
      formData.append('numeroPedido', data.numeroPedido);
      formData.append('itensSelecionados', JSON.stringify(itensSelecionados));
      formData.append('motivo', data.motivo);
      formData.append('descricao', data.descricao);
      formData.append('cep', data.cep);
      formData.append('endereco', data.endereco);
      formData.append('numero', data.numero);
      formData.append('complemento', data.complemento || '');
      formData.append('bairro', data.bairro);
      formData.append('cidade', data.cidade);
      formData.append('uf', data.uf);
      fotos.forEach((f) => formData.append('fotos', f));

      const resposta = await fetch('/api/reversa', {
        method: 'POST',
        body: formData,
      });

      const json = await resposta.json();

      if (!resposta.ok || !json.sucesso) {
        setStatus('erro');
        setErroMensagem(json.erro || 'Algo inesperado aconteceu. Tente novamente.');
        return;
      }

      setEtiqueta(json.dados?.etiqueta);
      setStatus('concluido');
    } catch {
      setStatus('erro');
      setErroMensagem('Não conseguimos processar sua solicitação agora. Tente novamente em alguns instantes.');
    }
  };

  const reiniciar = () => {
    reset();
    setFotos([]);
    setFotosErro('');
    setStatus('idle');
    setEtiqueta(undefined);
    setErroMensagem('');
    setEtapa('identificacao');
    setPedidoEncontrado(null);
    setItensSelecionados([]);
    setErroBuscaPedido('');
    setErroItens('');
  };

  const formularioVisivel = status === 'idle' || status === 'validando_pedido';

  return (
    <div className="space-y-6 animate-fade-in">
      <StatusSolicitacaoCard
        status={status}
        etiqueta={etiqueta}
        erro={erroMensagem}
        numeroPedido={watch('numeroPedido')}
        onReiniciar={reiniciar}
      />

      {formularioVisivel && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Formulário de solicitação de troca ou devolução">
          <FlaviaCard variant="default" padding="lg" className="space-y-5">

            {/* ── Cabeçalho ── */}
            <div>
              <h2 className="text-lg font-display font-semibold" style={{ color: '#333333' }}>
                Dados da solicitação
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#706E6F' }}>
                Preencha os campos abaixo e envie as fotos do produto. Vamos resolver tudo com muito cuidado! 💛
              </p>
            </div>

            {/* ── ETAPA 1: Identificação ── */}
            <FlaviaInput
              label="Nome completo"
              placeholder="Seu nome como está no cadastro"
              required
              error={errors.nome?.message}
              {...register('nome')}
            />

            <FlaviaInput
              label="CPF"
              placeholder="000.000.000-00"
              inputMode="numeric"
              required
              error={errors.cpf?.message}
              hint="O mesmo CPF utilizado na compra"
              {...register('cpf', {
                onChange: (e) => { e.target.value = formatarCPF(e.target.value); },
              })}
            />

            <FlaviaInput
              label="E-mail"
              placeholder="seu@email.com.br"
              inputMode="email"
              type="email"
              required
              error={errors.email?.message}
              hint="O código de postagem será enviado para este e-mail pelo Melhor Envio"
              {...register('email')}
            />

            <FlaviaInput
              label="Número do pedido"
              placeholder="Ex: 16866 ou 13103"
              inputMode="numeric"
              required
              error={errors.numeroPedido?.message}
              hint="Pode ser o número do e-mail de confirmação da loja virtual ou o número do pedido no Bling"
              {...register('numeroPedido')}
            />

            {/* Erro da busca */}
            {erroBuscaPedido && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-flavia">
                {erroBuscaPedido}
              </p>
            )}

            {/* Botão buscar pedido (só na etapa 1) */}
            {etapa === 'identificacao' && (
              <FlaviaButton
                type="button"
                fullWidth
                size="lg"
                loading={buscandoPedido}
                onClick={buscarPedido}
              >
                {buscandoPedido ? 'Buscando seu pedido...' : 'Buscar meu pedido →'}
              </FlaviaButton>
            )}

            {/* ── ETAPA 2: Itens + Detalhes (após pedido encontrado) ── */}
            {etapa === 'detalhes' && pedidoEncontrado && (
              <>
                {/* Confirmação do pedido encontrado */}
                <div
                  className="rounded-flavia px-4 py-3 text-sm flex items-center gap-2"
                  style={{ backgroundColor: '#F0F7F0', border: '1px solid #C3DEC3', color: '#2D6A2D' }}
                >
                  ✅ Pedido <strong>#{pedidoEncontrado.numeroLoja || pedidoEncontrado.numero}</strong> encontrado!
                  <button
                    type="button"
                    className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                    onClick={() => { setEtapa('identificacao'); setPedidoEncontrado(null); setErroBuscaPedido(''); }}
                  >
                    Alterar
                  </button>
                </div>

                {/* Seleção de itens */}
                <div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: '#333333' }}>
                    Quais itens deseja devolver?
                  </h3>
                  <p className="text-xs mb-3" style={{ color: '#706E6F' }}>
                    Selecione apenas os produtos que serão devolvidos.
                  </p>

                  <div className="space-y-2">
                    {pedidoEncontrado.itens.map((item) => {
                      const sel = itensSelecionados.find((i) => i.id === item.id);
                      const selecionado = !!sel;
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-flavia transition-colors"
                          style={{
                            border: `1px solid ${selecionado ? '#8B6F47' : '#DED5C8'}`,
                            backgroundColor: selecionado ? '#FAF6F1' : '#FFFFFF',
                          }}
                        >
                          {/* Linha principal: checkbox + nome */}
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => toggleItem(item.id, item.quantidade)}
                              className="mt-0.5 h-4 w-4 rounded accent-amber-700 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-mocha-800 leading-snug">
                                {item.descricao}
                              </p>
                              <p className="text-xs text-mocha-500 mt-0.5">
                                R$ {item.valor.toFixed(2).replace('.', ',')} por unidade
                                {item.quantidade > 1 && ` · ${item.quantidade} unidades no pedido`}
                              </p>
                            </div>
                          </label>

                          {/* Seletor de quantidade — aparece apenas quando selecionado e qtd > 1 */}
                          {selecionado && item.quantidade > 1 && (
                            <div className="flex items-center gap-3 mt-2 ml-7">
                              <span className="text-xs text-mocha-600">Devolver:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => alterarQuantidade(item.id, -1, item.quantidade)}
                                  disabled={sel.quantidade <= 1}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
                                  style={{ border: '1px solid #8B6F47', color: '#8B6F47' }}
                                >
                                  −
                                </button>
                                <span className="w-8 text-center text-sm font-semibold text-mocha-800">
                                  {sel.quantidade}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => alterarQuantidade(item.id, +1, item.quantidade)}
                                  disabled={sel.quantidade >= item.quantidade}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
                                  style={{ border: '1px solid #8B6F47', color: '#8B6F47' }}
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-xs text-mocha-400">
                                de {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {erroItens && (
                    <p className="text-sm text-red-600 mt-2">{erroItens}</p>
                  )}
                </div>

                {/* Motivo */}
                <FlaviaSelect
                  label="Motivo da devolução"
                  placeholder="Selecione o motivo..."
                  required
                  options={MOTIVOS}
                  error={errors.motivo?.message}
                  {...register('motivo')}
                />

                {/* Descrição */}
                <FlaviaTextarea
                  label="Descreva o problema"
                  placeholder="Conte com detalhes o que aconteceu com o produto. Quanto mais informações, mais rápido conseguimos resolver!"
                  required
                  error={errors.descricao?.message}
                  maxChars={600}
                  currentChars={descricaoValue?.length || 0}
                  {...register('descricao')}
                />

                {/* ── Endereço ── */}
                <div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: '#333333' }}>
                    📍 Seu endereço
                  </h3>
                  <p className="text-xs mb-3" style={{ color: '#706E6F' }}>
                    Será usado na etiqueta de postagem gerada pelos Correios.
                  </p>
                  <div className="space-y-4">
                    <FlaviaInput
                      label="CEP"
                      placeholder="00000-000"
                      inputMode="numeric"
                      required
                      error={errors.cep?.message}
                      hint={buscandoCep ? '🔍 Buscando endereço...' : 'Informe seu CEP para preenchimento automático'}
                      {...register('cep', {
                        onChange: (e) => {
                          e.target.value = formatarCEP(e.target.value);
                          if (e.target.value.replace(/\D/g, '').length === 8) buscarCep(e.target.value);
                        },
                      })}
                    />

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <FlaviaInput
                          label="Endereço"
                          placeholder="Rua, Avenida..."
                          required
                          error={errors.endereco?.message}
                          {...register('endereco')}
                        />
                      </div>
                      <div>
                        <FlaviaInput
                          label="Número"
                          placeholder="Nº"
                          required
                          error={errors.numero?.message}
                          {...register('numero')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FlaviaInput
                        label="Complemento"
                        placeholder="Apto, Bloco..."
                        error={errors.complemento?.message}
                        {...register('complemento')}
                      />
                      <FlaviaInput
                        label="Bairro"
                        placeholder="Bairro"
                        required
                        error={errors.bairro?.message}
                        {...register('bairro')}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <FlaviaInput
                          label="Cidade"
                          placeholder="Sua cidade"
                          required
                          error={errors.cidade?.message}
                          {...register('cidade')}
                        />
                      </div>
                      <div>
                        <FlaviaInput
                          label="Estado"
                          placeholder="SC"
                          maxLength={2}
                          required
                          error={errors.uf?.message}
                          {...register('uf', {
                            onChange: (e) => { e.target.value = e.target.value.toUpperCase(); },
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload de fotos */}
                <UploadFotos
                  fotos={fotos}
                  onChange={setFotos}
                  error={fotosErro}
                  maxFotos={5}
                />

                {/* Aviso de prazo */}
                <div
                  className="rounded-flavia px-4 py-3 text-sm"
                  style={{ backgroundColor: '#F7F5F2', border: '1px solid #DED5C8', color: '#485059' }}
                >
                  ⏰ <strong>Lembre-se:</strong> o prazo para solicitar trocas e devoluções é de <strong>7 dias</strong> após o recebimento do produto.
                </div>

                {/* Botão enviar */}
                <FlaviaButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={isSubmitting || status === 'validando_pedido'}
                >
                  {isSubmitting || status === 'validando_pedido'
                    ? 'Processando...'
                    : 'Solicitar troca ou devolução'}
                </FlaviaButton>
              </>
            )}
          </FlaviaCard>
        </form>
      )}

      {status === 'concluido' && (
        <div className="flex justify-center pt-2">
          <FlaviaButton variant="ghost" size="sm" onClick={reiniciar}>
            Fazer nova solicitação
          </FlaviaButton>
        </div>
      )}
    </div>
  );
}
