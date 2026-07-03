import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import './App.css'; 
import { useTransactionStatus } from './hooks/useTransactionStatus';

// STABILITY FIX: Added 'polling' to match the server configuration
// This allows the connection to stay alive if the websocket is briefly interrupted.
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

function App() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  
  const [activeTxHash, setActiveTxHash] = useState(null);
  const { status } = useTransactionStatus(activeTxHash);

  const [username] = useState('subone_test_user_01'); 
  const [dbUser, setDbUser] = useState(null);
  const [walletId, setWalletId] = useState('');
  const [balance, setBalance] = useState('0.00'); 
  const [totalBalance, setTotalBalance] = useState('0.00');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('0.5');
  const [network, setNetwork] = useState('polygon'); 
  const [availableWallets, setAvailableWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [history, setHistory] = useState([]);

  // FIX: Stability - listener remains outside the dependency loop
  useEffect(() => {
    const handleUpdate = (data) => {
      console.log("📡 WebSocket Received Update:", data);
      
      setHistory(prev => prev.map(tx => 
        tx.circleTxId === data.circleTxId ? { ...tx, status: data.status } : tx
      ));
    };

    socket.on('txUpdate', handleUpdate);
    return () => socket.off('txUpdate', handleUpdate);
  }, []); 

  const alerts = useMemo(() => {
    return history.filter(tx => ['FAILED', 'DENIED', 'STUCK'].includes(tx.status));
  }, [history]);

  const fetchGlobalBalance = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/total-balance`);
      const data = await res.json();
      if (data.success) setTotalBalance(data.totalBalance);
    } catch (err) { console.error("Error fetching global balance:", err); }
  };

  const fetchCurrentBalance = async (targetWalletId) => {
    if (!targetWalletId) return;
    try {
      const res = await fetch(`${API_BASE}/api/wallet-balances?walletId=${targetWalletId}&t=${Date.now()}`);
      const data = await res.json();
      const usdc = data.balances?.find(b => b.token?.symbol === 'USDC');
      setBalance(usdc ? usdc.amount : '0.00');
    } catch (err) { setBalance('Error'); }
  };

  const fetchHistory = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/transaction-history/${username}?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } finally { setIsRefreshing(false); }
  }, [API_BASE, username]);

  const handleSyncTransaction = async (e, circleTxId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/sync-transaction/${circleTxId}`);
      const data = await res.json();
      if (data.success) fetchHistory();
    } catch (err) { console.error("Sync error:", err); }
  };

  const handleManualSync = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const userRes = await fetch(`${API_BASE}/api/user-profile/${username}`);
        const userData = await userRes.json();
        if (userData.success) setDbUser(userData.user);

        const walletRes = await fetch(`${API_BASE}/api/list-wallets`);
        const walletData = await walletRes.json();
        setAvailableWallets(walletData);

        if (walletData?.length > 0) {
          const match = walletData.find(w => w.blockchain.toLowerCase().includes('matic'));
          if (match) setWalletId(match.id);
        }
        fetchHistory();
        fetchGlobalBalance();
      } catch (err) { setErrorMessage('Failed to connect to the SubOne Protocol server.'); }
    };
    initData();
  }, [username, fetchHistory]);

  useEffect(() => {
    if (walletId) {
      setBalance('Loading...');
      fetchCurrentBalance(walletId);
    }
  }, [walletId]);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, destinationAddress, amount, network }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        const transactionData = data.transaction;
        setHistory(prev => [transactionData, ...prev]); 
        setTxResult(transactionData);
        setActiveTxHash(transactionData.txHash || transactionData.circleTxId); 
        fetchCurrentBalance(walletId);
        fetchGlobalBalance();
      } else {
        setErrorMessage(data.error || 'Transaction processing failed.');
      }
    } catch (err) {
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
      <div className="liquidity-banner" style={{ background: '#111827', color: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Protocol Liquidity: <strong>{totalBalance} USDC</strong></span>
        <button onClick={fetchGlobalBalance} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>Refresh Global</button>
      </div>

      <main className="dashboard-grid">
        <section className="transfer-panel tool-card">
          <h2>Multi-Chain Transfer Engine</h2>
          <p className="subtitle">Circle Programmable Wallets Core</p>
          
          {alerts.length > 0 && (
            <div className="alert-panel" style={{ border: '1px solid #ef4444', padding: '10px', marginBottom: '20px', borderRadius: '8px', backgroundColor: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 style={{ color: '#ef4444', margin: '0 0 5px 0', fontSize: '1rem' }}>⚠️ {alerts.length} Transactions Failed</h3></div>
              <button onClick={() => window.scrollTo(0, document.body.scrollHeight)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>View History</button>
            </div>
          )}
          
          {activeTxHash && (
            <div className="status-banner info">
              <strong>Stream Review:</strong> Monitoring {status}...
            </div>
          )}

          <form onSubmit={handleExecuteTransaction} className="transfer-form">
            <div className="form-group">
              <label htmlFor="networkSelect">1. Target EVM Blockchain</label>
              <select id="networkSelect" value={network} onChange={(e) => handleNetworkChange(e.target.value)}>
                <option value="polygon">Polygon Amoy</option>
                <option value="arbitrum">Arbitrum Sepolia</option>
                <option value="avalanche">Avalanche Fuji</option>
                <option value="base">Base Sepolia</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sourceWallet">2. Source Wallet ID (Auto-Selected)</label>
              <input id="sourceWallet" type="text" readOnly value={walletId || 'No active wallet mapped'} className="input-readonly" />
            </div>
            
            <div className="balance-card">
               <label>Available USDC Balance</label>
               <span className="balance-display">{balance} USDC</span>
            </div>

            <div className="form-group">
              <label htmlFor="destination">3. Destination Wallet Address</label>
              <input id="destination" type="text" required placeholder="0x..." value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="amountInput">4. Amount (USDC)</label>
              <input id="amountInput" type="number" step="any" required placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            {errorMessage && <div className="status-banner error"><strong>Error:</strong> {errorMessage}</div>}

            {txResult && (
              <div className="status-banner success">
                <strong>Transaction Executed!</strong>
                <p>Status: {txResult.status}</p>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading || !walletId}>
              {loading ? 'Executing on Chain...' : 'Execute Transaction'}
            </button>
          </form>
        </section>

        <section className="history-panel tool-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Transaction History</h2>
            <button 
              onClick={handleManualSync} 
              disabled={isRefreshing}
              style={{ background: isRefreshing ? '#374151' : '#1f2937', border: '1px solid #374151', color: '#38bdf8', padding: '5px 10px', borderRadius: '4px', cursor: isRefreshing ? 'wait' : 'pointer' }}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh History'}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Network</th>
                <th>Amount (USDC)</th>
                <th>Tx Hash</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((tx) => (
                <tr key={tx._id}>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td>{tx.blockchain}</td>
                  <td>{tx.amount}</td>
                  <td>
                    {tx.txHash ? (
                      <a href={`https://amoy.polygonscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.7rem' }}>
                        {tx.txHash.substring(0, 8)}...
                      </a>
                    ) : (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          type="button"
                          onClick={(e) => handleSyncTransaction(e, tx.circleTxId)}
                          style={{ backgroundColor: '#f59e0b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}
                        >
                          Sync
                        </button>
                        {tx.status === 'FAILED' && (
                          <button 
                            onClick={async () => {
                              await fetch(`${API_BASE}/api/transaction/${tx._id}`, { method: 'DELETE' });
                              fetchHistory();
                            }}
                            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            X
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td><span className={`status-badge ${tx.status?.toLowerCase()}`}>{tx.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default App;