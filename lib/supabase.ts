import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Chave de serviço — usada apenas no servidor (API routes).
// Bypassa o RLS do Supabase com segurança pois nunca chega ao navegador.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️  Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.\n' +
    'Copie o arquivo .env.example para .env.local e preencha com suas credenciais do Supabase.'
  );
}

// Cliente público (navegador)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrativo (somente servidor — nunca expor ao cliente)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// -----------------------------------------------
// HELPERS DE BANCO DE DADOS
// -----------------------------------------------

import type { LogReversa } from '@/types';

/**
 * Cria um novo registro de log de reversão no banco de dados.
 */
export async function criarLogReversa(dados: Omit<LogReversa, 'id' | 'criado_em'>) {
  const { data, error } = await supabaseAdmin
    .from('logs_reversa')
    .insert([dados])
    .select()
    .single();

  if (error) throw error;
  return data as LogReversa;
}

/**
 * Atualiza um registro de log de reversão existente.
 */
export async function atualizarLogReversa(id: string, dados: Partial<LogReversa>) {
  const { data, error } = await supabaseAdmin
    .from('logs_reversa')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as LogReversa;
}

// Tipos de imagem aceitos no upload (whitelist de MIME types)
const MIME_TYPES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Faz upload de fotos para o bucket do Supabase e retorna as URLs públicas.
 * Valida MIME type, extensão e tamanho no servidor antes de enviar.
 */
export async function uploadFotos(
  logId: string,
  fotos: File[]
): Promise<string[]> {
  const urls: string[] = [];

  for (const foto of fotos) {
    // ── Valida MIME type (usa o tipo real do arquivo, não a extensão do nome) ──
    if (!MIME_TYPES_PERMITIDOS.has(foto.type)) {
      throw new Error(`Tipo de arquivo não permitido: ${foto.type}. Envie apenas JPG, PNG ou WebP.`);
    }

    // ── Valida tamanho ──────────────────────────────────────────────────────
    if (foto.size > TAMANHO_MAXIMO_BYTES) {
      throw new Error(`Arquivo muito grande (${(foto.size / 1024 / 1024).toFixed(1)} MB). Máximo: 5 MB.`);
    }

    // ── Deriva extensão do MIME (nunca do nome do arquivo) ──────────────────
    const extensao = EXTENSAO_POR_MIME[foto.type];

    // ── Nome aleatório para evitar path traversal e enumeração ─────────────
    const nomeAleatorio = crypto.randomUUID().replace(/-/g, '');
    const caminho = `${logId}/${nomeAleatorio}.${extensao}`;

    const { error } = await supabaseAdmin.storage
      .from('fotos-reversa')
      .upload(caminho, foto, {
        contentType: foto.type,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabaseAdmin.storage
      .from('fotos-reversa')
      .getPublicUrl(caminho);

    urls.push(data.publicUrl);
  }

  return urls;
}
