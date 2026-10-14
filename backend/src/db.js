const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { dbFile } = require('./config');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS t_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_supplier (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    contact TEXT,
    credit_limit_cny REAL NOT NULL DEFAULT 0,
    credit_used_cny REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_purchase_order (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_code TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    incoterms TEXT NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate REAL NOT NULL,
    total_amount REAL NOT NULL,
    total_amount_cny REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    contract_file TEXT,
    remark TEXT,
    created_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at DATETIME,
    reject_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_purchase_order_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    sku_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    origin_country TEXT,
    box_count INTEGER NOT NULL,
    gross_weight_kg REAL NOT NULL,
    net_weight_kg REAL NOT NULL,
    weight_tolerance_pct REAL NOT NULL DEFAULT 3.00,
    unit_price_per_box REAL,
    unit_price_per_kg REAL,
    temperature_requirement TEXT NOT NULL,
    sub_total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS t_shipment_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_code TEXT UNIQUE NOT NULL,
    po_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    transport_mode TEXT NOT NULL DEFAULT 'SEA',
    vessel TEXT,
    container_no TEXT,
    seal_no TEXT,
    bl_no TEXT,
    departure_port TEXT,
    arrival_port TEXT,
    etd DATE,
    eta DATE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_shipment_document (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    doc_name TEXT NOT NULL,
    is_required INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PENDING',
    file_name TEXT,
    key_fields TEXT,
    uploaded_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS t_inventory_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code TEXT UNIQUE NOT NULL,
    sku_code TEXT NOT NULL,
    product_name TEXT,
    po_id INTEGER,
    shipment_id INTEGER,
    origin_country TEXT NOT NULL,
    plant_approval_no TEXT NOT NULL,
    production_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    shelf_life_days INTEGER,
    warehouse_id INTEGER NOT NULL,
    warehouse_name TEXT,
    zone_type TEXT NOT NULL,
    current_boxes INTEGER NOT NULL DEFAULT 0,
    current_net_weight REAL NOT NULL DEFAULT 0,
    planned_net_weight REAL NOT NULL DEFAULT 0,
    temperature_requirement TEXT,
    sales_locked INTEGER NOT NULL DEFAULT 0,
    lock_reason TEXT,
    status TEXT NOT NULL DEFAULT 'IN_STOCK',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_landing_cost_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    cost_type TEXT NOT NULL,
    amount_cny REAL NOT NULL,
    allocation_method TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_landing_cost_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    sku_code TEXT NOT NULL,
    landed_cost_per_kg REAL NOT NULL,
    landed_cost_per_box REAL NOT NULL,
    allocated_cost_cny REAL NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_approval (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biz_type TEXT NOT NULL,
    biz_id INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    applicant_id INTEGER,
    approver_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    handled_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS t_sales_order (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    so_code TEXT UNIQUE NOT NULL,
    customer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED',
    total_boxes INTEGER NOT NULL DEFAULT 0,
    total_net_weight REAL NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_sales_order_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    so_id INTEGER NOT NULL,
    sku_code TEXT NOT NULL,
    batch_id INTEGER NOT NULL,
    batch_code TEXT,
    box_count INTEGER NOT NULL,
    net_weight REAL NOT NULL DEFAULT 0,
    remaining_ratio REAL NOT NULL DEFAULT 1,
    fefo_warning INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_alert (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'HIGH',
    batch_id INTEGER,
    batch_code TEXT,
    warehouse_name TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_temperature_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    warehouse_name TEXT,
    temperature REAL NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_customs_declaration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    declaration_no TEXT NOT NULL,
    hs_code TEXT NOT NULL,
    tariff_rate REAL NOT NULL,
    vat_rate REAL NOT NULL,
    cif_amount_cny REAL NOT NULL,
    dutiable_value_cny REAL NOT NULL,
    tariff_amount_cny REAL NOT NULL,
    vat_amount_cny REAL NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_po_status ON t_purchase_order(status);
  CREATE INDEX IF NOT EXISTS idx_batch_sku ON t_inventory_batch(sku_code);
  CREATE INDEX IF NOT EXISTS idx_batch_expiry ON t_inventory_batch(expiry_date);
  CREATE INDEX IF NOT EXISTS idx_temp_batch ON t_temperature_log(batch_id);

  CREATE TABLE IF NOT EXISTS t_file (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL,
    biz_type TEXT,
    biz_id INTEGER,
    uploaded_by INTEGER,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_inventory_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    batch_code TEXT,
    action TEXT NOT NULL,
    box_delta INTEGER NOT NULL DEFAULT 0,
    weight_delta REAL NOT NULL DEFAULT 0,
    before_boxes INTEGER NOT NULL DEFAULT 0,
    after_boxes INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    operator_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS t_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    method TEXT,
    path TEXT,
    action TEXT,
    detail TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_file_biz ON t_file(biz_type, biz_id);
  CREATE INDEX IF NOT EXISTS idx_invlog_batch ON t_inventory_log(batch_id);

  CREATE TABLE IF NOT EXISTS t_shipment_node (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    node_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remark TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_shipnode_shipment ON t_shipment_node(shipment_id);
  `);
}

function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function migrate() {
  addColumnIfMissing('t_user', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_user', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  addColumnIfMissing('t_supplier', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_purchase_order', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_purchase_order', 'contract_file_id', 'INTEGER');
  addColumnIfMissing('t_shipment_batch', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_shipment_batch', 'remark', 'TEXT');
  addColumnIfMissing('t_shipment_document', 'file_id', 'INTEGER');
  addColumnIfMissing('t_inventory_batch', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_customs_declaration', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_sales_order', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('t_sales_order', 'remark', 'TEXT');
  addColumnIfMissing('t_alert', 'is_deleted', 'INTEGER NOT NULL DEFAULT 0');
}

initSchema();
migrate();

module.exports = db;
