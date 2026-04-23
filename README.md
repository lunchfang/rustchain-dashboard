# RustChain Dashboard - VS Code Extension

A VS Code extension that displays your RustChain wallet balance, miner status, and bounty board directly in your editor.

## Features

- **Wallet Balance** - Real-time RTC balance in the sidebar
- **Miner Status** - Green/red indicator showing if your miner is active
- **Epoch Timer** - Countdown to next epoch settlement
- **Bounty Browser** - Quick access to the RustChain bounty board
- **Quick Actions** - One-click buttons for common tasks

## Requirements

- VS Code 1.85.0+ (or Cursor, Windsurf)
- A RustChain wallet name

## Installation

1. Download the `.vsix` file from releases
2. Run: `code --install-extension rustchain-dashboard-1.0.0.vsix`

Or install from VSIX:
```bash
code --install-extension rustchain-dashboard-1.0.0.vsix
```

## Configuration

1. Press `Ctrl+Shift+P` and run "RustChain: Set Wallet"
2. Enter your RustChain wallet name
3. The dashboard will automatically refresh

## API Endpoints

The extension uses these RustChain node APIs:
- `GET /health` - Node health check
- `GET /wallet/balance?wallet_id={name}` - Wallet balance
- `GET /epoch` - Current epoch info
- `GET /api/miners` - Miner list

## License

MIT
