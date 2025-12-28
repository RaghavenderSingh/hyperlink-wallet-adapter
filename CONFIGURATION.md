# Configuration Guide

This guide covers all configuration options and settings available for the HyperLink Wallet Adapter library.

## Table of Contents

- [Basic Configuration](#basic-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Environment Configuration](#environment-configuration)
- [Security Configuration](#security-configuration)
- [UI Configuration](#ui-configuration)
- [Network Configuration](#network-configuration)
- [Mobile Configuration](#mobile-configuration)

## Basic Configuration

### Required Parameters

#### clientId

**Type:** `string`
**Required:** Yes
**Description:** Unique identifier for your dApp, obtained from the HyperLink team.

```typescript
const config = {
  clientId: "your-unique-client-id-here",
};
```

Contact the HyperLink team to obtain your client ID. This identifier is used for domain allowlist validation and security purposes.

#### title

**Type:** `string`
**Required:** Yes
**Description:** The name of your dApp that will be displayed in the wallet interface.

```typescript
const config = {
  title: "My Awesome dApp",
};
```

#### theme

**Type:** `'system' | 'light' | 'dark'`
**Required:** Yes
**Description:** The visual theme for the wallet interface.

```typescript
const config = {
  theme: "system", // Automatically follows system preference
};

// Or explicitly set:
const config = {
  theme: "light", // Always use light theme
};

const config = {
  theme: "dark", // Always use dark theme
};
```

Theme options:

- `system` - Automatically follows the user's system theme preference
- `light` - Forces light theme regardless of system preference
- `dark` - Forces dark theme regardless of system preference

## Advanced Configuration

### Platform Support

#### installedOnDesktop

**Type:** `boolean`
**Required:** No
**Default:** `true`
**Description:** Indicates whether the wallet is available on desktop platforms.

```typescript
const config = {
  installedOnDesktop: true,
};
```

#### installedOnIos

**Type:** `boolean`
**Required:** No
**Default:** `true`
**Description:** Indicates whether the wallet is available on iOS devices.

```typescript
const config = {
  installedOnIos: true,
};
```

#### installedOnAndroid

**Type:** `boolean`
**Required:** No
**Default:** `false`
**Description:** Indicates whether the wallet is available on Android devices.

```typescript
const config = {
  installedOnAndroid: false,
};
```

### UI Customization

#### hideDraggableWidget

**Type:** `boolean`
**Required:** No
**Default:** `false`
**Description:** When set to true, hides the draggable wallet widget.

```typescript
const config = {
  hideDraggableWidget: true,
};
```

#### hideWalletOnboard

**Type:** `boolean`
**Required:** No
**Default:** `false`
**Description:** When set to true, hides the wallet onboarding interface.

```typescript
const config = {
  hideWalletOnboard: true,
};
```

## Environment Configuration

### Build Environment

The library automatically detects and configures the build environment. Currently, only the production environment is supported:

```typescript
import { HYPERLINK_BUILD_ENV } from "hyperlink-wallet-adapter";

// The library automatically uses the production environment
const buildEnv = HYPERLINK_BUILD_ENV.PRODUCTION;
```

Available environments:

- `PRODUCTION` - Production environment (currently the only supported option)
- Other environments are planned for future releases

## Security Configuration

### Allowlist Protection

The library automatically validates your domain against an allowlist using your client ID. This ensures that only authorized domains can use your wallet integration.

Automatic validation process:

- Domain validation occurs during wallet initialization
- Uses your client ID and the current domain origin
- Automatically disconnects the wallet if validation fails

Security features included:

- Client ID validation
- Domain allowlist verification
- Secure session management
- UUID-based session identification

## Network Configuration

### Wallet Adapter Network

#### walletAdapterNetwork

**Type:** `WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet`
**Required:** No
**Default:** `WalletAdapterNetwork.Mainnet`
**Description:** The Solana network to use for wallet operations.

```typescript
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

const config = {
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet, // Use mainnet
};

// Or use devnet for testing:
const config = {
  walletAdapterNetwork: WalletAdapterNetwork.Devnet, // Use devnet
};
```

### RPC Configuration

When registering the wallet, you must provide an RPC URL:

```typescript
import { registerHyperLinkWallet } from "hyperlink-wallet-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

const unregister = registerHyperLinkWallet({
  clientId: "your-client-id",
  title: "Your dApp",
  theme: "system",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet,
});
```

Recommended RPC endpoints:

- Mainnet: `https://api.mainnet-beta.solana.com`
- Devnet: `https://api.devnet.solana.com`
- Testnet: `https://api.testnet.solana.com`

## Mobile Configuration

### Mobile Detection

The library automatically detects mobile devices and adjusts its behavior accordingly:

Automatic detection capabilities:

- iOS device detection
- Android device detection
- WebView detection
- Progressive Web App (PWA) mode detection

Mobile optimizations:

- Automatic iframe mode for specific mobile scenarios
- Touch-optimized interface
- Responsive design
- Full PWA compatibility

### Progressive Web App Support

For Progressive Web Apps, the library automatically enables iframe mode. No additional configuration is needed as the detection and activation happen automatically.

## Complete Configuration Example

Here's a complete configuration example with all options:

```typescript
import { registerHyperLinkWallet } from "hyperlink-wallet-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

const walletConfig = {
  // Required parameters
  clientId: "your-client-id-from-hyperlink",
  title: "My Solana dApp",
  theme: "system",

  // Platform support
  installedOnDesktop: true,
  installedOnIos: true,
  installedOnAndroid: false,

  // UI customization
  hideDraggableWidget: false,
  hideWalletOnboard: false,

  // Network configuration
  walletAdapterNetwork: WalletAdapterNetwork.Mainnet,

  // RPC configuration (required for registration)
  rpcUrl: "https://api.mainnet-beta.solana.com",
};

// Register the wallet adapter
const unregister = registerHyperLinkWallet(walletConfig);

// Unregister when your application unmounts or when no longer needed
unregister();
```

## Configuration Best Practices

### 1. Environment-Specific Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const config = {
  clientId: process.env.HYPERLINK_CLIENT_ID,
  title: "My dApp",
  theme: "system",
  walletAdapterNetwork: isProduction
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet,
  rpcUrl: isProduction
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com",
};
```

### 2. Dynamic Configuration

```typescript
const getWalletConfig = (userTheme: string) => ({
  clientId: "your-client-id",
  title: "My dApp",
  theme: userTheme as "system" | "light" | "dark",
  installedOnDesktop: true,
  installedOnIos: true,
  installedOnAndroid: false,
});
```

### 3. Configuration Validation

```typescript
const validateConfig = (config: any) => {
  if (!config.clientId) {
    throw new Error("clientId is required");
  }
  if (!config.title) {
    throw new Error("title is required");
  }
  if (!["system", "light", "dark"].includes(config.theme)) {
    throw new Error("Invalid theme value");
  }
  return config;
};

const config = validateConfig({
  clientId: "your-client-id",
  title: "My dApp",
  theme: "system",
});
```

## Troubleshooting Configuration Issues

### Common Issues

**Missing clientId**
- Error: "clientId is required"
- Solution: Contact the HyperLink team to obtain your client ID

**Invalid theme value**
- Error: "Invalid theme value"
- Solution: Use only 'system', 'light', or 'dark' as the theme value

**Network configuration mismatch**
- Error: Network-related errors
- Solution: Ensure your walletAdapterNetwork setting matches your RPC URL (mainnet RPC with Mainnet network, devnet RPC with Devnet network)

**Domain not allowlisted**
- Error: Wallet disconnects automatically after initialization
- Solution: Ensure your domain is properly registered in the HyperLink allowlist. Contact the HyperLink team to add your domain

### Configuration Validation

The library automatically validates your configuration and will throw descriptive errors for invalid configurations. It is recommended to wrap your wallet registration in try-catch blocks:

```typescript
try {
  const unregister = registerHyperLinkWallet(config);
} catch (error) {
  console.error("Wallet configuration error:", error.message);
  // Handle the configuration error appropriately
}
```
