const crypto = require('crypto');
const db = require('./db');
const { addDays, dateStamp, round } = require('./utils');
const { calculateLandCost } = require('./services/landCostService');
const { createShipmentForPo } = require('./services/shipmentService');

function hash(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

const USERS = [
  ['admin', 'admin123', '系统管理员', 'admin'],
  ['manager', 'manager123', '采购经理·陈审', 'manager'],
  ['buyer', 'buyer123', '采购员·林采', 'purchase'],
  ['warehouse', 'warehouse123', '仓储主管·吴仓', 'warehouse'],
  ['finance', 'finance123', '财务专员·钱会', 'finance'],
  ['quality', 'quality123', '生鲜品质主管·周检', 'quality'],
];

function ensureUsers() {
  const find = db.prepare('SELECT * FROM t_user WHERE username = ?');
  const ins = db.prepare('INSERT INTO t_user (username, password, real_name, role, status) VALUES (?,?,?,?, \'ACTIVE\')');
  const upd = db.prepare('UPDATE t_user SET password=?, real_name=?, role=?, is_deleted=0, status=\'ACTIVE\' WHERE username=?');
  for (const [username, pwd, realName, role] of USERS) {
    const existing = find.get(username);
    if (existing) upd.run(hash(pwd), realName, role, username);
    else ins.run(username, hash(pwd), realName, role);
  }
}

function run() {
  ensureUsers();

  const count = db.prepare('SELECT COUNT(*) AS c FROM t_purchase_order').get().c;
  if (count > 0) {
    console.log('[seed] 业务数据已存在，仅同步账号完成');
    return;
  }
  console.log('[seed] 初始化示例业务数据 ...');

  const today = new Date();
  const d = (offset) => iso(new Date(today.getTime() + offset * 86400000));
  const uid = (name) => db.prepare('SELECT id FROM t_user WHERE username = ?').get(name).id;
  const buyerId = uid('buyer');
  const managerId = uid('manager');

  db.transaction(() => {
    const insSup = db.prepare(
      'INSERT INTO t_supplier (name, country, contact, credit_limit_cny, credit_used_cny) VALUES (?,?,?,?,?)'
    );
    insSup.run('Andes Fresh Fruits S.A.', 'Chile', 'Carlos M. / +56-2-2345', 8000000, 3200000);
    insSup.run('Southern Ocean Seafood Pty', 'Australia', 'Emma W. / +61-2-8899', 6000000, 1800000);
    insSup.run('Nordic Salmon AS', 'Norway', 'Lars H. / +47-22-3344', 5000000, 900000);
    insSup.run('Kiwi Gold Orchards Ltd', 'New Zealand', 'Olivia B. / +64-9-5512', 4000000, 0);

    const insPo = db.prepare(
      `INSERT INTO t_purchase_order
       (po_code, supplier_id, incoterms, currency, exchange_rate, total_amount, total_amount_cny, status, contract_file, remark, created_by, approved_by, approved_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    const insItem = db.prepare(
      `INSERT INTO t_purchase_order_item
       (po_id, sku_code, product_name, origin_country, box_count, gross_weight_kg, net_weight_kg,
        weight_tolerance_pct, unit_price_per_box, unit_price_per_kg, temperature_requirement, sub_total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    );

    const poDefs = [
      {
        code: 'PO-' + dateStamp(new Date(today.getTime() - 6 * 86400000)) + '-001',
        supplier_id: 1, incoterms: 'CIF', currency: 'USD', rate: 7.185, status: 'COMPLETED',
        approved: managerId, created_at: d(-6),
        items: [
          ['FRUIT-CHL-CHER-01', '智利车厘子 JJ级 5kg板装', 'Chile', 2000, 10800, 10000, 2.5, 35.5, null, 'CHILLED', 71000],
        ],
      },
      {
        code: 'PO-' + dateStamp(new Date(today.getTime() - 4 * 86400000)) + '-001',
        supplier_id: 2, incoterms: 'FOB', currency: 'AUD', rate: 4.72, status: 'IN_TRANSIT',
        approved: managerId, created_at: d(-4),
        items: [
          ['SEAF-AUS-SHR-02', '澳洲野生岩龙虾 1kg/只 活鲜', 'Australia', 500, 780, 700, 3.0, 92, null, 'CHILLED', 46000],
          ['SEAF-AUS-ABL-03', '澳洲翡翠鲍鱼 500g/盒', 'Australia', 800, 520, 480, 3.5, 58, null, 'FROZEN', 46400],
        ],
      },
      {
        code: 'PO-' + dateStamp(new Date(today.getTime() - 2 * 86400000)) + '-001',
        supplier_id: 3, incoterms: 'CFR', currency: 'EUR', rate: 7.78, status: 'CONFIRMED',
        approved: managerId, created_at: d(-2),
        items: [
          ['SEAF-NOR-SAL-04', '挪威三文鱼 4-5kg 冰鲜整鱼', 'Norway', 1200, 6400, 6000, 2.0, 118, null, 'CHILLED', 141600],
        ],
      },
      {
        code: 'PO-' + dateStamp(new Date(today.getTime() - 1 * 86400000)) + '-001',
        supplier_id: 4, incoterms: 'EXW', currency: 'NZD', rate: 4.35, status: 'PENDING_APPROVE',
        approved: null, created_at: d(-1),
        items: [
          ['FRUIT-NZL-KIW-05', '新西兰金奇异果 SunGold 3.3kg',
            'New Zealand', 3000, 11200, 10500, 3.0, 24.8, null, 'CHILLED', 74400],
        ],
      },
      {
        code: 'PO-' + dateStamp(today) + '-001',
        supplier_id: 1, incoterms: 'CIF', currency: 'USD', rate: 7.185, status: 'DRAFT',
        approved: null, created_at: d(0),
        items: [
          ['FRUIT-CHL-GRP-06', '智利红提 Crimson 8.2kg', 'Chile', 1500, 13500, 12300, 2.5, null, 3.2, 'CHILLED', 39360],
        ],
      },
    ];

    for (const def of poDefs) {
      const total = def.items.reduce((s, it) => s + it[10], 0);
      const info = insPo.run(
        def.code, def.supplier_id, def.incoterms, def.currency, def.rate, round(total), round(total * def.rate),
        def.status, def.status === 'DRAFT' ? null : `${def.code}-合同.pdf`, '示例采购订单', buyerId,
        def.approved, def.approved ? new Date().toISOString() : null, def.created_at
      );
      const poId = info.lastInsertRowid;
      for (const it of def.items) {
        insItem.run(
          poId, it[0], it[1], it[2], it[3], it[4], it[5], it[6],
          it[7] == null ? null : it[7], it[8], it[9], it[10]
        );
      }
    }

    // 货运批次 + 单证（为 IN_TRANSIT 的 PO 与 CONFIRMED 的 PO 生成）
    createShipmentForPo(2);
    const shp = db.prepare('SELECT * FROM t_shipment_batch WHERE po_id = 2').get();
    db.prepare("UPDATE t_shipment_batch SET status='IN_TRANSIT', vessel='MSC VALPARAISO', container_no='MSCU7788112', seal_no='SL99887', bl_no='BL-SHA-88291', etd=? WHERE id=?")
      .run(d(-3), shp.id);
    const docs = db.prepare('SELECT * FROM t_shipment_document WHERE shipment_id = ?').all(shp.id);
    for (const doc of docs) {
      if (['BL', 'CO', 'CUSTOMS'].includes(doc.doc_type)) {
        db.prepare("UPDATE t_shipment_document SET status='UPLOADED', file_name=?, key_fields=?, uploaded_at=CURRENT_TIMESTAMP WHERE id=?")
          .run(`${doc.doc_type}.pdf`, JSON.stringify(doc.doc_type === 'BL' ? { bill_of_lading_no: 'BL-SHA-88291', container_no: 'MSCU7788112', seal_no: 'SL99887' } : {}), doc.id);
      }
    }

    createShipmentForPo(3);
    const shp3 = db.prepare('SELECT * FROM t_shipment_batch WHERE po_id = 3').get();
    db.prepare("UPDATE t_shipment_batch SET status='PORT_DEPARTURE', vessel='MAERSK OSLO', container_no='MRKU2210099' WHERE id=?")
      .run(shp3.id);

    // 库存批次入库（PO 1 已完成）
    const insBatch = db.prepare(
      `INSERT INTO t_inventory_batch
       (batch_code, sku_code, product_name, po_id, shipment_id, origin_country, plant_approval_no,
        production_date, expiry_date, shelf_life_days, warehouse_id, warehouse_name, zone_type,
        current_boxes, current_net_weight, planned_net_weight, temperature_requirement, status, sales_locked, lock_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    insBatch.run('BAT-' + dateStamp(new Date(today.getTime() - 5 * 86400000)) + '-CHL-9921', 'FRUIT-CHL-CHER-01', '智利车厘子 JJ级 5kg板装', 1, null, 'Chile', 'FDA-CHL-9921', d(-12), d(33), 45, 2, '上海保税冷链仓', 'CHILLED', 1200, 6000, 6000, 'CHILLED(0-4C)', 'IN_STOCK', 0, null);
    insBatch.run('BAT-' + dateStamp(new Date(today.getTime() - 5 * 86400000)) + '-CHL-9921-A', 'FRUIT-CHL-CHER-01', '智利车厘子 JJ级 5kg板装', 1, null, 'Chile', 'FDA-CHL-9921', d(-12), d(38), 50, 2, '上海保税冷链仓', 'CHILLED', 795, 3975, 3975, 'CHILLED(0-4C)', 'IN_STOCK', 0, null);
    insBatch.run('BAT-' + dateStamp(new Date(today.getTime() - 4 * 86400000)) + '-AUS-3310', 'SEAF-AUS-ABL-03', '澳洲翡翠鲍鱼 500g/盒', 2, shp.id, 'Australia', 'AUS-FDA-3310', d(-8), addDays('2027-01-01', 0), 400, 4, '天津港冷链中心', 'FROZEN', 800, 480, 480, 'FROZEN(-18C)', 'IN_STOCK', 0, null);
    insBatch.run('BAT-' + dateStamp(new Date(today.getTime() - 4 * 86400000)) + '-AUS-5521', 'SEAF-AUS-SHR-02', '澳洲野生岩龙虾 1kg/只 活鲜', 2, shp.id, 'Australia', 'AUS-FDA-5521', d(-6), d(14), 20, 2, '上海保税冷链仓', 'CHILLED', 500, 700, 700, 'CHILLED(0-4C)', 'IN_STOCK', 0, null);

    // 落地成本（PO 1）
    calculateLandCost(1, [
      { cost_type: 'OCEAN_FREIGHT', amount_cny: 32000, allocation_method: 'BY_WEIGHT' },
      { cost_type: 'CUSTOMS_DUTY', amount_cny: 25500, allocation_method: 'BY_VALUE' },
      { cost_type: 'PORT_FEE', amount_cny: 4800, allocation_method: 'BY_BOX' },
    ]);

    // 温度日志 + 告警（冷龙虾批次：连续高温）
    const lobster = db.prepare("SELECT * FROM t_inventory_batch WHERE sku_code='SEAF-AUS-SHR-02'").get();
    const insTemp = db.prepare('INSERT INTO t_temperature_log (batch_id, warehouse_name, temperature, recorded_at) VALUES (?,?,?,?)');
    insTemp.run(lobster.id, lobster.warehouse_name, 5.2, d(-1) + ' 09:00:00');
    insTemp.run(lobster.id, lobster.warehouse_name, 6.1, d(0) + ' 09:00:00');
    insTemp.run(lobster.id, lobster.warehouse_name, 7.4, d(0) + ' 12:00:00');
    db.prepare(
      `INSERT INTO t_alert (alert_type, level, batch_id, batch_code, warehouse_name, message) VALUES ('TEMPERATURE','HIGH',?,?,?,?)`
    ).run(lobster.id, lobster.batch_code, lobster.warehouse_name,
      `上海保税冷链仓 批次 ${lobster.batch_code}（冷藏(0-4C)）连续3次温度 7.4°C 超过上限 4°C，已生成高优先级警报并锁定该批次销售`);
    db.prepare('UPDATE t_inventory_batch SET sales_locked=1, lock_reason=? WHERE id=?').run('冷链温度异常，等待品质确认', lobster.id);

    // 磅差理赔审批（示例）
    db.prepare(
      `INSERT INTO t_approval (biz_type, biz_id, reason, status, applicant_id) VALUES ('WEIGHT_VARIANCE',?,?, 'PENDING', ?)`
    ).run(1, '入库净重超出合同公差：FRUIT-CHL-CHER-01 偏差 -0.80%', buyerId);

    // 销售出库单示例
    const soInfo = db.prepare('INSERT INTO t_sales_order (so_code, customer, status, total_boxes, total_net_weight, created_by) VALUES (?,?,?,?,?,?)')
      .run('SO-' + dateStamp(new Date(today.getTime() - 1 * 86400000)) + '-001', '盒马鲜生（华东）', 'COMPLETED', 200, 1000, buyerId);
    db.prepare(
      `INSERT INTO t_sales_order_item (so_id, sku_code, batch_id, batch_code, box_count, net_weight, remaining_ratio, fefo_warning) VALUES (?,?,?,?,?,?,?,?)`
    ).run(soInfo.lastInsertRowid, 'FRUIT-CHL-CHER-01', 1, db.prepare('SELECT batch_code FROM t_inventory_batch WHERE id=1').get().batch_code, 200, 1000, 1.0, 0);
  })();

  console.log('[seed] 初始化示例数据完成');
}

run();
