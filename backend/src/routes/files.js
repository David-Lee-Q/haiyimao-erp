const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { requirePermission } = require('../auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10);
    cb(null, base + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('不支持的文件类型（允许 PDF / Word / Excel / 图片 / 文本）'));
  },
});

router.post('/', requirePermission('file:upload'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ code: 400, message: err.message });
    if (!req.file) return res.status(400).json({ code: 400, message: '未接收到文件' });
    const { biz_type, biz_id } = req.body || {};
    const info = db
      .prepare(
        `INSERT INTO t_file (original_name, stored_name, mime_type, size, path, biz_type, biz_id, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(
        Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        biz_type || null,
        biz_id ? Number(biz_id) : null,
        req.user.id
      );
    const row = db.prepare('SELECT * FROM t_file WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      code: 200,
      message: '文件上传成功',
      data: { id: row.id, original_name: row.original_name, size: row.size, mime_type: row.mime_type, url: `/api/v1/files/${row.id}/download` },
    });
  });
});

router.get('/', (req, res) => {
  const { biz_type, biz_id } = req.query;
  const conditions = ['is_deleted = 0'];
  const params = [];
  if (biz_type) {
    conditions.push('biz_type = ?');
    params.push(biz_type);
  }
  if (biz_id) {
    conditions.push('biz_id = ?');
    params.push(Number(biz_id));
  }
  const rows = db
    .prepare(`SELECT id, original_name, size, mime_type, biz_type, biz_id, uploaded_by, created_at FROM t_file WHERE ${conditions.join(' AND ')} ORDER BY id DESC`)
    .all(...params);
  res.json({ code: 200, data: rows });
});

router.get('/:id/download', (req, res) => {
  const row = db.prepare('SELECT * FROM t_file WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '文件不存在或已删除' });
  if (!fs.existsSync(row.path)) return res.status(404).json({ code: 404, message: '文件已丢失' });
  res.download(path.resolve(row.path), row.original_name);
});

router.delete('/:id', requirePermission('file:delete'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_file WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '文件不存在' });
  db.prepare('UPDATE t_file SET is_deleted = 1 WHERE id = ?').run(row.id);
  res.json({ code: 200, message: '文件已删除' });
});

module.exports = router;
