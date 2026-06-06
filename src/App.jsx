import React, { useState, useEffect } from 'react';
import './App.css'; 

function App() {
  // Define the API base URL for environment-aware switching
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // 1. User session state & Circle API state
  const [username] = useState('subone_test_user_01'); 
  const [dbUser, setDbUser] = useState(null);
  
  const [walletId, setWalletId] = useState('');
  const [balance, setBalance] = useState('0.00'); 
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('0.5');
  const [network, setNetwork] = useState('polygon'); 
  const [availableWallets, setAvailableWallets] = useState([]);
  
  // App status and interaction tracking states
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 2. Isolated function to fetch the balance (Updated to force fresh data)
  const fetchCurrentBalance = async (targetWalletId) => {
    if (!targetWalletId) return;
    try {
      const res = await fetch(`${API_BASE}/api/wallet-balances?walletId=${targetWalletId}&t=${Date.now()}`);
      const data = await res.json();
      const usdc = data.balances?.find(b => b.token?.symbol === 'USDC');
      setBalance(usdc ? usdc.amount : '0.00');
    } catch (err) {
      console.error("Error fetching balance:", err);
      setBalance('Error');
    }
  };

  // 3. Initial Setup: Fetch Profile + Wallet List
  useEffect(() => {
    const initData = async () => {
      try {
        const userRes = await fetch(`${API_BASE}/api/user-profile/${username}`);
        const userData = await userRes.json();
        if (userData.success) setDbUser(userData.user);

        const walletRes = await fetch(`${API_BASE}/api/list-wallets`);
        const walletData = await walletRes.json();
        setAvailableWallets(walletData);

        if (walletData && walletData.length > 0) {
          const match = walletData.find(w => w.blockchain.toLowerCase().includes('matic'));
          if (match) setWalletId(match.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMessage('Failed to connect to the SubOne Protocol server.');
      }
    };
    initData();
  }, [username]);

  // 4. Fetch Balance automatically whenever the selected wallet ID changes
  useEffect(() => {
    if (walletId) {
      setBalance('Loading...');
      fetchCurrentBalance(walletId);
    }
  }, [walletId]);

  // 5. Dynamic Network Selector
  const handleNetworkChange = (selectedNetwork) => {
    setNetwork(selectedNetwork);
    setTxResult(null);
    setErrorMessage('');
    
    const match = availableWallets.find(w => {
      const bc = w.blockchain.toLowerCase();
      if (selectedNetwork === 'polygon') return bc.includes('matic');
      if (selectedNetwork === 'arbitrum') return bc.includes('arb');
      if (selectedNetwork === 'base') return bc.includes('base');
      if (selectedNetwork === 'avalanche') return bc.includes('avax');
      return false;
    });

    if (match) {
      setWalletId(match.id);
    } else { 
      setWalletId(''); 
      setBalance('0.00'); 
    }
  };

  // 6. Submit Transaction & Auto-Reload Balance System
  const handleExecuteTransaction = async (e) => {
    e.preventDefault();
    if (!walletId) {
      setErrorMessage('No source wallet found for this blockchain.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setTxResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/execute-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId,
          destinationAddress,
          amount,
          network: network 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTxResult(data.transaction || data);
        
        let checkCount = 0;
        const interval = setInterval(() => {
          fetchCurrentBalance(walletId);
          checkCount++;
          if (checkCount >= 3) {
            clearInterval(interval); 
          }
        }, 4000);

      } else {
        setErrorMessage(data.error || 'Transaction processing failed.');
      }
    } catch (err) {
      console.error("Execution engine error:", err);
      setErrorMessage('Network error initiating cross-chain transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>SubOne Protocol</h1>
      </header>

      <main className="dashboard-grid">
        <section className="transfer-panel tool-card">
          <h2>Multi-Chain Transfer Engine</h2>
          <p className="panel-subtitle">Circle Programmable Wallets Core</p>

          <form onSubmit={handleExecuteTransaction} className="transfer-form">
            
            <div className="form-group">
              <label htmlFor="networkSelect">1. Target EVM Blockchain</label>
              <select 
                id="networkSelect"
                value={network} 
                onChange={(e) => handleNetworkChange(e.target.value)}
              >
                <option value="polygon">Polygon Amoy</option>
                <option value="arbitrum">Arbitrum Sepolia</option>
                <option value="avalanche">Avalanche Fuji</option>
                <option value="base">Base Sepolia</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sourceWallet">2. Source Wallet ID (Auto-Selected)</label>
              <input 
                id="sourceWallet"
                type="text" 
                readOnly 
                value={walletId || 'No active wallet mapped to network'} 
                className="input-readonly"
              />
            </div>
            
            <div className="balance-card">
               <label>Available USDC Balance</label>
               <span className="balance-display">{balance} USDC</span>
            </div>

            <div className="form-group">
              <label htmlFor="destination">3. Destination Wallet Address</label>
              <input 
                id="destination"
                type="text" 
                required
                placeholder="0x..." 
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="amountInput">4. Amount (USDC)</label>
              <input 
                id="amountInput"
                type="number" 
                step="any"
                required
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {errorMessage && (
              <div className="status-banner error">
                <strong>Error:</strong> {errorMessage}
              </div>
            )}

            {txResult && (
              <div className="status-banner success">
                <strong>Transaction Executed!</strong>
                <p>Circle Tx ID: <code>{txResult.circleTxId || 'Broadcasted'}</code></p>
                <p>Ledger Database State: <span className="status-badge">{txResult.status}</span></p>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading || !walletId}>
              {loading ? 'Executing on Chain...' : 'Execute Transaction'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;