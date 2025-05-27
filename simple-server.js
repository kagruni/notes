const next = require('next');
const { createServer } = require('http');
const { parse } = require('url');

const dev = false;
const port = process.env.PORT || 3001;
const app = next({ dev });
const handle = app.getRequestHandler();

console.log(`Starting Next.js server on port ${port}...`);

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
}); 