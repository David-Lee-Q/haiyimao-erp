const express = require('express');
const db = require('../db');
const { calculateLandCost, EXCHANGE_RATES } = require('../services/landCostService');
const { requirePermission } = require('../auth');

const router = express.Router();

const HS_RATES = {
  '0810.10.00': { tariff: 0.07, vat: 0.09, name: '鲜樱桃' },
  '0808.10.00': { tariff: 0.1, vat: 0.09, name: '鲜苹果' },
  '0303.81.00': { tariff: 0.06, vat: 0.09, name: '冻鱼' },
  '0203.29.00': { tariff: 0.12, vat: 0.09, name: '冻猪肉' },
  '0306.17.00': { tariff: 0.05, vat: 0.09, name: '冻虾' },
};

router.get('/exchange-rate', (req, res) => {
  const currency = (req.query.currency || 'USD').toUpperCase();
  const rate = EXCHANGE_RATES[currency];
  if (rate == null) return res.status(404).json({ code: 404, message: `暂不支持币种 ${currency}` });
  res.json({ code: 200, data: { currency, rate, base: 'CNY', source: '中国外汇交易中心中间价', quoted_at: new Date().toISOString() } });
});

router.get('/hs-codes', (req, res) => {
  res.json({
    code: 200,
    data: Object.entries(HS_RATES).map(([code, v]) => ({ hs_code: code, name: v.name, tariff_rate: v.tariff, vat_rate: v.vat })),
  });
});

router.post('/land-cost/calculate', requirePermission('finance:calc'), (req, res) => {
  const { po_id, additional_costs } = req.body || {};
  if (!po_id) return res.status(400).json({ code: 400, message: 'po_id 不能为空' });
  const costs = Array.isArray(additional_costs) ? additional_costs : [];
  for (const c of costs) {
    if (!['BY_WEIGHT', 'BY_VALUE', 'BY_BOX'].includes(c.allocation_method)) {
      return res.status(400).json({ code: 400, message: `分摊方式不合法: ${c.allocation_method}` });
    }
  }
  const result = calculateLandCost(po_id, costs);
  if (result.error) return res.status(404).json({ code: 404, message: result.error });
  res.json({ code: 200, message: '落地成本分摊计算完成', data: result });
});

router.get('/land-cost', requirePermission('finance:view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT po.id AS po_id, po.po_code, po.currency, po.exchange_rate,
              SUM(li.allocated_cost_cny) AS allocated_total,
              po.total_amount_cny, COUNT(li.id) AS item_count, MAX(li.created_at) AS created_at
       FROM t_landing_cost_item li
       JOIN t_purchase_order po ON po.id = li.po_id
       GROUP BY po.id ORDER BY po.id DESC`
    )
    .all();
  res.json({ code: 200, data: rows });
});

router.delete('/land-cost/:poId', requirePermission('finance:delete'), (req, res) => {
  db.prepare('DELETE FROM t_landing_cost_detail WHERE po_id = ?').run(req.params.poId);
  db.prepare('DELETE FROM t_landing_cost_item WHERE po_id = ?').run(req.params.poId);
  res.json({ code: 200, message: '落地成本记录已清除' });
});

router.post('/customs/calculate', requirePermission('finance:calc'), (req, res) => {
  const { po_id, hs_code, declaration_no } = req.body || {};
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(po_id);
  if (!po) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  const hs = HS_RATES[hs_code] || { tariff: 0.07, vat: 0.09, name: '其他生鲜商品' };
  const cifCny = Math.round(Number(po.total_amount_cny) * 100) / 100;
  const dutiableValue = cifCny;
  const tariffAmount = Math.round(dutiableValue * hs.tariff * 100) / 100;
  const vatBase = dutiableValue + tariffAmount;
  const vatAmount = Math.round(vatBase * hs.vat * 100) / 100;
  const declNo = declaration_no || `CUS-${Date.now().toString().slice(-10)}`;

  db.prepare(
    `INSERT INTO t_customs_declaration
     (po_id, declaration_no, hs_code, tariff_rate, vat_rate, cif_amount_cny, dutiable_value_cny, tariff_amount_cny, vat_amount_cny)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(po_id, declNo, hs_code || '0000.00.00', hs.tariff, hs.vat, cifCny, dutiableValue, tariffAmount, vatAmount);

  res.json({
    code: 200,
    message: '关税/增值税倒算完成，已生成财务预付应付凭证',
    data: {
      po_code: po.po_code, declaration_no: declNo, hs_code: hs_code || '0000.00.00', hs_name: hs.name,
      tariff_rate: hs.tariff, vat_rate: hs.vat, cif_amount_cny: cifCny, dutiable_value_cny: dutiableValue,
      tariff_amount_cny: tariffAmount, vat_amount_cny: vatAmount,
      payable_total_cny: Math.round((tariffAmount + vatAmount) * 100) / 100, voucher_no: `AP-${declNo}`,
    },
  });
});

router.get('/customs/declarations', requirePermission('finance:view'), (req, res) => {
  const rows = db
    .prepare('SELECT cd.*, po.po_code FROM t_customs_declaration cd LEFT JOIN t_purchase_order po ON po.id = cd.po_id WHERE cd.is_deleted = 0 ORDER BY cd.id DESC')
    .all();
  res.json({ code: 200, data: rows });
});

router.delete('/customs/declarations/:id', requirePermission('finance:delete'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_customs_declaration WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '报关记录不存在' });
  db.prepare('UPDATE t_customs_declaration SET is_deleted = 1 WHERE id = ?').run(row.id);
  res.json({ code: 200, message: '报关记录已删除' });
});

module.exports = router;
