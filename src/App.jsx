import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import './App.css'; 
import { useTransactionStatus } from './hooks/useTransactionStatus';

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
  const [walletId, setWalletId] = useState('1d94fc2c-f649-5d38-bda8-439b69effbaa');
  const [balance, setBalance] = useState('0.00'); 
  const [totalBalance, setTotalBalance] = useState('0.00');
  
  const [destinationAddress, setDestinationAddress] = useState('0x22624036d28F96eE2e281822399790E617097241');
  const [amount, setAmount] = useState('10.0');
  const [network, setNetwork] = useState('arc'); 
  const [availableWallets, setAvailableWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [history, setHistory] = useState([]);

  const [abiFunctionSignature, setAbiFunctionSignature] = useState('subscribe(uint256)');
  const [abiParameters, setAbiParameters] = useState('10000000');

  useEffect(() => {
    const handleUpdate = (data) => {
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
          const match = walletData.find(w => w.blockchain.toLowerCase().includes('arc'));
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
      if (selectedNetwork === 'arc') return bc.includes('arc');
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
      const parsedParams = abiParameters.split(',').map(p => p.trim());

      const response = await fetch(`${API_BASE}/api/execute-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletId, 
          destinationAddress, 
          amount, 
          network,
          abiFunctionSignature,
          abiParameters: parsedParams
        }),
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
      setErrorMessage('Network error initiating contract transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <header className="dashboard-header">
        <h1>SubOne Protocol</h1>
      </header>
      <div className="liquidity-banner" style={{ background: '#111827', color: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Protocol Liquidity: <strong>{totalBalance} USDC</strong></span>
        <button onClick={fetchGlobalBalance} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>Refresh Global</button>
      </div>

      <main className="dashboard-grid">
        <section className="transfer-panel tool-card" style={{ width: '100%' }}>
          <h2>Safe-Based Treasury Manager</h2>
          <p className="subtitle">Arc Native Guardrail Engine Enabled</p>
          
          {activeTxHash && (
            <div className="status-banner info">
              <strong>Stream Review:</strong> Monitoring {status}...
            </div>
          )}

          <form onSubmit={handleExecuteTransaction} className="transfer-form">
            <div className="form-group">
              <label htmlFor="networkSelect">1. Target EVM Blockchain</label>
              <select id="networkSelect" value={network} onChange={(e) => handleNetworkChange(e.target.value)}>
                <option value="arc">Arc Testnet</option>
                <option value="polygon">Polygon Amoy</option>
                <option value="arbitrum">Arbitrum Sepolia</option>
                <option value="avalanche">Avalanche Fuji</option>
                <option value="base">Base Sepolia</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sourceWallet">2. Source Wallet ID</label>
              <input id="sourceWallet" type="text" readOnly value={walletId || 'No active wallet mapped'} className="input-readonly" />
            </div>
            
            <div className="balance-card">
               <label>Available USDC Balance</label>
               <span className="balance-display">{balance} USDC</span>
            </div>

            <div className="form-group">
              <label htmlFor="destination">3. Treasury Contract Address</label>
              <input id="destination" type="text" required placeholder="0x..." value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} />
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
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                  if (!isNaN(val) && val !== '') {
                    setAbiParameters(Math.floor(parseFloat(val) * 1000000).toString());
                  }
                }} 
              />
            </div>

            <div className="form-group">
              <label htmlFor="abiSig">5. ABI Function Signature</label>
              <input id="abiSig" type="text" required value={abiFunctionSignature} onChange={(e) => setAbiFunctionSignature(e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="abiParams">6. ABI Parameters (comma-separated)</label>
              <input id="abiParams" type="text" required value={abiParameters} onChange={(e) => setAbiParameters(e.target.value)} />
            </div>

            {errorMessage && <div className="status-banner error" style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '5px' }}><strong>🚫 Rebalance Rejected:</strong> {errorMessage}</div>}

            {txResult && !errorMessage && (
              <div className="status-banner success">
                <strong>Transaction Executed Successfully!</strong>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading || !walletId}>
              {loading ? 'Validating Guardrail & Executing...' : 'Execute Treasury Call'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;