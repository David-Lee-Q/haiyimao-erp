const db = require('../db');
const { chat } = require('./llm');

const TABLE_NOTES = {
  t_purchase_order: '采购订单主表（status: DRAFT草稿/PENDING_APPROVE待审批/CONFIRMED已确认/IN_TRANSIT运输中/COMPLETED已完成/REJECTED已驳回/CANCELLED已取消；total_amount原币金额，total_amount_cny折合人民币）',
  t_purchase_order_item: '采购订单明细（box_count箱数，net_weight_kg净重，unit_price_per_box按箱单价，unit_price_per_kg按公斤单价，temperature_requirement温区）',
  t_supplier: '供应商（credit_limit_cny信用额度，credit_used_cny已占用额度，country原产国）',
  t_shipment_batch: '国际货运批次（status: PORT_DEPARTURE离港/IN_TRANSIT运输中/PORT_ARRIVED到港/CUSTOMS_CLEARING报关中/RELEASED放行/WAREHOUSED已入库）',
  t_shipment_document: '货运单证（doc_type: BL/CO/PHYTO/CUSTOMS等，status: UPLOADED/PENDING）',
  t_inventory_batch: '库存批次（current_boxes当前箱数，current_net_weight当前净重，zone_type: FROZEN/CHILLED/AMBIENT，expiry_date到期日，sales_locked是否锁定，warehouse_name仓库）',
  t_landing_cost_detail: '落地成本费用明细（cost_type费用类型，amount_cny金额，allocation_method分摊方式）',
  t_landing_cost_item: '落地成本分摊结果（landed_cost_per_kg每公斤成本，landed_cost_per_box每箱成本）',
  t_sales_order: '销售出库单（customer客户，total_boxes总箱数，total_net_weight总净重，is_deleted作废标记）',
  t_sales_order_item: '销售出库明细（batch_code出库批次，box_count出库箱数，remaining_ratio剩余保质期比例）',
  t_alert: '冷链告警（alert_type，level，status: OPEN/RESOLVED，batch_code批次）',
  t_customs_declaration: '报关记录（hs_code，tariff_amount_cny关税，vat_amount_cny增值税）',
  t_approval: '审批事项（biz_type: PURCHASE_ORDER采购审批/WEIGHT_VARIANCE磅差理赔/FEFO_FORCE临期强制出库；status: PENDING/APPROVED/REJECTED）',
  t_temperature_log: '温度上报记录（temperature温度，batch_id批次）',
  t_user: '系统用户（role角色）',
};

function getSchemaText() {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 't_%' ORDER BY name")
    .all();
  const lines = [];
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
    const colStr = cols
      .filter((c) => c.name !== 'password')
      .map((c) => `${c.name} ${c.type || ''}`.trim())
      .join(', ');
    const note = TABLE_NOTES[t.name] ? `  -- ${TABLE_NOTES[t.name]}` : '';
    lines.push(`${t.name}(${colStr})${note}`);
  }
  return lines.join('\n');
}

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|grant|revoke|transaction|commit|rollback)\b/i;

function validateSql(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') return 'SQL 为空';
  let sql = rawSql.trim().replace(/;+\s*$/, '');
  if (sql.includes(';')) return '仅允许执行单条 SQL 语句';
  if (!/^\s*(select|with)\b/i.test(sql)) return '仅允许执行只读查询（SELECT / WITH）';
  if (FORBIDDEN.test(sql)) return 'SQL 包含禁止的关键字';
  if (!/\blimit\b/i.test(sql)) sql = `${sql} LIMIT 200`;
  return { sql };
}

function runReadOnlyQuery(rawSql) {
  const checked = validateSql(rawSql);
  if (typeof checked === 'string') {
    return { sql: rawSql, columns: [], rows: [], error: checked };
  }
  const stmt = db.prepare(checked.sql);
  const rows = stmt.all().slice(0, 200);
  let columns = rows.length ? Object.keys(rows[0]) : [];
  if (!columns.length) {
    try {
      columns = stmt.columns().map((c) => c.name);
    } catch (e) {
      columns = [];
    }
  }
  return { sql: checked.sql, columns, rows };
}

function tryParseSql(content) {
  if (!content) return null;
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  let obj = null;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        obj = JSON.parse(m[0]);
      } catch (e2) {
        obj = null;
      }
    }
  }
  if (obj && typeof obj.sql === 'string') return obj;
  return null;
}

function nowText() {
  const d = new Date();
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return d.toISOString();
  }
}

function baseRules() {
  return [
    '你是「海易贸 · 生鲜外贸ERP」的智能助手，服务于生鲜进口外贸业务（采购、国际货运、保税冷链仓储、落地成本、销售出库、温控）。',
    `当前系统时间：${nowText()}（时区 Asia/Shanghai）。回答“今天/现在/本周/星期几”等时间相关问题时，必须以此为准，不要凭记忆猜测。`,
    '你可以访问系统数据库（SQLite）来回答问题。可用的表结构如下：',
    getSchemaText(),
    '',
    '查询规则：',
    '1. 当你需要查询数据时，只输出一个 JSON 对象，格式为 {"sql":"SELECT ..."}，不要输出任何其它文字、不要用代码块包裹。',
    '2. SQL 必须是只读的单条 SELECT 或 WITH 查询，禁止任何写操作；涉及“今天/当前”日期时使用 date(\'now\', \'localtime\', \'+8 hours\') 处理，必要时可用 LIMIT。',
    '3. 如果问题无需查询即可回答（如概念解释），或你已获得足够数据，直接用简体中文给出结论性的自然语言回答，不要输出 JSON。',
    '4. 回答要简洁、专业，涉及金额、重量、箱数时给出关键数字；可给出简短建议。',
    '5. 软删除数据需过滤 is_deleted = 0（若该表有该字段）。',
  ].join('\n');
}

function dataRules() {
  return [
    '你是「海易贸 · 生鲜外贸ERP」的数据分析助手。用户会用自然语言提出数据统计/查询需求。',
    `当前系统时间：${nowText()}（时区 Asia/Shanghai）。涉及“今天/当前/本周”等时间范围时以此为准。`,
    '系统数据库（SQLite）可用表结构如下：',
    getSchemaText(),
    '',
    '要求：把用户问题翻译成一条只读 SQL，并只输出 JSON：{"sql":"SELECT ..."}，不要输出任何其它文字、不要用代码块包裹。',
    'SQL 必须是单条 SELECT 或 WITH，禁止写操作；涉及“今天/当前”日期时使用 date(\'now\', \'localtime\', \'+8 hours\') 处理；聚合查询请给出有意义的列别名。',
    '若表含 is_deleted 字段，需过滤 is_deleted = 0。',
  ].join('\n');
}

async function runAgent(systemContent, userMessages, maxSteps = 4) {
  const messages = [{ role: 'system', content: systemContent }, ...userMessages];
  const queries = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const content = await chat(messages, { temperature: 0.2 });
    const parsed = tryParseSql(content);
    if (parsed && parsed.sql) {
      const result = runReadOnlyQuery(parsed.sql);
      queries.push(result);
      messages.push({ role: 'assistant', content });
      const feedback = result.error
        ? `[系统执行SQL出错]\nSQL: ${result.sql}\n错误: ${result.error}\n请修正后重新输出 JSON。`
        : `[系统执行SQL结果]\n列: ${result.columns.join(', ')}\n数据(JSON): ${JSON.stringify(result.rows).slice(0, 4000)}`;
      messages.push({ role: 'user', content: feedback });
      continue;
    }
    return { answer: content.trim(), queries };
  }
  return { answer: '查询步骤过多，请把问题描述得更具体一些。', queries };
}

async function ask(messages) {
  return runAgent(baseRules(), messages);
}

async function query(question) {
  const messages = [{ role: 'user', content: question }];
  const result = await runAgent(dataRules(), messages, 4);
  const last = [...result.queries].reverse().find((q) => !q.error && q.rows);
  return {
    summary: result.answer,
    queries: result.queries,
    sql: last ? last.sql : (result.queries[0] ? result.queries[0].sql : ''),
    columns: last ? last.columns : [],
    rows: last ? last.rows : [],
  };
}

module.exports = { ask, query, runReadOnlyQuery, getSchemaText };
