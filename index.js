#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

function reconcile(internalRows, externalRows) {
  const results = [];
  const extByRef = new Map();

  externalRows.forEach(ext => {
    const ref = ext.ext_reference || ext.reference;
    if (!extByRef.has(ref)) extByRef.set(ref, []);
    extByRef.get(ref).push(ext);
  });

  const matchedExtIds = new Set();

  internalRows.forEach(intRow => {
    const ref = intRow.reference;
    const matchingExts = extByRef.get(ref) || [];

    if (matchingExts.length === 0) {
      results.push({
        status: 'UNMATCHED_INTERNAL',
        reference: ref,
        internalId: intRow.tx_id,
        amount: intRow.amount,
        currency: intRow.currency,
        externalId: 'N/A',
        variance: 'N/A',
        note: 'Missing in external statement'
      });
    } else if (matchingExts.length === 1) {
      const extRow = matchingExts[0];
      matchedExtIds.add(extRow.ext_id);

      const intAmt = parseFloat(intRow.amount);
      const extAmt = parseFloat(extRow.settled_amount || extRow.amount);
      const diff = Math.round((extAmt - intAmt) * 100) / 100;

      if (Math.abs(diff) < 0.001 && intRow.currency === extRow.currency) {
        results.push({
          status: 'MATCHED',
          reference: ref,
          internalId: intRow.tx_id,
          amount: intRow.amount,
          currency: intRow.currency,
          externalId: extRow.ext_id,
          variance: '0.00',
          note: 'Exact match'
        });
      } else {
        results.push({
          status: 'DISCREPANCY',
          reference: ref,
          internalId: intRow.tx_id,
          amount: `${intRow.amount} vs ${extRow.settled_amount || extRow.amount}`,
          currency: intRow.currency,
          externalId: extRow.ext_id,
          variance: `${diff > 0 ? '+' : ''}${diff}`,
          note: `Amount mismatch: ${diff}`
        });
      }
    } else {
      matchingExts.forEach(extRow => {
        matchedExtIds.add(extRow.ext_id);
        results.push({
          status: 'DUPLICATE',
          reference: ref,
          internalId: intRow.tx_id,
          amount: intRow.amount,
          currency: intRow.currency,
          externalId: extRow.ext_id,
          variance: 'N/A',
          note: `Duplicate external settlement detected`
        });
      });
    }
  });

  externalRows.forEach(extRow => {
    if (!matchedExtIds.has(extRow.ext_id)) {
      results.push({
        status: 'UNMATCHED_EXTERNAL',
        reference: extRow.ext_reference || extRow.reference,
        internalId: 'N/A',
        amount: extRow.settled_amount || extRow.amount,
        currency: extRow.currency,
        externalId: extRow.ext_id,
        variance: 'N/A',
        note: 'Unmatched external transaction'
      });
    }
  });

  return results;
}

function startWebServer(port = 3000) {
  const htmlPath = path.join(__dirname, 'index.html');
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      fs.readFile(htmlPath, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading dashboard');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`\n🚀 Reconciliation Engine Dashboard running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.\n');
  });
}

function runCli() {
  const args = process.argv.slice(2);

  if (args.includes('--web') || args.includes('-w')) {
    const portIdx = args.indexOf('--web') !== -1 ? args.indexOf('--web') + 1 : args.indexOf('-w') + 1;
    const port = parseInt(args[portIdx], 10) || 3000;
    startWebServer(port);
    return;
  }

  let internalPath = path.join(__dirname, 'sample-internal.csv');
  let externalPath = path.join(__dirname, 'sample-external.csv');

  const intIdx = args.indexOf('--internal');
  if (intIdx !== -1 && args[intIdx + 1]) internalPath = args[intIdx + 1];

  const extIdx = args.indexOf('--external');
  if (extIdx !== -1 && args[extIdx + 1]) externalPath = args[extIdx + 1];

  if (!fs.existsSync(internalPath) || !fs.existsSync(externalPath)) {
    console.log('Usage: node index.js [--internal <path.csv>] [--external <path.csv>] [--web <port>]');
    process.exit(1);
  }

  const internalData = fs.readFileSync(internalPath, 'utf8');
  const externalData = fs.readFileSync(externalPath, 'utf8');

  const intRows = parseCsv(internalData);
  const extRows = parseCsv(externalData);

  const results = reconcile(intRows, extRows);

  console.log('\n======================================================');
  console.log('   FINANCIAL TRANSACTION RECONCILIATION REPORT        ');
  console.log('======================================================\n');
  console.log(`Internal Records : ${intRows.length}`);
  console.log(`External Records : ${extRows.length}`);
  console.log(`Total Evaluated  : ${results.length}\n`);

  console.table(results.map(r => ({
    Status: r.status,
    Ref: r.reference,
    InternalTx: r.internalId,
    Amount: r.amount,
    ExtId: r.externalId,
    Variance: r.variance,
    Note: r.note
  })));

  const matched = results.filter(r => r.status === 'MATCHED').length;
  const discrepancies = results.filter(r => r.status === 'DISCREPANCY').length;
  const unmatched = results.filter(r => r.status.startsWith('UNMATCHED')).length;
  const duplicates = results.filter(r => r.status === 'DUPLICATE').length;

  console.log('------------------------------------------------------');
  console.log(`Summary: ${matched} Matched | ${discrepancies} Discrepancies | ${unmatched} Unmatched | ${duplicates} Duplicates`);
  console.log(`Reconciliation Rate: ${Math.round((matched / results.length) * 100)}%`);
  console.log('------------------------------------------------------\n');
  console.log('Tip: Run with `node index.js --web` to open interactive browser dashboard.\n');
}

if (require.main === module) {
  runCli();
}

module.exports = { reconcile, parseCsv };
