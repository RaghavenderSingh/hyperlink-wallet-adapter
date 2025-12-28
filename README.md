# HyperLink Wallet Adapter

[![npm version](https://badge.fury.io/js/hyperlink-wallet-adapter.svg)](https://badge.fury.io/js/hyperlink-wallet-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

A Solana wallet adapter that seamlessly integrates HyperLink wallet functionality into your Solana decentralized applications. This library provides a robust and secure way for users to connect their wallets, sign transactions, and interact with the Solana blockchain.

## Features

- **Solana Wallet Standard Compliance** - Fully implements the Solana Wallet Standard for maximum compatibility
- **Multi-Platform Support** - Works across desktop, iOS, and Android devices
- **Sign-In with Solana** - Supports the Solana sign-in standard for secure authentication
- **Transaction Signing** - Sign single or multiple transactions efficiently
- **Message Signing** - Sign arbitrary messages for authentication and verification
- **Auto-Connect** - Automatically reconnects to the wallet on page reload
- **Theme Support** - Choose between light, dark, or system-based themes
- **Embedded Wallet UI** - Built-in wallet interface with customizable pages
- **Security First** - Includes allowlist protection and secure communication channels
- **Performance Optimized** - Efficient operations with minimal impact on bundle size

## Installation

```bash
npm install hyperlink-wallet-adapter
```

### Peer Dependencies

This library requires the following peer dependency:

```json
{
  "@solana/web3.js": "^1.58.0"
}
```

## Quick Start

### 1. Register the Wallet Adapter

```typescript
import { registerHyperLinkWallet } from "hyperlink-wallet-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Register the wallet adapter
const unregister = registerHyperLinkWallet({
  clientId: "YOUR_CLIENT_ID", // Get this from the HyperLink team
  title: "My dApp",
  theme: "system", // Options: 'light', 'dark', or 'system'
  rpcUrl: "https://api.mainnet-beta.solana.com",
  installedOnDesktop: true,
  installedOnIos: true,
  installedOnAndroid: false,
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet,
});

// Unregister when you no longer need the wallet
unregister();
```

### 2. Use with React Wallet Adapter

```typescript
import { WalletProvider } from '@solana/wallet-adapter-react';
import { HyperLinkWalletAdapter } from 'hyperlink-wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const wallets = [
  new HyperLinkWalletAdapter({
    clientId: 'YOUR_CLIENT_ID',
    title: 'My dApp',
    theme: 'system',
    installedOnDesktop: true,
    installedOnIos: true,
    installedOnAndroid: false,
    walletAdapterNetwork: WalletAdapterNetwork.Mainnet
  })
];

function App() {
  return (
    <WalletProvider wallets={wallets} autoConnect>
      {/* Your application components go here */}
    </WalletProvider>
  );
}
```

### 3. Connect and Use the Wallet

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';

function WalletActions() {
  const { wallet, connect, disconnect, connected, publicKey } = useWallet();
  const { connection } = useConnection();

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
```

## Documentation

- [Configuration Guide](./CONFIGURATION.md)
- [Examples](./EXAMPLES.md)
- [Security](./SECURITY.md)

## Configuration

### WalletAdapterConfig

```typescript
interface WalletAdapterConfig {
  clientId: string; // Required: Get from HyperLink team
  title: string; // Required: Your dApp name
  theme: "system" | "light" | "dark"; // Required: UI theme preference
  installedOnDesktop?: boolean; // Optional: Desktop support (default: true)
  installedOnIos?: boolean; // Optional: iOS support (default: true)
  installedOnAndroid?: boolean; // Optional: Android support (default: false)
  hideDraggableWidget?: boolean; // Optional: Hide draggable widget (default: false)
  hideWalletOnboard?: boolean; // Optional: Hide wallet onboarding (default: false)
  walletAdapterNetwork?:
    | WalletAdapterNetwork.Mainnet
    | WalletAdapterNetwork.Devnet;
}
```

## Advanced Features

### Sign-In with Solana (SIWS)

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function SignInComponent() {
  const { wallet } = useWallet();

  const handleSignIn = async () => {
    if (wallet && 'signIn' in wallet) {
      try {
        const siwsInput = {
          domain: 'yourdomain.com',
          statement: 'Sign in to access the application',
          uri: 'https://yourdomain.com',
          version: '1',
          chainId: 'solana:mainnet',
          nonce: 'random-nonce',
          issuedAt: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notBefore: new Date().toISOString(),
          resources: ['https://yourdomain.com']
        };

        const output = await wallet.signIn(siwsInput);
        console.log('Sign-in successful:', output);
      } catch (error) {
        console.error('Sign-in failed:', error);
      }
    }
  };

  return <button onClick={handleSignIn}>Sign In with Solana</button>;
}
```

### Transaction Signing

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

function TransactionComponent() {
  const { wallet, publicKey, connected } = useWallet();

  const sendTransaction = async () => {
    if (!connected || !publicKey) return;

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('RECIPIENT_PUBLIC_KEY'),
          lamports: LAMPORTS_PER_SOL * 0.1
        })
      );

      const signature = await wallet.sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return <button onClick={sendTransaction}>Send Transaction</button>;
}
```

### Message Signing

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function MessageSigningComponent() {
  const { wallet, connected } = useWallet();

  const signMessage = async () => {
    if (!connected) return;

    try {
      const message = new TextEncoder().encode('Hello, Solana!');
      const signature = await wallet.signMessage(message);
      console.log('Message signed:', signature);
    } catch (error) {
      console.error('Message signing failed:', error);
    }
  };

  return <button onClick={signMessage}>Sign Message</button>;
}
```

### Embedded Wallet Pages

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { EmbeddedWalletPage } from 'hyperlink-wallet-adapter';

function WalletControls() {
  const { wallet } = useWallet();

  const showWalletPage = (page?: EmbeddedWalletPage) => {
    if (wallet && 'showWallet' in wallet) {
      wallet.showWallet(page);
    }
  };

  const hideWallet = () => {
    if (wallet && 'hideWallet' in wallet) {
      wallet.hideWallet();
    }
  };

  return (
    <div>
      <button onClick={() => showWalletPage(EmbeddedWalletPage.OVERVIEW)}>
        Show Overview
      </button>
      <button onClick={() => showWalletPage(EmbeddedWalletPage.ADD_FUNDS)}>
        Add Funds
      </button>
      <button onClick={() => showWalletPage(EmbeddedWalletPage.SWAP)}>
        Swap
      </button>
      <button onClick={() => showWalletPage(EmbeddedWalletPage.WITHDRAW)}>
        Withdraw
      </button>
      <button onClick={hideWallet}>Hide Wallet</button>
    </div>
  );
}
```

## Browser Compatibility

The wallet adapter automatically detects the user's environment and adjusts its behavior accordingly:

- **Desktop Browsers**: Full functionality with direct wallet connection
- **Mobile Browsers**: Optimized mobile experience with iframe fallback when needed
- **Progressive Web Apps**: Automatic iframe mode for PWA environments
- **In-App Browsers**: Graceful handling with appropriate user guidance

## Security Features

- **Allowlist Protection**: Validates client ID and domain before allowing connections
- **Secure Communication**: All wallet communications are encrypted
- **Session Management**: Secure session handling using UUID-based identification
- **Origin Validation**: Validates referrer URLs to prevent unauthorized access

## Development

### Prerequisites

- Node.js >= 18
- npm >= 9.1.0

### Build Commands

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Build for release
npm run build:release

# Lint and format
npm run lint

# Clean build artifacts
npm run clean

# Create package for publishing
npm run pack
```

### Project Structure

```
wallet-adapter/
├── src/
│   ├── index.ts          # Main adapter class and exports
│   ├── embed.ts          # Embedded wallet functionality
│   ├── utils.ts          # Utility functions
│   ├── interfaces.ts     # TypeScript interfaces
│   ├── dialog.ts         # Dialog components
│   └── wallet-standard.ts # Wallet standard implementation
├── lib/
│   ├── esm/              # ES Module build
│   ├── cjs/              # CommonJS build
│   └── types/            # TypeScript declarations
└── package.json
```

## Getting Help

If you encounter any issues or have questions:

1. Check the [Configuration Guide](./CONFIGURATION.md) for setup help
2. Review the [Examples](./EXAMPLES.md) for common use cases
3. Open an issue on GitHub for bugs or feature requests

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome. Please ensure your code follows the existing style and includes appropriate tests.
