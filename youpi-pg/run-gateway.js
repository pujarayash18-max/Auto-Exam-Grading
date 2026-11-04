import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './packages/db/src/migrate.js';
import { MerchantRepository } from './packages/db/src/repositories/merchant.repository.js';
import { ReceivingAccountRepository } from './packages/db/src/repositories/receiving-account.repository.js';
import { startServer as startPaymentApi } from './apps/payment-api/src/index.js';
import { startCheckoutServer } from './apps/checkout-portal/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn('[Warning] Could not load .env with process.loadEnvFile:', err.message);
  }
}

process.env.YOUPI_ALLOW_LOCALHOST_MODE = 'true';
process.env.YOUPI_MODE = 'localhost';
process.env.YOUPI_BIND_HOST = '0.0.0.0';

console.log('====================================================');
console.log('🚀 Starting YOUPI PG V2 Gateway for AutoExamGrading');
console.log('====================================================');

// 1. Ensure migrations and default merchant are active
console.log('[1/3] Verifying database schema & default merchant...');
const migrationResult = runMigrations();
const { db, defaultMerchant } = migrationResult;

if (defaultMerchant) {
  try {
    const merchantRepo = new MerchantRepository(db);
    merchantRepo.update(defaultMerchant.id, {
      businessName: 'AutoExam Examination Cell',
      branding: {
        appName: 'AutoExam Payment Gateway',
        primaryColor: '#0f172a',
        logoUrl: null
      }
    });
    const accountRepo = new ReceivingAccountRepository(db);
    const accounts = accountRepo.findByMerchantId(defaultMerchant.id);
    if (accounts && accounts.length > 0) {
      accountRepo.updateAccount(accounts[0].id, {
        payeeName: 'AutoExam Examination Cell',
        upiId: 'autoexam.billing@icici',
        isActive: true
      });
    }
    console.log('[✓] Merchant synchronized: AutoExam Examination Cell (autoexam.billing@icici)');
  } catch (syncErr) {
    console.warn('[Warning] Merchant branding sync:', syncErr.message);
  }
}

// 2. Launch Payment API (port 6100)
console.log('[2/3] Launching Core Payment API on port 6100...');
const paymentPort = Number(process.env.PAYMENT_API_PORT || 6100);
const paymentApi = await startPaymentApi(paymentPort);

// 3. Launch Checkout Portal (port 7000)
console.log('[3/3] Launching Checkout Portal on port 7000...');
const checkoutPort = Number(process.env.CHECKOUT_PORTAL_PORT || 7000);
const checkoutPortal = await startCheckoutServer(checkoutPort);

console.log('====================================================');
console.log('🟢 YOUPI PG GATEWAY FULLY ONLINE');
console.log(`• Payment API:     http://localhost:${paymentPort}`);
console.log(`• Checkout Portal: http://localhost:${checkoutPort}`);
console.log('====================================================');

const shutdown = async () => {
  console.log('\nShutting down YouPI services...');
  try {
    if (checkoutPortal && checkoutPortal.close) await checkoutPortal.close();
    if (paymentApi && paymentApi.close) await paymentApi.close();
  } catch {}
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
