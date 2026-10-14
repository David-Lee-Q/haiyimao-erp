const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'frontend', 'public', 'help');
const USER = process.env.ERP_USER || 'admin';
const PASS = process.env.ERP_PASS || 'admin123';

const pages = [
  { file: 'dashboard.png', route: '/dashboard', wait: 1800 },
  { file: 'suppliers.png', route: '/suppliers', wait: 1200 },
  { file: 'purchase-list.png', route: '/purchase/orders', wait: 1400 },
  { file: 'purchase-create.png', route: '/purchase/order/create', wait: 1600 },
  { file: 'purchase-detail.png', route: '/purchase/order/1', wait: 1400 },
  { file: 'shipment-list.png', route: '/shipment/batches', wait: 6000, full: true },
  { file: 'shipment-detail.png', route: '/shipment/batch/1', wait: 1400 },
  { file: 'wms-inbound.png', route: '/wms/inbound', wait: 1400 },
  { file: 'wms-inventory.png', route: '/wms/inventory', wait: 1400 },
  { file: 'finance-landcost.png', route: '/finance/land-cost', wait: 1400 },
  { file: 'finance-customs.png', route: '/finance/customs', wait: 1600 },
  { file: 'sales-orders.png', route: '/sales/orders', wait: 1400 },
  { file: 'monitor-temperature.png', route: '/monitor/temperature', wait: 1400 },
  { file: 'approvals.png', route: '/approvals', wait: 1200 },
  { file: 'users.png', route: '/users', wait: 1200 },
  { file: 'audit-logs.png', route: '/audit-logs', wait: 1200 },
  { file: 'profile.png', route: '/profile', wait: 1000 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const loginData = await loginRes.json();
  if (!loginData.data || !loginData.data.token) throw new Error('login failed: ' + JSON.stringify(loginData));
  const token = loginData.data.token;
  const user = JSON.stringify(loginData.data.user);

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem('erp_token', t);
      localStorage.setItem('erp_user', u);
    },
    [token, user]
  );
  const page = await context.newPage();

  for (const p of pages) {
    process.stdout.write(`capture ${p.file} ... `);
    await page.goto(BASE + p.route, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(p.wait);
    await page.screenshot({ path: path.join(OUT, p.file), fullPage: !!p.full });
    console.log('ok');
  }

  await browser.close();
  console.log('ALL_DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
