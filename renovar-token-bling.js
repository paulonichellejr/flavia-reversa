/**
 * Renova o Access Token do Bling usando o Refresh Token.
 * Execute sempre que o token expirar (a cada ~1 hora):
 *   node renovar-token-bling.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Lê as variáveis do .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

const CLIENT_ID     = getEnv('BLING_CLIENT_ID');
const CLIENT_SECRET = getEnv('BLING_CLIENT_SECRET');
const REFRESH_TOKEN = getEnv('BLING_REFRESH_TOKEN');

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ Credenciais do Bling não encontradas no .env.local');
  process.exit(1);
}

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const body = `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`;

const options = {
  hostname: 'www.bling.com.br',
  path: '/Api/v3/oauth/token',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('🔄 Renovando token do Bling...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);

    if (json.access_token) {
      // Atualiza o .env.local automaticamente
      let novoEnv = envContent
        .replace(/^BLING_API_KEY=.+$/m,     `BLING_API_KEY=${json.access_token}`)
        .replace(/^BLING_REFRESH_TOKEN=.+$/m, `BLING_REFRESH_TOKEN=${json.refresh_token}`);

      fs.writeFileSync(envPath, novoEnv, 'utf-8');

      console.log('✅ Token renovado e .env.local atualizado com sucesso!\n');
      console.log('Novo Access Token:');
      console.log(json.access_token);
      console.log('\nNovo Refresh Token:');
      console.log(json.refresh_token);
      console.log('\n⚠️  Reinicie o servidor (Ctrl+C e npm run dev) para carregar o novo token.');
    } else {
      console.error('❌ Erro ao renovar token:');
      console.log(JSON.stringify(json, null, 2));
    }
  });
});

req.on('error', (e) => console.error('Erro de conexão:', e.message));
req.write(body);
req.end();
