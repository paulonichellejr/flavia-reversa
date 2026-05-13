const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CLIENT_ID     = 'd392c9ccbad9de27f90d957d35fee707cb56ea79';
const CLIENT_SECRET = '75a4ffa922b146d155ea87492b1599292743a94a5b65ffd3d1ac757f2246';
const CODE          = process.argv[2];

if (!CODE) { console.error('❌ Informe o código: node trocar-token-bling.js SEU_CODIGO'); process.exit(1); }

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const body = `grant_type=authorization_code&code=${CODE}&redirect_uri=https://localhost`;

const req = https.request({
  hostname: 'www.bling.com.br', path: '/Api/v3/oauth/token', method: 'POST',
  headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.access_token) {
      const envPath = path.join(__dirname, '.env.local');
      let env = fs.readFileSync(envPath, 'utf-8');
      env = env.replace(/^BLING_API_KEY=.+$/m,      `BLING_API_KEY=${json.access_token}`)
               .replace(/^BLING_REFRESH_TOKEN=.+$/m, `BLING_REFRESH_TOKEN=${json.refresh_token}`);
      fs.writeFileSync(envPath, env);
      console.log('✅ Token atualizado no .env.local!\nReinicie o servidor: Ctrl+C e npm run dev');
    } else {
      console.error('❌ Erro:', JSON.stringify(json, null, 2));
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(body);
req.end();
