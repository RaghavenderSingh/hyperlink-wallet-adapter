# Examples

This document provides comprehensive examples of how to use the HyperLink Wallet Adapter library in various scenarios.

## Table of Contents

- [Basic Integration](#basic-integration)
- [React Integration](#react-integration)
- [Transaction Examples](#transaction-examples)
- [Sign-In Examples](#sign-in-examples)
- [Advanced Usage](#advanced-usage)
- [Error Handling](#error-handling)
- [Real-World Scenarios](#real-world-scenarios)

## Basic Integration

### Simple Wallet Connection

```typescript
import { HyperLinkWalletAdapter } from "hyperlink-wallet-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Create a new wallet adapter instance
const wallet = new HyperLinkWalletAdapter({
  clientId: "your-client-id",
  title: "My dApp",
  theme: "system",
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet,
});

// Connect to the wallet
async function connectWallet() {
  try {
    await wallet.connect();
    console.log("Connected successfully!", wallet.publicKey?.toBase58());
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

// Disconnect from the wallet
async function disconnectWallet() {
  try {
    await wallet.disconnect();
    console.log("Disconnected successfully!");
  } catch (error) {
    console.error("Disconnection failed:", error);
  }
}
```

### Wallet Registration

```typescript
import { registerHyperLinkWallet } from "hyperlink-wallet-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Register the wallet adapter
const unregister = registerHyperLinkWallet({
  clientId: "your-client-id",
  title: "My dApp",
  theme: "system",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  installedOnDesktop: true,
  installedOnIos: true,
  installedOnAndroid: false,
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet,
});

// Unregister when the application unmounts
unregister();
```

## React Integration

### Basic React Component

```typescript
import React, { useState, useEffect } from 'react';
import { HyperLinkWalletAdapter } from 'hyperlink-wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

function WalletComponent() {
  const [wallet, setWallet] = useState<HyperLinkWalletAdapter | null>(null);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    // Create the wallet adapter instance
    const newWallet = new HyperLinkWalletAdapter({
      clientId: 'your-client-id',
      title: 'My dApp',
      theme: 'system',
      walletAdapterNetwork: WalletAdapterNetwork.Mainnet
    });

    // Set up event listeners for wallet connection events
    newWallet.on('connect', (pk) => {
      setConnected(true);
      setPublicKey(pk.toBase58());
    });

    newWallet.on('disconnect', () => {
      setConnected(false);
      setPublicKey(null);
    });

    setWallet(newWallet);

    // Cleanup when component unmounts
    return () => {
      newWallet.disconnect();
    };
  }, []);

  const connect = async () => {
    if (wallet) {
      try {
        await wallet.connect();
      } catch (error) {
        console.error('Connection failed:', error);
      }
    }
  };

  const disconnect = async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
      } catch (error) {
        console.error('Disconnection failed:', error);
      }
    }
  };

  return (
    <div>
      {!connected ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <div>
          <p>Connected: {publicKey}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

export default WalletComponent;
```

### With React Wallet Adapter

```typescript
import React from 'react';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { HyperLinkWalletAdapter } from 'hyperlink-wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Import the wallet adapter CSS styles
import '@solana/wallet-adapter-react-ui/styles.css';

const wallets = [
  new HyperLinkWalletAdapter({
    clientId: 'your-client-id',
    title: 'My dApp',
    theme: 'system',
    walletAdapterNetwork: WalletAdapterNetwork.Mainnet
  })
];

function App() {
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <div>
          <h1>My Solana dApp</h1>
          <WalletActions />
        </div>
      </WalletModalProvider>
    </WalletProvider>
  );
}

function WalletActions() {
  const { connect, disconnect, connected, publicKey } = useWallet();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  return (
    <div>
      {!connected ? (
        <button onClick={handleConnect}>Connect Wallet</button>
      ) : (
        <div>
          <p>Connected: {publicKey?.toBase58()}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

export default App;
```

### Complete Next.js Example

Here is a complete working example of integrating the wallet adapter in a Next.js application with a transaction form:

```typescript
"use client";

import React, { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { HyperLinkWalletAdapter } from "hyperlink-wallet-adapter";
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

function SendSolForm() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setStatus("");

      // Validate recipient address
      const recipientPubkey = new PublicKey(recipient);

      // Convert SOL to lamports
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      // Create transfer instruction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      setStatus(`Success! Transaction signature: ${signature}`);
      setRecipient("");
      setAmount("");
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center text-gray-500">
        Please connect your wallet to send SOL
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">Send SOL</h2>
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter wallet address"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Amount (SOL)
          </label>
          <input
            type="number"
            step="0.000000001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send SOL"}
        </button>

        {status && (
          <div
            className={`p-3 rounded-lg text-sm ${
              status.startsWith("Success")
                ? "bg-green-100 text-green-800"
                : status.startsWith("Error")
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {status}
          </div>
        )}
      </form>
    </div>
  );
}

export default function Wallet() {
  // Use Solana devnet for testing (or mainnet for production)
  const endpoint = useMemo(() => "https://api.devnet.solana.com", []);

  const wallets = useMemo(
    () => [
      new HyperLinkWalletAdapter({
        title: "My dApp Name",
        clientId: "your-client-id-from-hyperlink",
        theme: "dark", // Choose from "dark", "light", or "system"
        walletAdapterNetwork: WalletAdapterNetwork.Devnet,
      }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
            <h1 className="text-3xl font-bold">HyperLink Wallet Demo</h1>

            <div className="flex gap-4">
              <WalletMultiButton />
              <WalletDisconnectButton />
            </div>

            <SendSolForm />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

## Transaction Examples

### Simple SOL Transfer

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

function TransferComponent() {
  const { wallet, publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.1');
  const [loading, setLoading] = useState(false);

  const sendTransaction = async () => {
    if (!connected || !publicKey || !recipient) return;

    try {
      setLoading(true);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(recipient),
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL
        })
      );

      const signature = await wallet.sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature);
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }

      alert('Transaction successful!');
    } catch (error) {
      console.error('Transaction failed:', error);
      alert('Transaction failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Send SOL</h3>
      <input
        type="text"
        placeholder="Recipient Public Key"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount (SOL)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        step="0.01"
        min="0"
      />
      <button
        onClick={sendTransaction}
        disabled={!connected || !recipient || loading}
      >
        {loading ? 'Sending...' : 'Send SOL'}
      </button>
    </div>
  );
}
```

### SPL Token Transfer

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction } from '@solana/spl-token';

function TokenTransferComponent() {
  const { wallet, publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [recipient, setRecipient] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [amount, setAmount] = useState('1');
  const [loading, setLoading] = useState(false);

  const sendToken = async () => {
    if (!connected || !publicKey || !recipient || !tokenMint) return;

    try {
      setLoading(true);

      // Get token accounts
      const fromTokenAccount = await connection.getTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(tokenMint)
      });

      const toTokenAccount = await connection.getTokenAccountsByOwner(
        new PublicKey(recipient),
        { mint: new PublicKey(tokenMint) }
      );

      if (fromTokenAccount.value.length === 0) {
        throw new Error('No token account found for sender');
      }

      if (toTokenAccount.value.length === 0) {
        throw new Error('No token account found for recipient');
      }

      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount.value[0].pubkey,
          toTokenAccount.value[0].pubkey,
          publicKey,
          BigInt(parseFloat(amount) * Math.pow(10, 9)) // Assuming 9 decimals
        )
      );

      const signature = await wallet.sendTransaction(transaction, connection);
      console.log('Token transfer sent:', signature);

      const confirmation = await connection.confirmTransaction(signature);
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }

      alert('Token transfer successful!');
    } catch (error) {
      console.error('Token transfer failed:', error);
      alert('Token transfer failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Send SPL Token</h3>
      <input
        type="text"
        placeholder="Token Mint Address"
        value={tokenMint}
        onChange={(e) => setTokenMint(e.target.value)}
      />
      <input
        type="text"
        placeholder="Recipient Public Key"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        step="0.01"
        min="0"
      />
      <button
        onClick={sendToken}
        disabled={!connected || !recipient || !tokenMint || loading}
      >
        {loading ? 'Sending...' : 'Send Token'}
      </button>
    </div>
  );
}
```

### Multiple Transaction Signing

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

function BatchTransferComponent() {
  const { wallet, publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [recipients, setRecipients] = useState(['', '']);
  const [amount, setAmount] = useState('0.1');
  const [loading, setLoading] = useState(false);

  const sendBatchTransactions = async () => {
    if (!connected || !publicKey || recipients.some(r => !r)) return;

    try {
      setLoading(true);

      const transactions = recipients.map(recipient =>
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(recipient),
            lamports: parseFloat(amount) * LAMPORTS_PER_SOL
          })
        )
      );

      // Sign all transactions
      const signedTransactions = await wallet.signAllTransactions(transactions);

      // Send each transaction
      const signatures = [];
      for (const signedTx of signedTransactions) {
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        signatures.push(signature);
      }

      console.log('Batch transactions sent:', signatures);
      alert('Batch transactions successful!');
    } catch (error) {
      console.error('Batch transactions failed:', error);
      alert('Batch transactions failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  return (
    <div>
      <h3>Batch Transfer SOL</h3>
      {recipients.map((recipient, index) => (
        <div key={index}>
          <input
            type="text"
            placeholder={`Recipient ${index + 1} Public Key`}
            value={recipient}
            onChange={(e) => updateRecipient(index, e.target.value)}
          />
          {recipients.length > 1 && (
            <button onClick={() => removeRecipient(index)}>Remove</button>
          )}
        </div>
      ))}
      <button onClick={addRecipient}>Add Recipient</button>
      <input
        type="number"
        placeholder="Amount per recipient (SOL)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        step="0.01"
        min="0"
      />
      <button
        onClick={sendBatchTransactions}
        disabled={!connected || recipients.some(r => !r) || loading}
      >
        {loading ? 'Sending...' : 'Send Batch Transactions'}
      </button>
    </div>
  );
}
```

## Sign-In Examples

### Basic Sign-In

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function SignInComponent() {
  const { wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const handleSignIn = async () => {
    if (!wallet || !('signIn' in wallet)) return;

    try {
      setLoading(true);

      const siwsInput = {
        domain: 'yourdomain.com',
        statement: 'Sign in to access the application',
        uri: 'https://yourdomain.com',
        version: '1',
        chainId: 'solana:mainnet',
        nonce: 'random-nonce-' + Date.now(),
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notBefore: new Date().toISOString(),
        resources: ['https://yourdomain.com']
      };

      const output = await wallet.signIn(siwsInput);
```
