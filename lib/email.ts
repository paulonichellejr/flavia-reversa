/**
 * ENVIO DE E-MAIL — LOGÍSTICA REVERSA
 * Usa Gmail SMTP via nodemailer (simples, sem DNS, sem domínio customizado).
 *
 * COMO CONFIGURAR (5 minutos):
 * 1. Acesse sua conta Google: https://myaccount.google.com
 * 2. Segurança → Verificação em duas etapas → Ative (se ainda não estiver)
 * 3. Segurança → Senhas de app → Selecione "Outro (nome personalizado)"
 *    → Digite "Loja Flávia Reversa" → Clique em "Gerar"
 * 4. Copie a senha de 16 caracteres gerada
 * 5. No Vercel, adicione as variáveis:
 *    GMAIL_USER=lojaflaviaorganiza@gmail.com
 *    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (a senha gerada, com ou sem espaços)
 *
 * NOTA: Não use sua senha normal do Gmail — crie uma Senha de App como acima.
 */

import type { Transporter } from 'nodemailer';

// AVISO: o pacote `nodemailer` precisa estar instalado.
// Na pasta do projeto, execute: npm install nodemailer @types/nodemailer
let createTransport: ((opts: unknown) => Transporter) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  createTransport = require('nodemailer').createTransport;
} catch {
  // nodemailer não instalado ainda
}

// ─── Configuração ────────────────────────────────────────────
const GMAIL_USER         = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
const LOJA_EMAIL         = process.env.LOJA_EMAIL || 'lojaflaviaorganiza@gmail.com';
const EMAIL_FROM_NOME    = 'Loja Flávia Organiza';

// ─── Design System — paleta extraída do site ─────────────
const COR_HEADER        = '#C4A0AF'; // flavia-500 — rosa-mauve principal
const COR_HEADER_TOPO   = '#D2B6C2'; // flavia-400 — faixa topo
const COR_HEADER_TEXTO  = '#906275'; // flavia-700 — nº pedido e destaques
const COR_BTN           = '#879869'; // sage-500   — botão PDF
const COR_CODIGO_BG     = '#F5EEF2'; // flavia-50  — fundo bloco código
const COR_CODIGO_BORDA  = '#C4A0AF'; // flavia-500 — borda dashed
const COR_INFO_BG       = '#E8F5EE'; // success-100 — fundo instrução
const COR_INFO_BORDA    = '#4A9E6F'; // success-500 — borda esquerda
const COR_INFO_TEXTO    = '#2E7050'; // success-700 — texto instrução
const COR_RODAPE_BG     = '#F5EEF2'; // flavia-50  — fundo rodapé
const COR_RODAPE_BORDA  = '#EADDE4'; // flavia-100 — borda topo rodapé
const COR_BORDA         = '#DED5C8'; // bege-300   — divisor
const COR_TEXTO         = '#333333'; // text-primary
const COR_TEXTO_SEC     = '#485059'; // text-secondary
const COR_TEXTO_MUTED   = '#706E6F'; // text-muted

// Lazy-initialized transporter (evita erro em build time)
let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!createTransport) return null;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

// ─── Parâmetros do e-mail de devolução ──────────────────────
export interface EmailDevolucaoParams {
  clienteNome: string;
  clienteEmail: string;
  numeroPedido: string;
  codigoPostagem: string;
  instrucoes: string;
  prazoPostagem?: string;
}

// ─── Envia e-mail de confirmação de devolução ─────────────────
export async function enviarEmailDevolucao(params: EmailDevolucaoParams): Promise<void> {
  const {
    clienteNome,
    clienteEmail,
    numeroPedido,
    codigoPostagem,
    instrucoes,
    prazoPostagem = '5 dias úteis após receber esta confirmação',
  } = params;

  const t = getTransporter();
  if (!t) {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.warn('[Email] GMAIL_USER ou GMAIL_APP_PASSWORD não configurados — e-mail não enviado.');
      console.warn('[Email] Veja as instruções em lib/email.ts para configurar o Gmail SMTP.');
    } else {
      console.error('[Email] Pacote `nodemailer` não instalado. Execute: npm install nodemailer @types/nodemailer');
    }
    return;
  }

  const primeiroNome = clienteNome.split(' ')[0] ?? clienteNome;
  const html = gerarHtmlEmail({ primeiroNome, numeroPedido, codigoPostagem, instrucoes, prazoPostagem });

  try {
    await t.sendMail({
      from: `"${EMAIL_FROM_NOME}" <${GMAIL_USER}>`,
      to: clienteEmail,
      replyTo: LOJA_EMAIL,
      subject: `✅ Devolução confirmada — Pedido #${numeroPedido} | Loja Flávia Organiza`,
      html,
    });
    console.log(`[Email] ✅ E-mail enviado para ${clienteEmail} — Pedido #${numeroPedido}`);
  } catch (err) {
    console.error('[Email] Erro ao enviar via Gmail SMTP:', err);
  }
}

// ─── E-mail de fallback (etiqueta falhou) ───────────────────
export async function enviarEmailFallback(params: {
  clienteNome: string;
  clienteEmail: string;
  numeroPedido: string;
}): Promise<void> {
  const { clienteNome, clienteEmail, numeroPedido } = params;

  const t = getTransporter();
  if (!t) return;

  const primeiroNome = clienteNome.split(' ')[0] ?? clienteNome;

  try {
    await t.sendMail({
      from: `"${EMAIL_FROM_NOME}" <${GMAIL_USER}>`,
      to: clienteEmail,
      replyTo: LOJA_EMAIL,
      subject: `Sua solicitação de devolução — Pedido #${numeroPedido}`,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#faf8f5;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <h2 style="color:#c4956a;margin:0 0 16px;">Loja Flávia Organiza 🛍️</h2>
    <p style="color:#2c1f14;font-size:15px;line-height:1.6;">
      Olá, <strong>${primeiroNome}</strong>! 💛<br><br>
      Recebemos sua solicitação de devolução do pedido <strong>#${numeroPedido}</strong>.
      Nossa equipe irá entrar em contato em breve para te enviar a etiqueta de postagem.
    </p>
    <p style="color:#9c7a5a;font-size:13px;margin-top:24px;">
      Pedimos desculpas pelo inconveniente. Iremos resolver isso com carinho! 🌿
    </p>
    <hr style="border:none;border-top:1px solid #f0e8df;margin:24px 0;">
    <p style="color:#b8967a;font-size:12px;text-align:center;">
      © ${new Date().getFullYear()} Loja Flávia Organiza — Organização com carinho 💛
    </p>
  </div>
</body></html>`,
    });
    console.log(`[Email] ✅ E-mail de fallback enviado para ${clienteEmail}`);
  } catch (err) {
    console.error('[Email] Erro ao enviar e-mail de fallback:', err);
  }
}

// ─── Template HTML ───────────────────────────────────────────
function gerarHtmlEmail(p: {
  primeiroNome: string;
  numeroPedido: string;
  codigoPostagem: string;
  instrucoes: string;
  prazoPostagem: string;
}): string {
  const { primeiroNome, numeroPedido, codigoPostagem, instrucoes, prazoPostagem } = p;

  const blocoCodigoRastreio = codigoPostagem
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${COR_CODIGO_BG};border:2px dashed ${COR_CODIGO_BORDA};border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;color:${COR_HEADER_TEXTO};text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">
          Código para apresentar nos Correios
        </p>
        <p style="margin:8px 0;font-size:30px;font-weight:700;letter-spacing:5px;color:${COR_TEXTO};font-family:'Courier New',Courier,monospace;">
          ${codigoPostagem}
        </p>
        <p style="margin:0;font-size:12px;color:${COR_TEXTO_MUTED};">
          Mostre este código no balcão — eles imprimem a etiqueta na hora
        </p>
      </td></tr>
    </table>`
    : `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3DC;border-left:4px solid #D4963A;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:14px;color:#7a5200;line-height:1.6;">
          ⏳ <strong>Seu código de rastreio está sendo processado.</strong>
          O Melhor Envio enviará outro e-mail assim que estiver disponível.
          O PDF da etiqueta já está pronto no botão abaixo!
        </p>
      </td></tr>
    </table>`;


  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Devolução confirmada — Loja Flávia Organiza</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F4;font-family:'Segoe UI',Arial,sans-serif;color:${COR_TEXTO};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F4;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(72,80,89,0.09);">

        <!-- Faixa topo rosa-mauve -->
        <tr>
          <td style="background:${COR_HEADER_TOPO};padding:6px 0;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:1px;color:${COR_TEXTO_SEC};">
              Loja Flávia Organiza
            </p>
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:${COR_HEADER};padding:28px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:24px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;letter-spacing:0.5px;">
              Loja Flávia Organiza
            </p>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.85);letter-spacing:0.5px;">
              Troca &amp; Devolução — Confirmação
            </p>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:32px 32px 8px;">

            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COR_TEXTO};">
              Olá, <strong>${primeiroNome}</strong>! 💛
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${COR_TEXTO_SEC};">
              Sua solicitação de devolução referente ao pedido
              <strong style="color:${COR_HEADER_TEXTO};">#${numeroPedido}</strong>
              foi recebida com carinho. Já estamos cuidando de tudo por aqui!
            </p>

            ${blocoCodigoRastreio}

            <table width="100%" cellpadding="0" cellspacing="0" style="background:${COR_INFO_BG};border-left:4px solid ${COR_INFO_BORDA};border-radius:0 8px 8px 0;margin-bottom:24px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0;font-size:14px;line-height:1.7;color:${COR_INFO_TEXTO};">
                  ${instrucoes}
                </p>
              </td></tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:${COR_TEXTO_MUTED};text-align:center;">
              ⏰ Prazo para postagem: <strong style="color:${COR_TEXTO_SEC};">${prazoPostagem}</strong>
            </p>

            <hr style="border:none;border-top:1px solid ${COR_BORDA};margin:0 0 20px;">

            <p style="margin:0 0 8px;font-size:13px;color:${COR_TEXTO_MUTED};line-height:1.6;">
              Ficou com alguma dúvida? Responda este e-mail ou acesse nosso
              <a href="https://www.lojaflaviaorganiza.com.br" style="color:${COR_BTN};text-decoration:none;font-weight:600;">site</a>.
              Estamos aqui para ajudar! 🌿
            </p>

          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background:${COR_RODAPE_BG};padding:20px 32px;text-align:center;border-top:1px solid ${COR_RODAPE_BORDA};">
            <p style="margin:0 0 4px;font-size:12px;color:${COR_HEADER_TEXTO};">
              © ${new Date().getFullYear()} Loja Flávia Organiza
            </p>
            <p style="margin:0;font-size:11px;color:${COR_HEADER};">
              Você recebeu este e-mail porque realizou uma solicitação de devolução em nosso site.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
