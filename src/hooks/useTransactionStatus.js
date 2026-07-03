import { useState, useEffect } from 'react';
import axios from 'axios';

export const useTransactionStatus = (txHash) => {
  const [data, setData] = useState({ status: 'IDLE', details: null });

  useEffect(() => {
    if (!txHash) return;

    const fetchStatus = async () => {
      try {
        // Added '/api' prefix to match your backend route structure
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/status/${txHash}`);
        setData(response.data);
      } catch (err) {
        console.error("Failed to fetch transaction status:", err);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    
    // Initial fetch
    fetchStatus();

    return () => clearInterval(interval);
  }, [txHash]);

  return data;
};