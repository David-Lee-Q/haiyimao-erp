const db = require('../db');
const { round } = require('../utils');

const EXCHANGE_RATES = {
  USD: 7.185,
  EUR: 7.78,
  AUD: 4.72,
  NZD: 4.35,
  NOK: 0.66,
  THB: 0.2,
  CNH: 1.0,
  CNY: 1.0,
};

function effectiveQuantities(po, poItems) {
  const result = [];
  for (const item of poItems) {
    const agg = db
      .prepare(
        `SELECT COALESCE(SUM(current_net_weight),0) AS net, COALESCE(SUM(current_boxes),0) AS boxes
         FROM t_inventory_batch WHERE po_id = ? AND sku_code = ?`
      )
      .get(po.id, item.sku_code);
    const weight = agg.net > 0 ? agg.net : Number(item.net_weight_kg);
    const boxes = agg.boxes > 0 ? agg.boxes : Number(item.box_count);
    result.push({
      item,
      weight,
      boxes,
      value_cny: round(Number(item.sub_total) * Number(po.exchange_rate)),
    });
  }
  return result;
}

function calculateLandCost(poId, additionalCosts) {
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(poId);
  if (!po) return { error: '采购订单不存在' };
  const poItems = db.prepare('SELECT * FROM t_purchase_order_item WHERE po_id = ?').all(poId);
  if (poItems.length === 0) return { error: '采购订单无明细' };

  const rows = effectiveQuantities(po, poItems);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const totalBoxes = rows.reduce((s, r) => s + r.boxes, 0);
  const totalValue = rows.reduce((s, r) => s + r.value_cny, 0);
  const baseGoodsCost = round(totalValue);
  const totalAdditional = round(additionalCosts.reduce((s, c) => s + Number(c.amount_cny || 0), 0));

  const breakdown = rows.map((row) => {
    let allocated = 0;
    for (const cost of additionalCosts) {
      const amount = Number(cost.amount_cny) || 0;
      let share = 0;
      if (cost.allocation_method === 'BY_WEIGHT' && totalWeight > 0) share = row.weight / totalWeight;
      else if (cost.allocation_method === 'BY_VALUE' && totalValue > 0) share = row.value_cny / totalValue;
      else if (cost.allocation_method === 'BY_BOX' && totalBoxes > 0) share = row.boxes / totalBoxes;
      allocated += amount * share;
    }
    const totalCost = row.value_cny + allocated;
    return {
      item_id: row.item.id,
      sku_code: row.item.sku_code,
      product_name: row.item.product_name,
      actual_net_weight_kg: round(row.weight),
      actual_box_count: round(row.boxes, 0),
      goods_cost_cny: round(row.value_cny),
      allocated_cost_cny: round(allocated),
      total_cost_cny: round(totalCost),
      landed_cost_per_kg: row.weight > 0 ? round(totalCost / row.weight) : 0,
      landed_cost_per_box: row.boxes > 0 ? round(totalCost / row.boxes) : 0,
    };
  });

  db.transaction(() => {
    db.prepare('DELETE FROM t_landing_cost_detail WHERE po_id = ?').run(poId);
    db.prepare('DELETE FROM t_landing_cost_item WHERE po_id = ?').run(poId);
    const insCost = db.prepare(
      'INSERT INTO t_landing_cost_detail (po_id, cost_type, amount_cny, allocation_method) VALUES (?,?,?,?)'
    );
    for (const c of additionalCosts) {
      insCost.run(poId, c.cost_type, Number(c.amount_cny) || 0, c.allocation_method);
    }
    const insItem = db.prepare(
      `INSERT INTO t_landing_cost_item (po_id, item_id, sku_code, landed_cost_per_kg, landed_cost_per_box, allocated_cost_cny)
       VALUES (?,?,?,?,?,?)`
    );
    for (const b of breakdown) {
      insItem.run(poId, b.item_id, b.sku_code, b.landed_cost_per_kg, b.landed_cost_per_box, b.allocated_cost_cny);
    }
  })();

  return {
    po_code: po.po_code,
    currency: po.currency,
    exchange_rate: po.exchange_rate,
    base_goods_cost_cny: baseGoodsCost,
    total_landed_cost_cny: round(baseGoodsCost + totalAdditional),
    items_breakdown: breakdown,
  };
}

module.exports = { calculateLandCost, EXCHANGE_RATES };
