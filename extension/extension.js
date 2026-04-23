const vscode = require('vscode');
const https = require('https');
const http = require('http');

// Configuration
const DEFAULT_NODE_URL = 'https://50.28.86.131';

// State
let balance = null;
let minerStatus = null;
let epochInfo = null;
let bounties = [];

// API helper
function apiRequest(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, vscode.workspace.getConfiguration('rustchain').get('nodeUrl', DEFAULT_NODE_URL));
        const protocol = url.protocol === 'https:' ? https : http;
        
        protocol.get(url.href, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', reject);
    });
}

// Fetch wallet balance
async function fetchBalance(walletName) {
    try {
        const data = await apiRequest(`/wallet/balance?wallet_id=${walletName}`);
        balance = data.balance || 0;
        return balance;
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch balance: ${err.message}`);
        return null;
    }
}

// Fetch miner status
async function fetchMinerStatus() {
    try {
        const data = await apiRequest('/api/miners');
        const wallet = vscode.workspace.getConfiguration('rustchain').get('walletName', '');
        
        if (wallet) {
            const miner = (data.miners || []).find(m => m.name === wallet);
            minerStatus = miner ? { active: true, ...miner } : { active: false };
        }
        return minerStatus;
    } catch (err) {
        return null;
    }
}

// Fetch epoch info
async function fetchEpoch() {
    try {
        const data = await apiRequest('/epoch');
        epochInfo = data;
        return data;
    } catch (err) {
        return null;
    }
}

// Fetch bounties from GitHub
async function fetchBounties() {
    try {
        const response = await vscode.env.openExternal(
            vscode.Uri.parse('https://api.github.com/repos/Scottcjn/rustchain-bounties/issues?state=open&labels=bounty')
        );
        return [];
    } catch {
        return [];
    }
}

// Update status bar
function updateStatusBar() {
    if (balance !== null) {
        vscode.commands.executeCommand('setContext', 'rustchain.balance', `${balance} RTC`);
    }
}

// Provider for the dashboard view
class RustChainDashboardProvider {
    constructor(context) {
        this._context = context;
    }

    resolveWebviewView(view) {
        this.view = view;
        this.refresh();
    }

    async refresh() {
        if (!this.view) return;
        
        const wallet = vscode.workspace.getConfiguration('rustchain').get('walletName', '');
        
        if (!wallet) {
            this.view.webview.html = this.getNoWalletHtml();
            return;
        }

        await Promise.all([
            fetchBalance(wallet),
            fetchMinerStatus(),
            fetchEpoch()
        ]);

        this.view.webview.html = this.getDashboardHtml();
        updateStatusBar();
    }

    getNoWalletHtml() {
        return `
        <!DOCTYPE html>
        <html>
        <body>
            <h2>🦀 RustChain Dashboard</h2>
            <p>No wallet configured.</p>
            <p>Run <code>RustChain: Set Wallet</code> to get started.</p>
            <button onclick="vscode.postMessage({command: 'setWallet'})">Set Wallet</button>
        </body>
        </html>`;
    }

    getDashboardHtml() {
        const wallet = vscode.workspace.getConfiguration('rustchain').get('walletName', '');
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { padding: 20px; font-family: system-ui; }
                .card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); 
                        border-radius: 8px; padding: 16px; margin-bottom: 12px; }
                .balance { font-size: 24px; font-weight: bold; color: #f97316; }
                .status { display: flex; align-items: center; gap: 8px; }
                .dot { width: 10px; height: 10px; border-radius: 50%; }
                .active { background: #22c55e; }
                .inactive { background: #ef4444; }
                .btn { background: #f97316; color: white; border: none; padding: 8px 16px; 
                       border-radius: 4px; cursor: pointer; margin-top: 8px; }
                .btn:hover { background: #ea580c; }
                .refresh { float: right; cursor: pointer; }
            </style>
        </head>
        <body>
            <span class="refresh" onclick="vscode.postMessage({command: 'refresh'})">🔄</span>
            <h2>🦀 RustChain Dashboard</h2>
            
            <div class="card">
                <div>Wallet</div>
                <div><strong>${wallet}</strong></div>
            </div>
            
            <div class="card">
                <div>Balance</div>
                <div class="balance">${balance !== null ? balance : '...'} RTC</div>
            </div>
            
            <div class="card">
                <div>Miner Status</div>
                <div class="status">
                    <span class="dot ${minerStatus?.active ? 'active' : 'inactive'}"></span>
                    <span>${minerStatus?.active ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
            
            <div class="card">
                <div>Epoch</div>
                <div>${epochInfo?.epoch || '...'}</div>
                ${epochInfo?.next_epoch_in ? `<div>Next in: ${epochInfo.next_epoch_in}s</div>` : ''}
            </div>
            
            <button class="btn" onclick="vscode.postMessage({command: 'openBounty'})">
                🚀 Browse Bounties
            </button>
            
            <script>
                const vscode = acquireVsCodeApi();
            </script>
        </body>
        </html>`;
    }
}

// Extension entry point
function activate(context) {
    // Register provider
    const provider = new RustChainDashboardProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('rustchainDashboard', provider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('rustchain.refresh', () => {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('rustchain.setWallet', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter your RustChain wallet name',
                placeHolder: 'e.g., hermes-agent'
            });
            if (name) {
                await vscode.workspace.getConfiguration('rustchain').update('walletName', name, true);
                provider.refresh();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('rustchain.openBounty', () => {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/Scottcjn/rustchain-bounties/issues?q=is%3Aissue+is%3Aopen+label%3Abounty')
            );
        })
    );

    // Handle messages from webview
    context.subscriptions.push(
        vscode.window.onDidReceiveMessage(message => {
            if (message.command === 'refresh') provider.refresh();
            if (message.command === 'setWallet') vscode.commands.executeCommand('rustchain.setWallet');
            if (message.command === 'openBounty') vscode.commands.executeCommand('rustchain.openBounty');
        })
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
