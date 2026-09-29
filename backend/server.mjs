import express from 'express';
import pg from 'pg';
import {handleApi} from '../lib/server/api.ts';

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 10});

app.disable('x-powered-by');
app.use(express.text({type: 'application/json', limit: '8kb'}));

app.use(async (req, res) => {
  try {
    const proto = process.env.COOKIE_SECURE === 'true' ? 'https' : 'http';
    const url = `${proto}://${req.headers.host}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : typeof req.body === 'string' ? req.body : '{}',
    });

    const response = await handleApi(
      request,
      {
        async query(sql, args = []) {
          let i = 0;
          const query = sql.replace(/\?/g, () => '$' + ++i);
          return (await pool.query(query, args)).rows;
        },
      },
      {
        secure: process.env.COOKIE_SECURE === 'true',
        ip: req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress,
      },
    );

    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status).send(await response.text());
  } catch (error) {
    console.error(error);
    res.status(500).json({error: 'Server unavailable.'});
  }
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({error: err.status === 413 ? 'Request too large.' : 'Invalid request.'});
});

const server = app.listen(port, '0.0.0.0', () => console.log(`The Last Knight API listening on :${port}`));

process.on('SIGTERM', () => {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
});
