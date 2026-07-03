import React from 'react';
import { useTransactionStatus } from '../hooks/useTransactionStatus';

const Dashboard = () => {
  // Replace 'some-tx-hash' with your actual transaction hash logic
  const { status, details } = useTransactionStatus('some-tx-hash');

  return (
    <div>
      <h1>SubOne Protocol Dashboard</h1>
      <p>Current Status: {status}</p>
    </div>
  );
};

export default Dashboard;