import React, { useState } from 'react';

export default function TransactionEngine() {
  // State for form inputs
  const [walletId, setWalletId] = useState('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('1.0');
  const [network, setNetwork] = useState('polygon');

  // State for server responses
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExecute = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // 🚀 This fetch call sends a proper POST request with the hidden data package!
      const response = await fetch('http://localhost:5000/api/execute-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId: walletId.trim(),
          destinationAddress: destination.trim(),
          amount: amount,
          network: network
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // This captures our custom INSUFFICIENT_FUNDS_REJECTION guard-rail!
        throw new Error(data.message || data.error || 'Transaction failed');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '20px auto', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2>🛡️ SubOne Protocol Transaction Engine</h2>
      <p style={{ fontSize: '14px', color: '#666' }}>Phase 4: Pre-Flight Guard-Rail Automation</p>
      
      <form onSubmit={handleExecute} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Source Wallet ID:</label>
          <input 
            type="text" 
            placeholder="Paste individual wallet id here" 
            value={walletId} 
            onChange={(e) => setWalletId(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Destination Address:</label>
          <input 
            type="text" 
            placeholder="0x..." 
            value={destination} 
            onChange={(e) => setDestination(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Amount:</label>
            <input 
              type="number" 
              step="0.01"
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Network:</label>
            <select 
              value={network} 
              onChange={(e) => setNetwork(e.target.value)}
              style={{ width: '100%', padding: '8px', height: '37px', boxSizing: 'border-box' }}
            >
              <option value="polygon">Polygon (Amoy)</option>
              <option value="arbitrum">Arbitrum (Sepolia)</option>
              <option value="base">Base (Sepolia)</option>
              <option value="avalanche">Avalanche (Fuji)</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Running Pre-Flight Check...' : 'Execute Automated Transfer'}
        </button>
      </form>

      {/* ERROR DISPLAY (Our Guard-Rail Trigger) */}
      {error && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#ffebee', color: '#c62828', borderLeft: '5px solid #c62828', borderRadius: '4px' }}>
          <strong>🚨 Guard-Rail Rejection:</strong>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {/* SUCCESS DISPLAY */}
      {result && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#e8f5e9', color: '#2e7d32', borderLeft: '5px solid #2e7d32', borderRadius: '4px' }}>
          <strong>✅ Success!</strong>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Transaction ID: {result.txId}</p>
        </div>
      )}
    </div>
  );
}