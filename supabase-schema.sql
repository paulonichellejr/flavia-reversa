-- ============================================================
-- SCHEMA SUPABASE — LOGÍSTICA REVERSA FLÁVIA ORGANIZA
-- Execute este SQL no Editor SQL do seu projeto Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor
-- ============================================================

-- 1. TABELA PRINCIPAL DE LOGS
-- ----------------------------
CREATE TABLE IF NOT EXISTS logs_reversa (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em       TIMESTAMPTZ DEFAULT now() NOT NULL,
  atualizado_em   TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Dados do cliente
  nome_cliente        TEXT NOT NULL,
  cpf_cliente         TEXT NOT NULL,

  -- Pedidos
  numero_pedido_tray  TEXT NOT NULL,
  numero_pedido_bling TEXT,

  -- Solicitação
  motivo       TEXT NOT NULL,
  descricao    TEXT,
  fotos_urls   TEXT[],          -- Array de URLs públicas do bucket

  -- Etiqueta Melhor Envio
  id_etiqueta       TEXT,
  url_etiqueta      TEXT,
  protocolo_etiqueta TEXT,

  -- Controle de status
  status          TEXT NOT NULL DEFAULT 'idle'
                  CHECK (status IN (
                    'idle', 'validando_pedido', 'pedido_validado',
                    'criando_bling', 'gerando_etiqueta', 'concluido', 'erro'
                  )),
  erro_mensagem   TEXT
);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_timestamp
  BEFORE UPDATE ON logs_reversa
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

-- Índices para buscas comuns
CREATE INDEX IF NOT EXISTS idx_logs_cpf         ON logs_reversa(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_logs_pedido_tray ON logs_reversa(numero_pedido_tray);
CREATE INDEX IF NOT EXISTS idx_logs_status      ON logs_reversa(status);
CREATE INDEX IF NOT EXISTS idx_logs_criado_em   ON logs_reversa(criado_em DESC);


-- 2. ROW LEVEL SECURITY (RLS)
-- ----------------------------
-- Habilita RLS para proteger os dados
ALTER TABLE logs_reversa ENABLE ROW LEVEL SECURITY;

-- Permite que a aplicação (anon key) leia e escreva seus próprios registros
-- Para um ambiente de produção, use a service role key no servidor
CREATE POLICY "app_pode_inserir" ON logs_reversa
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "app_pode_atualizar" ON logs_reversa
  FOR UPDATE TO anon
  USING (true);

-- Administradores (autenticados) podem ler tudo
CREATE POLICY "admin_pode_ler" ON logs_reversa
  FOR SELECT TO authenticated
  USING (true);


-- 3. BUCKET DE FOTOS
-- ----------------------------
-- Execute via Dashboard: Storage → New Bucket
-- Nome: fotos-reversa
-- Public: SIM (para gerar URLs públicas)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Policy do bucket (via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-reversa',
  'fotos-reversa',
  true,
  5242880,  -- 5MB em bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "upload_publico" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'fotos-reversa');

CREATE POLICY "leitura_publica" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'fotos-reversa');
