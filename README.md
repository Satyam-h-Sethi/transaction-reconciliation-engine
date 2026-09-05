# Transaction Reconciliation Engine

A lightweight, zero-dependency financial transaction reconciliation engine that matches internal ledger transactions against external payment gateway/bank statements with automated discrepancy detection, duplicate alerts, and an interactive browser dashboard.

## Features

- **Multi-Status Matching Logic**: Categorizes every record into `MATCHED`, `DISCREPANCY` (amount/currency mismatch), `UNMATCHED_INTERNAL`, `UNMATCHED_EXTERNAL`, and `DUPLICATE`.
- **Zero Dependencies**: Powered solely by native Node.js core modules (`http`, `fs`, `path`).
- **Interactive Web Dashboard**: Premium glassmorphism dark UI with real-time KPI metrics, search filtering, and CSV report export.
- **Dual Mode Execution**: Run reconciliation directly from the CLI or launch the browser dashboard server.

## Architecture

```
transaction-reconciliation-engine/
├── index.js              # Core reconciliation logic + CLI + Web server
├── index.html            # Responsive vanilla Web UI dashboard
├── sample-internal.csv   # Sample internal ledger export
├── sample-external.csv   # Sample external bank statement export
├── package.json          # Node package definition
└── README.md             # Documentation
```

## Setup & Quick Start

No external packages to install. Requires Node.js 16+ or modern browser.

### CLI Mode

Run reconciliation on sample datasets:
```bash
node index.js
```

Or pass your own CSV files:
```bash
node index.js --internal ./my-internal.csv --external ./my-external.csv
```

### Web Dashboard Mode

Launch the local web server:
```bash
node index.js --web 3000
```
Open `http://localhost:3000` in your browser. Alternatively, you can open `index.html` directly in any web browser (`file://`).

## License

MIT
