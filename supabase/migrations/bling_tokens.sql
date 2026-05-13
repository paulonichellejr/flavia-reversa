-- Tabela para armazenar o token OAuth do Bling
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/kcciqxulynqwyihxwyuu/sql

CREATE TABLE IF NOT EXISTS bling_tokens (
  id            serial PRIMARY KEY,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  updated_at    timestamptz DEFAULT now()
);

-- Row Level Security: bloqueia acesso direto pelo cliente (só service_role pode ler/escrever)
ALTER TABLE bling_tokens ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública — acesso apenas via service_role key (server-side)
-- (não adicionar policies de SELECT/INSERT/UPDATE para anon ou authenticated)
