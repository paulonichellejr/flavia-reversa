// ================================================
// TIPOS GLOBAIS — LOGÍSTICA REVERSA FLÁVIA ORGANIZA
// ================================================

export type StatusSolicitacao =
  | 'idle'
  | 'validando_pedido'
  | 'pedido_validado'
  | 'criando_bling'
  | 'gerando_etiqueta'
  | 'concluido'
  | 'erro';

export interface FormularioReversaData {
  nome: string;
  cpf: string;
  email: string;
  numeroPedido: string;
  itensSelecionados: number[];
  motivo: string;
  descricao: string;
  fotos: File[];
}

export interface PedidoTray {
  id: string;
  numero: string;
  status: string;
  data_criacao: string;
  valor_total: number;
  cliente: {
    nome: string;
    email: string;
    cpf: string;
    // Endereço para coleta (Melhor Envio)
    cep?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  itens: PedidoItem[];
}

export interface PedidoItem {
  id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface PedidoBling {
  id: string;
  numero: string;
  situacao: string;
}

export interface EtiquetaMelhorEnvio {
  id: string;
  protocolo: string;
  codigo_postagem: string;   // código para apresentar nos Correios (ex: AN739158057BR)
  url_etiqueta?: string;     // URL do PDF da etiqueta — salvo no Supabase (uso interno da loja)
  url_download?: string;     // URL pública do PDF da etiqueta+declaração de conteúdo (exibido ao cliente)
  instrucoes: string;
  prazo_postagem: string;
}

export interface LogReversa {
  id?: string;
  criado_em?: string;
  nome_cliente: string;
  cpf_cliente: string;
  numero_pedido_tray: string;
  numero_pedido_bling?: string;
  motivo: string;
  descricao?: string;
  fotos_urls?: string[];
  id_etiqueta?: string;
  url_etiqueta?: string;
  protocolo_etiqueta?: string;
  status: StatusSolicitacao;
  erro_mensagem?: string;
}

export interface RespostaAPI<T = unknown> {
  sucesso: boolean;
  dados?: T;
  mensagem?: string;
  erro?: string;
}
