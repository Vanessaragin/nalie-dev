const path = require('node:path');
const { createServer } = require('node:http');
const next = require('next');

const kingHostPort = Object.entries(process.env).find(
  ([name, value]) => name.startsWith('PORT_') && /^\d+$/.test(value || ''),
)?.[1];
const port = Number(process.env.PORT_SERVER || process.env.PORT || kingHostPort || 3000);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const app = next({
  dev: false,
  dir: path.join(__dirname, 'apps/web'),
  hostname,
  port,
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => handle(request, response)).listen(
    port,
    hostname,
    () => {
      console.log(`Nalie disponível em http://${hostname}:${port}`);
    },
  );
});
