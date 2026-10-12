const express = require('express');
const cors = require('cors');
const { port } = require('./config');
const { authRequired } = require('./auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/v1/health', (req, res) => res.json({ code: 200, message: 'fresh-trade-erp backend running' }));

app.use('/api/v1/auth', require('./routes/auth'));

app.use('/api/v1', authRequired);

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      try {
        db.prepare(
          `INSERT INTO t_audit_log (user_id, username, method, path, action, detail) VALUES (?,?,?,?,?,?)`
        ).run(
          req.user ? req.user.id : null,
          req.user ? req.user.username : null,
          req.method,
          req.originalUrl,
          `${req.method} ${req.originalUrl}`,
          res.statusCode >= 400 ? `失败(${res.statusCode})` : '成功'
        );
      } catch (e) {
        /* ignore audit failure */
      }
    });
  }
  next();
});

app.use('/api/v1/suppliers', require('./routes/suppliers'));
app.use('/api/v1/purchase', require('./routes/purchase'));
app.use('/api/v1/wms', require('./routes/wms'));
app.use('/api/v1/finance', require('./routes/finance'));
app.use('/api/v1/shipment', require('./routes/shipment'));
app.use('/api/v1/sales', require('./routes/sales'));
app.use('/api/v1/alerts', require('./routes/alerts'));
app.use('/api/v1/approvals', require('./routes/approvals'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/files', require('./routes/files'));
app.use('/api/v1/audit-logs', require('./routes/audit'));

app.use((req, res) => res.status(404).json({ code: 404, message: `接口不存在: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  if (err && err.status && err.message) {
    return res.status(err.status).json({ code: err.status, message: err.message });
  }
  console.error(err);
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[fresh-trade-erp] backend listening on http://0.0.0.0:${port}`);
});
