import type {
  SendTransactionOptions,
  TransactionOrVersionedTransaction,
  WalletName,
} from "@solana/wallet-adapter-base";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  BaseSignInMessageSignerWalletAdapter,
  WalletConfigError,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletPublicKeyError,
  WalletReadyState,
  WalletSignInError,
  WalletSignMessageError,
  WalletSignTransactionError,
} from "@solana/wallet-adapter-base";
import type {
  Connection,
  Transaction,
  TransactionSignature,
  TransactionVersion,
  VersionedTransaction,
} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { HyperLinkEmbed } from "./embed";
import {
  HYPERLINK_BUILD_ENV,
  type HYPERLINK_BUILD_ENV_TYPE,
} from "./interfaces";
import type {
  SolanaSignInInput,
  SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import {
  checkAndAttachHyperLinkInstance,
  getHyperLinkUrl,
  iFrameUrl,
  removePreviousWindowRef,
  HyperLinkInstanceKey,
} from "./utils";
import { SOLANA_MAINNET_CHAIN } from "@solana/wallet-standard-chains";
import { registerWalletAdapter } from "./wallet-standard";
import { showDialog } from "./dialog";
import { v4 as uuid } from "uuid";
import { Buffer } from "buffer";

export type { HYPERLINK_BUILD_ENV_TYPE };

interface HyperLinkWindow extends Window {}

declare const window: HyperLinkWindow;

export enum EmbeddedWalletPage {
  OVERVIEW = "Overview",
  ADD_FUNDS = "AddFunds",
  SWAP = "Swap",
  WITHDRAW = "Withdraw",
}

export const GoogleViaHyperLinkWalletName =
  "Google via HyperlinkLink" as WalletName<"Google via HyperLink">;

export type HyperLinkWalletAdapterTheme = "system" | "light" | "dark";
export const NPM_VERSION = "2.1.21";
export type CustomSolanaSignInInput =
  | SolanaSignInInput
  | (() => Promise<SolanaSignInInput>);

type ConnectOutput = {
  siwsOutput?: SolanaSignInOutput;
};
type WalletAdapterConfig = {
  // Reach out to the HyperLink team for a clientId
  clientId: string;
  title: string;
  theme: HyperLinkWalletAdapterTheme;
  installedOnDesktop?: boolean;
  installedOnIos?: boolean;
  installedOnAndroid?: boolean;
  hideDraggableWidget?: boolean;
  hideWalletOnboard?: boolean;
  walletAdapterNetwork?:
    | WalletAdapterNetwork.Mainnet
    | WalletAdapterNetwork.Devnet;
};

// preload for iframe doesn't work https://bugs.chromium.org/p/chromium/issues/detail?id=593267
async function preLoadIframe(
  buildEnv: HYPERLINK_BUILD_ENV_TYPE,
  clientId: string,
  walletAdapterNetwork:
    | WalletAdapterNetwork.Mainnet
    | WalletAdapterNetwork.Devnet,
  theme?: HyperLinkWalletAdapterTheme
) {
  try {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const hyperLinkIframeHtml = document.createElement("link");
    const hyperLinkUrl = iFrameUrl({
      buildEnv,
      clientId,
      walletAdapterNetwork,
      theme: theme !== "system" ? theme : undefined,
    });
    hyperLinkIframeHtml.href = hyperLinkUrl;
    hyperLinkIframeHtml.crossOrigin = "anonymous";
    hyperLinkIframeHtml.type = "text/html";
    hyperLinkIframeHtml.rel = "prefetch";
    if (hyperLinkIframeHtml.relList && hyperLinkIframeHtml.relList.supports) {
      if (hyperLinkIframeHtml.relList.supports("prefetch")) {
        document.head.appendChild(hyperLinkIframeHtml);
      }
    }
  } catch (error) {
    console.warn(error);
  }
}

// This will register the HyperLink Wallet as a standard wallet (as part of the wallet standard).
// It can be called outside of a React component.
export const registerHyperLinkWallet = ({
  title,
  clientId,
  theme,
  rpcUrl,
  installedOnAndroid,
  installedOnDesktop,
  installedOnIos,
  walletAdapterNetwork,
}: WalletAdapterConfig & {
  rpcUrl: string;
}) => {
  if (typeof window === "undefined") {
    return () => {
      return;
    };
  }
  return registerWalletAdapter(
    new HyperLinkWalletAdapter({
      clientId,
      theme,
      title,
      // buildEnv: HYPERLINK_BUILD_ENV.PRODUCTION,
      installedOnAndroid,
      installedOnDesktop,
      installedOnIos,
      walletAdapterNetwork,
    }),
    SOLANA_MAINNET_CHAIN,
    rpcUrl
  );
};

function sanitizeUrlForAllowList(urlString: string): string {
  console.log(urlString);
  const url = new URL(urlString);
  const { protocol, hostname, port } = url;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

async function checkIfAllowListed(
  buildEnv: HYPERLINK_BUILD_ENV_TYPE,
  clientId: string,
  url: string,
  failCallback: () => void
) {
  const referrerUrl = sanitizeUrlForAllowList(url);
  const data = JSON.stringify({ clientId, referrerUrl });
  const b64Referrer = Buffer.from(data).toString("base64");
  const configUrl = `http://localhost:3000/api/wallet_adapter_ancestors/${b64Referrer}`;
  const response = await fetch(configUrl);
  const { ancestor } = (await response.json()) as {
    ancestor: string;
  };
  if (response.ok && response.status === 200 && ancestor) {
    return;
  }
  failCallback();
}

function isPWA() {
  return (
    // @ts-ignore
    globalThis.navigator?.standalone === true ||
    globalThis.matchMedia?.("(display-mode: standalone)").matches ||
    globalThis.matchMedia?.("(display-mode: fullscreen)").matches ||
    globalThis.matchMedia?.("(display-mode: minimal-ui)").matches
  );
}

let _userAgent: string | null | undefined;
function getUserAgent(): string | null {
  if (_userAgent === undefined) {
    _userAgent = globalThis.navigator?.userAgent ?? null;
  }
  return _userAgent;
}

function isWebView() {
  const userAgentString = getUserAgent();
  if (!userAgentString) {
    return false;
  }
  return /(WebView|Version\/.+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+)|; wv\).+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+))/i.test(
    userAgentString
  );
}

function isMobileAndroid(): boolean {
  const userAgentString = getUserAgent();
  if (userAgentString && /android/i.test(userAgentString) && !isWebView()) {
    return true;
  }
  return false;
}

function isMobileiOS(): boolean {
  const userAgentString = getUserAgent();
  if (
    userAgentString &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !isWebView()
  ) {
    return true;
  }
  return false;
}

const wvRules = ["WebView", "(iPhone|iPod|iPad)(?!.*Safari/)", "Android.*(wv)"];
const wvRegex = new RegExp(`(${wvRules.join("|")})`, "ig");

let _isInApp: boolean | undefined;
function isInApp(): boolean {
  if (_isInApp !== undefined) {
    return _isInApp;
  }

  const userAgentString = getUserAgent();
  if (!userAgentString) {
    return false;
  }
  _isInApp = Boolean(userAgentString.match(wvRegex));
  return _isInApp;
}

let _isPhantomBrowser: boolean | undefined;
function isPhantomBrowser(): boolean {
  if (_isPhantomBrowser !== undefined) {
    return _isPhantomBrowser;
  }

  const userAgentString = getUserAgent();
  if (!userAgentString) {
    return false;
  }

  _isPhantomBrowser = userAgentString.includes("Phantom") && isInApp();
  return _isPhantomBrowser;
}

function installedToWalletReadyState(installed: boolean): WalletReadyState {
  return installed ? WalletReadyState.Installed : WalletReadyState.Loadable;
}

export class HyperLinkWalletAdapter extends BaseSignInMessageSignerWalletAdapter {
  name = GoogleViaHyperLinkWalletName;
  url = "https://coinwala.io";

  icon =
    "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB3aWR0aD0iMTAwJSIgdmlld0JveD0iMCAwIDEwODAgMTA4MCIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMTA4MCAxMDgwIiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHBhdGggZmlsbD0iI0ZGRkVGRSIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIgCglkPSIKTTU5OS4wMDAwMDAsMTA4MS4wMDAwMDAgCglDMzk5LjM1NjMyMywxMDgxLjAwMDAwMCAyMDAuMjEyNjMxLDEwODEuMDAwMDAwIDEuMDM0NDc0LDEwODEuMDAwMDAwIAoJQzEuMDM0NDc0LDcyMS4wNjQ1MTQgMS4wMzQ0NzQsMzYxLjEyOTA1OSAxLjAzNDQ3NCwxLjA5Njc4NyAKCUMzNjAuODkzODkwLDEuMDk2Nzg3IDcyMC43ODc4NDIsMS4wOTY3ODcgMTA4MC44NDA4MjAsMS4wOTY3ODcgCglDMTA4MC44NDA4MjAsMzYwLjk5OTkzOSAxMDgwLjg0MDgyMCw3MjAuOTk5OTM5IDEwODAuODQwODIwLDEwODEuMDAwMDAwIAoJQzkyMC40NjE5MTQsMTA4MS4wMDAwMDAgNzU5Ljk4MDk1NywxMDgxLjAwMDAwMCA1OTkuMDAwMDAwLDEwODEuMDAwMDAwIApNNTg1LjUwMDAwMCwxMDQwLjAyOTc4NSAKCUM3MjQuODMyMzk3LDEwNDAuMDI5Nzg1IDg2NC4xNjQ4NTYsMTA0MC4wMzM4MTMgMTAwMy40OTcyNTMsMTA0MC4wMDIxOTcgCglDMTAwNi40NzYwMTMsMTA0MC4wMDE1ODcgMTAwOS41MzM0NDcsMTAzOS45NDkwOTcgMTAxMi40MjA5NTksMTAzOS4zMTQ1NzUgCglDMTAzNi44MTA5MTMsMTAzMy45NTQ3MTIgMTA1Mi45OTkyNjgsMTAxMy43NjQyODIgMTA1My4wMDQwMjgsOTg4LjcwNzAzMSAKCUMxMDUzLjAyNzIyMiw4NjcuMjA3NDU4IDEwNTMuMDE2MjM1LDc0NS43MDc5NDcgMTA1My4wMTYyMzUsNjI0LjIwODM3NCAKCUMxMDUzLjAxNjIzNSw0NDAuNzA5MDQ1IDEwNTIuOTk2MDk0LDI1Ny4yMDk3MTcgMTA1My4wNTI5NzksNzMuNzEwNDAzIAoJQzEwNTMuMDU3MjUxLDU5LjcyODQzOSAxMDQ4Ljc0NDg3Myw0Ny41ODE3NDkgMTAzOS4xODgyMzIsMzcuMzYwMjQ5IAoJQzEwMjguMDk1MjE1LDI1LjQ5NTUxNCAxMDE0LjE2MTY4MiwyMS4zNTI1NjYgOTk4LjIyMjQ3MywyMS4zNTc1OTAgCglDNjkwLjg5MDI1OSwyMS40NTQ0NzAgMzgzLjU1ODAxNCwyMS40MjkwMDggNzYuMjI1ODAwLDIxLjQzNDQyMCAKCUM3NC4yMjY4NjAsMjEuNDM0NDU2IDcyLjIyODA0MywyMS41MjExODkgNzAuMjI4OTUxLDIxLjU1NDUzNyAKCUM2MC4wOTM5MDMsMjEuNzIzNjAyIDUwLjgxOTE3NiwyNC43OTU4NzQgNDIuNzUwODU0LDMwLjc3NjA3OSAKCUMyNy45MDc1NjAsNDEuNzc3ODc0IDIxLjQ4MDQ1Nyw1Ni42NjAzNzAgMjEuNDg5NTMxLDc1LjIyMzQ1NyAKCUMyMS42Mzc4OTIsMzc4LjcyMjI2MCAyMS41OTQzNjIsNjgyLjIyMTE5MSAyMS42MDA0NjQsOTg1LjcyMDA5MyAKCUMyMS42MDA1MTIsOTg4LjA1MjU1MSAyMS42NDE4MzIsOTkwLjM4NzAyNCAyMS43NDI4MzIsOTkyLjcxNzE2MyAKCUMyMi44NzYyNjgsMTAxOC44NjYwODkgNDQuOTA4ODk3LDEwNDAuMDI4MDc2IDcxLjAwMTg2OSwxMDQwLjAyODQ0MiAKCUMyNDIuMTY3OTA4LDEwNDAuMDMwNzYyIDQxMy4zMzM5NTQsMTA0MC4wMjk3ODUgNTg1LjUwMDAwMCwxMDQwLjAyOTc4NSAKeiIvPgo8cGF0aCBmaWxsPSIjRTUyODE5IiBvcGFjaXR5PSIxLjAwMDAwMCIgc3Ryb2tlPSJub25lIiAKCWQ9IgpNNTg1LjAwMDAwMCwxMDQwLjAyOTc4NSAKCUM0MTMuMzMzOTU0LDEwNDAuMDI5Nzg1IDI0Mi4xNjc5MDgsMTA0MC4wMzA3NjIgNzEuMDAxODY5LDEwNDAuMDI4NDQyIAoJQzQ0LjkwODg5NywxMDQwLjAyODA3NiAyMi44NzYyNjgsMTAxOC44NjYwODkgMjEuNzQyODMyLDk5Mi43MTcxNjMgCglDMjEuNjQxODMyLDk5MC4zODcwMjQgMjEuNjAwNTEyLDk4OC4wNTI1NTEgMjEuNjAwNDY0LDk4NS43MjAwOTMgCglDMjEuNTk0MzYyLDY4Mi4yMjExOTEgMjEuNjM3ODkyLDM3OC43MjIyNjAgMjEuNDg5NTMxLDc1LjIyMzQ1NyAKCUMyMS40ODA0NTcsNTYuNjYwMzcwIDI3LjkwNzU2MCw0MS43Nzc4NzQgNDIuNzUwODU0LDMwLjc3NjA3OSAKCUM1MC44MTkxNzYsMjQuNzk1ODc0IDYwLjA5MzkwMywyMS43MjM2MDIgNzAuMjI4OTUxLDIxLjU1NDUzNyAKCUM3Mi4yMjgwNDMsMjEuNTIxMTg5IDc0LjIyNjg2MCwyMS40MzQ0NTYgNzYuMjI1ODAwLDIxLjQzNDQyMCAKCUMzODMuNTU4MDE0LDIxLjQyOTAwOCA2OTAuODkwMjU5LDIxLjQ1NDQ3MCA5OTguMjIyNDczLDIxLjM1NzU5MCAKCUMxMDE0LjE2MTY4MiwyMS4zNTI1NjYgMTAyOC4wOTUyMTUsMjUuNDk1NTE0IDEwMzkuMTg4MjMyLDM3LjM2MDI0OSAKCUMxMDQ4Ljc0NDg3Myw0Ny41ODE3NDkgMTA1My4wNTcyNTEsNTkuNzI4NDM5IDEwNTMuMDUyOTc5LDczLjcxMDQwMyAKCUMxMDUyLjk5NjA5NCwyNTcuMjA5NzE3IDEwNTMuMDE2MjM1LDQ0MC43MDkwNDUgMTA1My4wMTYyMzUsNjI0LjIwODM3NCAKCUMxMDUzLjAxNjIzNSw3NDUuNzA3OTQ3IDEwNTMuMDI3MjIyLDg2Ny4yMDc0NTggMTA1My4wMDQwMjgsOTg4LjcwNzAzMSAKCUMxMDUyLjk5OTI2OCwxMDEzLjc2NDI4MiAxMDM2LjgxMDkxMywxMDMzLjk1NDcxMiAxMDEyLjQyMDk1OSwxMDM5LjMxNDU3NSAKCUMxMDA5LjUzMzQ0NywxMDM5Ljk0OTA5NyAxMDA2LjQ3NjAxMywxMDQwLjAwMTU4NyAxMDAzLjQ5NzI1MywxMDQwLjAwMjE5NyAKCUM4NjQuMTY0ODU2LDEwNDAuMDMzODEzIDcyNC44MzIzOTcsMTA0MC4wMjk3ODUgNTg1LjAwMDAwMCwxMDQwLjAyOTc4NSAKTTc5My4yMzMyMTUsMTkyLjAxNTQ3MiAKCUM3ODQuNDI4NDY3LDE5OS4xMjYxNjAgNzc1LjYxNDg2OCwyMDYuMjI1OTY3IDc2Ni44MjAzNzQsMjEzLjM0OTMwNCAKCUM3MTQuOTM5NjM2LDI1NS4zNzEyNzcgNjYzLjA1MjczNCwyOTcuMzg1NzEyIDYxMS4xODgyMzIsMzM5LjQyNzc5NSAKCUM1NTMuMTE0ODA3LDM4Ni41MDI5MzAgNDk1LjA2MTI3OSw0MzMuNjAyNjAwIDQzNy4wMDQzNjQsNDgwLjY5ODEyMCAKCUM0MzAuNzM4NDAzLDQ4NS43ODEwMzYgNDI0LjUwNzY2MCw0OTAuOTA3Mzc5IDQxNy4xNDY0NTQsNDk2LjkyNDI1NSAKCUM0NDguNzk0NjE3LDQ5Ny42NjM4MTggNDc4Ljk0OTE1OCw0OTguMzY4NTAwIDUxMC4xNDE1MTAsNDk5LjA5NzQxMiAKCUM0NjIuNjc2NzU4LDU0OC41MjI4ODggNDE1Ljg4NDAzMyw1OTcuMjQ4NjU3IDM2OC4zNTY5MzQsNjQ2LjczOTA3NSAKCUMzOTYuODExNTg0LDY0OC4wMjUxNDYgNDIzLjc5NzgyMSw2NDkuMjQ0OTM0IDQ1MS45MDM3NzgsNjUwLjUxNTI1OSAKCUMzOTQuMzk1MjMzLDcyNC4wMDAzNjYgMzM3LjYwMDczOSw3OTYuNTczMDU5IDI4MC44MDYyMTMsODY5LjE0NTgxMyAKCUMyODEuMTU4ODEzLDg2OS40NjAxNDQgMjgxLjUxMTQxNCw4NjkuNzc0NDc1IDI4MS44NjQwMTQsODcwLjA4ODgwNiAKCUM0MDcuNTI1ODQ4LDc2OC42ODkxNDggNTMzLjE4NzY4Myw2NjcuMjg5NTUxIDY1OS45MDEzMDYsNTY1LjA0MTEzOCAKCUM2MjcuNTg5OTY2LDU2My4wNTE1MTQgNTk2LjkwNzk1OSw1NjEuMTYyMTcwIDU2NC44MTE0MDEsNTU5LjE4NTczMCAKCUM2MTUuODUwNDY0LDUwOS40MjE0MTcgNjY1LjU3MzM2NCw0NjAuOTQwNDMwIDcxNi4yODQ0ODUsNDExLjQ5NTkxMSAKCUM2ODYuOTc0MzA0LDQwOS41MTY5OTggNjU5LjM4MjYyOSw0MDcuNjU0MTE0IDYzMS4xNDQ3NzUsNDA1Ljc0NzYyMCAKCUM2MzIuNDc0MjQzLDQwMy44MzUxNzUgNjMzLjM0NTUyMCw0MDIuNDY3MDEwIDYzNC4zMjg3MzUsNDAxLjE4NDcyMyAKCUM2NDguMjA5MTY3LDM4My4wODI1MjAgNjYyLjEwMjA1MSwzNjQuOTg5ODk5IDY3NS45OTc0MzcsMzQ2Ljg5OTIwMCAKCUM3MDcuNTQxMTk5LDMwNS44MzE4NzkgNzM5LjExODE2NCwyNjQuNzg5OTc4IDc3MC42MTI3OTMsMjIzLjY4NDk5OCAKCUM3NzguNTkwODIwLDIxMy4yNzI1NTIgNzg2LjMxMDQ4NiwyMDIuNjYyMTA5IDc5NC41ODUwMjIsMTkxLjk3OTg3NCAKCUM3OTQuNTQ2NjMxLDE5MS43MjkzMDkgNzk0LjUwODI0MCwxOTEuNDc4NzI5IDc5NC40Njk4NDksMTkxLjIyODE0OSAKCUM3OTQuMjgzMjAzLDE5MS40NTI2OTggNzk0LjA5NjYxOSwxOTEuNjc3MjQ2IDc5My4yMzMyMTUsMTkyLjAxNTQ3MiAKTTgyNS41MDAwMDAsOTczLjAwMDEyMiAKCUM4NjYuNjU5OTEyLDk3My4wMDAxMjIgOTA3LjgxOTgyNCw5NzMuMDI4MjU5IDk0OC45Nzk3MzYsOTcyLjk4NDgwMiAKCUM5NjMuMzI0NDAyLDk3Mi45Njk2NjYgOTcyLjk1NDg5NSw5NjQuMDYwMzY0IDk3Mi45NjczNDYsOTUwLjU0ODM0MCAKCUM5NzMuMDMzMjAzLDg3OS4wNjAzNjQgOTczLjAzMDY0MCw4MDcuNTcyMjA1IDk3Mi45NjgxNDAsNzM2LjA4NDE2NyAKCUM5NzIuOTU2NTQzLDcyMi44NTYwNzkgOTYzLjc3Nzc3MSw3MTMuODQ3NDczIDk1MC42MDQxMjYsNzEzLjg0NDg0OSAKCUM4NTUuNDUzMzY5LDcxMy44MjU2MjMgNzYwLjMwMjYxMiw3MTMuODI0MjgwIDY2NS4xNTE4NTUsNzEzLjg0Njg2MyAKCUM2NTEuOTY3ODk2LDcxMy44NDk5NzYgNjQzLjAwODg1MCw3MjIuOTI4MTAxIDY0My4wMDU3OTgsNzM2LjIxMDc1NCAKCUM2NDIuOTg5NjI0LDgwNy41MzIxNjYgNjQyLjk5NDA4MCw4NzguODUzNTc3IDY0My4wMTkyMjYsOTUwLjE3NDk4OCAKCUM2NDMuMDE5OTU4LDk1Mi4xNTcxMDQgNjQzLjA4OTE3Miw5NTQuMTk3MjY2IDY0My41NDM1NzksOTU2LjExMTM4OSAKCUM2NDYuMDU1Mjk4LDk2Ni42OTIxMzkgNjU0Ljc5MzA5MSw5NzIuOTgzMDMyIDY2Ny4wMjYzMDYsOTcyLjk4OTAxNCAKCUM3MTkuNTE3NTE3LDk3My4wMTQ4OTMgNzcyLjAwODc4OSw5NzMuMDAwMTIyIDgyNS41MDAwMDAsOTczLjAwMDEyMiAKeiIvPgo8cGF0aCBmaWxsPSIjRkZGRkZGIiBvcGFjaXR5PSIxLjAwMDAwMCIgc3Ryb2tlPSJub25lIiAKCWQ9IgpNODI1LjAwMDAwMCw5NzMuMDAwMTIyIAoJQzc3Mi4wMDg3ODksOTczLjAwMDEyMiA3MTkuNTE3NTE3LDk3My4wMTQ4OTMgNjY3LjAyNjMwNiw5NzIuOTg5MDE0IAoJQzY1NC43OTMwOTEsOTcyLjk4MzAzMiA2NDYuMDU1Mjk4LDk2Ni42OTIxMzkgNjQzLjU0MzU3OSw5NTYuMTExMzg5IAoJQzY0My4wODkxNzIsOTU0LjE5NzI2NiA2NDMuMDE5OTU4LDk1Mi4xNTcxMDQgNjQzLjAxOTIyNiw5NTAuMTc0OTg4IAoJQzY0Mi45OTQwODAsODc4Ljg1MzU3NyA2NDIuOTg5NjI0LDgwNy41MzIxNjYgNjQzLjAwNTc5OCw3MzYuMjEwNzU0IAoJQzY0My4wMDg4NTAsNzIyLjkyODEwMSA2NTEuOTY3ODk2LDcxMy44NDk5NzYgNjY1LjE1MTg1NSw3MTMuODQ2ODYzIAoJQzc2MC4zMDI2MTIsNzEzLjgyNDI4MCA4NTUuNDUzMzY5LDcxMy44MjU2MjMgOTUwLjYwNDEyNiw3MTMuODQ0ODQ5IAoJQzk2My43Nzc3NzEsNzEzLjg0NzQ3MyA5NzIuOTU2NTQzLDcyMi44NTYwNzkgOTcyLjk2ODE0MCw3MzYuMDg0MTY3IAoJQzk3My4wMzA2NDAsODA3LjU3MjIwNSA5NzMuMDMzMjAzLDg3OS4wNjAzNjQgOTcyLjk2NzM0Niw5NTAuNTQ4MzQwIAoJQzk3Mi45NTQ4OTUsOTY0LjA2MDM2NCA5NjMuMzI0NDAyLDk3Mi45Njk2NjYgOTQ4Ljk3OTczNiw5NzIuOTg0ODAyIAoJQzkwNy44MTk4MjQsOTczLjAyODI1OSA4NjYuNjU5OTEyLDk3My4wMDAxMjIgODI1LjAwMDAwMCw5NzMuMDAwMTIyIApNNzcwLjI3MTA1Nyw4NTUuMTUxNDg5IAoJQzc2Ny45ODAxMDMsODQ2LjgyODAwMyA3NjguMzIyNjkzLDgzOC41MTQ1ODcgNzcwLjgzMDMyMiw4MjkuNzAxMzU1IAoJQzc3NS41MjU0NTIsODE4LjAxODE4OCA3ODMuMzA2NzAyLDgwOS4zNzAzMDAgNzk1LjM2Mzg5Miw4MDUuMDUxODgwIAoJQzgwOS42MDE0NDAsNzk5Ljk1MjQ1NCA4MjIuNDA1MzM0LDgwMy4xMjY2NDggODMzLjAzNDc5MCw4MTEuNjcwMjg4IAoJQzgzOS41Mzk1NTEsODA1LjUzNDQyNCA4NDUuNjQ1NzUyLDc5OS43NzQ0NzUgODUyLjAwNjcxNCw3OTMuNzc0MzUzIAoJQzgzNC4wMTY5MDcsNzc4LjQyMDQ3MSA4MTMuNzM2MDg0LDc3My4zNDY0MzYgNzkxLjA2NDYzNiw3NzkuNDQ5MjgwIAoJQzc3Mi4xMTU4NDUsNzg0LjU1MDA0OSA3NTcuOTc0NjcwLDc5NS45MTEzMTYgNzQ4Ljk5NjUyMSw4MTQuMzE2Mjg0IAoJQzczOS45NDg1NDcsODMzLjc0NjY0MyA3MzkuNTUzODMzLDg1My4wOTk3MzEgNzQ5LjYzOTg5Myw4NzMuMDczOTc1IAoJQzc1NS41NjgxMTUsODg1LjMxNTAwMiA3NjQuODk1NjkxLDg5NC4yMzU1OTYgNzc2LjU0MjcyNSw5MDEuMDE3MDkwIAoJQzc5OS4zNjg1MzAsOTE0LjMwNzQzNCA4MzMuMzEwNjA4LDkxMC44NjgzNDcgODUyLjA4Njk3NSw4OTMuMDEwMzE1IAoJQzg2OC45MDY4NjAsODc2LjY5MjM4MyA4NzMuMzk4NDk5LDg1Ni40NDI4NzEgODcwLjk3NDc5Miw4MzMuOTU5NzE3IAoJQzg3MC42MDcxMTcsODMwLjU0ODk1MCA4NjguMjY1OTMwLDgzMC44MjM0MjUgODY1Ljg3NDI2OCw4MzAuODI2NTM4IAoJQzg0OC4wNDEzODIsODMwLjg0OTQyNiA4MzAuMjA4NTU3LDgzMC44Mjk2NTEgODEyLjM3NTY3MSw4MzAuODU3NjA1IAoJQzgxMS4xMjAzNjEsODMwLjg1OTU1OCA4MDkuODY1NDE3LDgzMS4xMzcxNDYgODA4LjYxNTA1MSw4MzEuMjg2MDExIAoJQzgwOC42MTUwNTEsODM5LjczOTMxOSA4MDguNjE1MDUxLDg0Ny43OTk0MzggODA4LjYxNTA1MSw4NTYuNjc1NTM3IAoJQzgyMC42MzY0MTQsODU2LjY3NTUzNyA4MzIuMjg5NjEyLDg1Ni42NzU1MzcgODQ0LjA3ODI0Nyw4NTYuNjc1NTM3IAoJQzg0Mi43ODA4ODQsODY1LjgwNDU2NSA4MzcuNTgxOTA5LDg3MS41NjM2NjAgODMxLjA1MDI5Myw4NzYuOTk4MDQ3IAoJQzgxOC44NjUwNTEsODg0LjIyNTY0NyA4MDYuMTY3NTQyLDg4NS42Mzc5MzkgNzkyLjk2Njc5Nyw4ODAuMTM2NjU4IAoJQzc4MS44NjExNDUsODc1LjUwODQ4NCA3NzUuMTI5MDI4LDg2Ni43MDExNzIgNzcwLjI3MTA1Nyw4NTUuMTUxNDg5IAp6Ii8+CjxwYXRoIGZpbGw9IiNGQUQ1MTIiIG9wYWNpdHk9IjEuMDAwMDAwIiBzdHJva2U9Im5vbmUiIAoJZD0iCk03OTQuMTQ4ODY1LDE5Mi4xNDI2NTQgCglDNzg2LjMxMDQ4NiwyMDIuNjYyMTA5IDc3OC41OTA4MjAsMjEzLjI3MjU1MiA3NzAuNjEyNzkzLDIyMy42ODQ5OTggCglDNzM5LjExODE2NCwyNjQuNzg5OTc4IDcwNy41NDExOTksMzA1LjgzMTg3OSA2NzUuOTk3NDM3LDM0Ni44OTkyMDAgCglDNjYyLjEwMjA1MSwzNjQuOTg5ODk5IDY0OC4yMDkxNjcsMzgzLjA4MjUyMCA2MzQuMzI4NzM1LDQwMS4xODQ3MjMgCglDNjMzLjM0NTUyMCw0MDIuNDY3MDEwIDYzMi40NzQyNDMsNDAzLjgzNTE3NSA2MzEuMTQ0Nzc1LDQwNS43NDc2MjAgCglDNjU5LjM4MjYyOSw0MDcuNjU0MTE0IDY4Ni45NzQzMDQsNDA5LjUxNjk5OCA3MTYuMjg0NDg1LDQxMS40OTU5MTEgCglDNjY1LjU3MzM2NCw0NjAuOTQwNDMwIDYxNS44NTA0NjQsNTA5LjQyMTQxNyA1NjQuODExNDAxLDU1OS4xODU3MzAgCglDNTk2LjkwNzk1OSw1NjEuMTYyMTcwIDYyNy41ODk5NjYsNTYzLjA1MTUxNCA2NTkuOTAxMzA2LDU2NS4wNDExMzggCglDNTMzLjE4NzY4Myw2NjcuMjg5NTUxIDQwNy41MjU4NDgsNzY4LjY4OTE0OCAyODEuODY0MDE0LDg3MC4wODg4MDYgCglDMjgxLjUxMTQxNCw4NjkuNzc0NDc1IDI4MS4xNTg4MTMsODY5LjQ2MDE0NCAyODAuODA2MjEzLDg2OS4xNDU4MTMgCglDMzM3LjYwMDczOSw3OTYuNTczMDU5IDM5NC4zOTUyMzMsNzI0LjAwMDM2NiA0NTEuOTAzNzc4LDY1MC41MTUyNTkgCglDNDIzLjc5NzgyMSw2NDkuMjQ0OTM0IDM5Ni44MTE1ODQsNjQ4LjAyNTE0NiAzNjguMzU2OTM0LDY0Ni43MzkwNzUgCglDNDE1Ljg4NDAzMyw1OTcuMjQ4NjU3IDQ2Mi42NzY3NTgsNTQ4LjUyMjg4OCA1MTAuMTQxNTEwLDQ5OS4wOTc0MTIgCglDNDc4Ljk0OTE1OCw0OTguMzY4NTAwIDQ0OC43OTQ2MTcsNDk3LjY2MzgxOCA0MTcuMTQ2NDU0LDQ5Ni45MjQyNTUgCglDNDI0LjUwNzY2MCw0OTAuOTA3Mzc5IDQzMC43Mzg0MDMsNDg1Ljc4MTAzNiA0MzcuMDA0MzY0LDQ4MC42OTgxMjAgCglDNDk1LjA2MTI3OSw0MzMuNjAyNjAwIDU1My4xMTQ4MDcsMzg2LjUwMjkzMCA2MTEuMTg4MjMyLDMzOS40Mjc3OTUgCglDNjYzLjA1MjczNCwyOTcuMzg1NzEyIDcxNC45Mzk2MzYsMjU1LjM3MTI3NyA3NjYuODIwMzc0LDIxMy4zNDkzMDQgCglDNzc1LjYxNDg2OCwyMDYuMjI1OTY3IDc4NC40Mjg0NjcsMTk5LjEyNjE2MCA3OTMuNjMwNDkzLDE5Mi4wMTk2MjMgCglDNzk0LjAyNzgzMiwxOTIuMDIzNzU4IDc5NC4xNDg4NjUsMTkyLjE0MjY1NCA3OTQuMTQ4ODY1LDE5Mi4xNDI2NTQgCnoiLz4KPHBhdGggZmlsbD0iI0ZBRDUxMiIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIgCglkPSIKTTc5My45Njg4NzIsMTkxLjk2Mjc2OSAKCUM3OTQuMDk2NjE5LDE5MS42NzcyNDYgNzk0LjI4MzIwMywxOTEuNDUyNjk4IDc5NC40Njk4NDksMTkxLjIyODE0OSAKCUM3OTQuNTA4MjQwLDE5MS40Nzg3MjkgNzk0LjU0NjYzMSwxOTEuNzI5MzA5IDc5NC4zNjY5NDMsMTkyLjA2MTI2NCAKCUM3OTQuMTQ4ODY1LDE5Mi4xNDI2NTQgNzk0LjAyNzgzMiwxOTIuMDIzNzU4IDc5My45Njg4NzIsMTkxLjk2Mjc2OSAKeiIvPgo8cGF0aCBmaWxsPSIjRTk0NTM1IiBvcGFjaXR5PSIxLjAwMDAwMCIgc3Ryb2tlPSJub25lIiAKCWQ9IgpNNzQ5LjQzODE3MSw4MTMuODM2MzY1IAoJQzc1Ny45NzQ2NzAsNzk1LjkxMTMxNiA3NzIuMTE1ODQ1LDc4NC41NTAwNDkgNzkxLjA2NDYzNiw3NzkuNDQ5MjgwIAoJQzgxMy43MzYwODQsNzczLjM0NjQzNiA4MzQuMDE2OTA3LDc3OC40MjA0NzEgODUyLjAwNjcxNCw3OTMuNzc0MzUzIAoJQzg0NS42NDU3NTIsNzk5Ljc3NDQ3NSA4MzkuNTM5NTUxLDgwNS41MzQ0MjQgODMzLjAzNDc5MCw4MTEuNjcwMjg4IAoJQzgyMi40MDUzMzQsODAzLjEyNjY0OCA4MDkuNjAxNDQwLDc5OS45NTI0NTQgNzk1LjM2Mzg5Miw4MDUuMDUxODgwIAoJQzc4My4zMDY3MDIsODA5LjM3MDMwMCA3NzUuNTI1NDUyLDgxOC4wMTgxODggNzcwLjM4ODk3Nyw4MjkuNjU2NDk0IAoJQzc2My4xMTExNDUsODI0LjM1MzI3MSA3NTYuMjc0NjU4LDgxOS4wOTQ3ODggNzQ5LjQzODE3MSw4MTMuODM2MzY1IAp6Ii8+CjxwYXRoIGZpbGw9IiMzN0E4NTUiIG9wYWNpdHk9IjEuMDAwMDAwIiBzdHJva2U9Im5vbmUiIAoJZD0iCk04NTEuNTI1NjM1LDg5My4yOTQwNjcgCglDODMzLjMxMDYwOCw5MTAuODY4MzQ3IDc5OS4zNjg1MzAsOTE0LjMwNzQzNCA3NzYuNTQyNzI1LDkwMS4wMTcwOTAgCglDNzY0Ljg5NTY5MSw4OTQuMjM1NTk2IDc1NS41NjgxMTUsODg1LjMxNTAwMiA3NDkuOTEzNDUyLDg3Mi41Mjc3MTAgCglDNzU2Ljk0MDczNSw4NjYuNjYyNDE1IDc2My42OTQzOTcsODYxLjM0MzM4NCA3NzAuNDQ4MDU5LDg1Ni4wMjQzNTMgCglDNzc1LjEyOTAyOCw4NjYuNzAxMTcyIDc4MS44NjExNDUsODc1LjUwODQ4NCA3OTIuOTY2Nzk3LDg4MC4xMzY2NTggCglDODA2LjE2NzU0Miw4ODUuNjM3OTM5IDgxOC44NjUwNTEsODg0LjIyNTY0NyA4MzEuNjA0MjQ4LDg3Ny4yNTI2MjUgCglDODM4LjYxMzk1Myw4ODIuNzY5NTMxIDg0NS4wNjk3NjMsODg4LjAzMTc5OSA4NTEuNTI1NjM1LDg5My4yOTQwNjcgCnoiLz4KPHBhdGggZmlsbD0iIzQ0ODdGMyIgb3BhY2l0eT0iMS4wMDAwMDAiIHN0cm9rZT0ibm9uZSIgCglkPSIKTTg1MS44MDYyNzQsODkzLjE1MjIyMiAKCUM4NDUuMDY5NzYzLDg4OC4wMzE3OTkgODM4LjYxMzk1Myw4ODIuNzY5NTMxIDgzMS45NTgzNzQsODc3LjIxOTcyNyAKCUM4MzcuNTgxOTA5LDg3MS41NjM2NjAgODQyLjc4MDg4NCw4NjUuODA0NTY1IDg0NC4wNzgyNDcsODU2LjY3NTUzNyAKCUM4MzIuMjg5NjEyLDg1Ni42NzU1MzcgODIwLjYzNjQxNCw4NTYuNjc1NTM3IDgwOC42MTUwNTEsODU2LjY3NTUzNyAKCUM4MDguNjE1MDUxLDg0Ny43OTk0MzggODA4LjYxNTA1MSw4MzkuNzM5MzE5IDgwOC42MTUwNTEsODMxLjI4NjAxMSAKCUM4MDkuODY1NDE3LDgzMS4xMzcxNDYgODExLjEyMDM2MSw4MzAuODU5NTU4IDgxMi4zNzU2NzEsODMwLjg1NzYwNSAKCUM4MzAuMjA4NTU3LDgzMC44Mjk2NTEgODQ4LjA0MTM4Miw4MzAuODQ5NDI2IDg2NS44NzQyNjgsODMwLjgyNjUzOCAKCUM4NjguMjY1OTMwLDgzMC44MjM0MjUgODcwLjYwNzExNyw4MzAuNTQ4OTUwIDg3MC45NzQ3OTIsODMzLjk1OTcxNyAKCUM4NzMuMzk4NDk5LDg1Ni40NDI4NzEgODY4LjkwNjg2MCw4NzYuNjkyMzgzIDg1MS44MDYyNzQsODkzLjE1MjIyMiAKeiIvPgo8cGF0aCBmaWxsPSIjRjhCQzBDIiBvcGFjaXR5PSIxLjAwMDAwMCIgc3Ryb2tlPSJub25lIiAKCWQ9IgpNNzcwLjM1OTU1OCw4NTUuNTg3ODkxIAoJQzc2My42OTQzOTcsODYxLjM0MzM4NCA3NTYuOTQwNzM1LDg2Ni42NjI0MTUgNzQ5Ljg1MDgzMCw4NzIuMTcwODk4IAoJQzczOS41NTM4MzMsODUzLjA5OTczMSA3MzkuOTQ4NTQ3LDgzMy43NDY2NDMgNzQ5LjIxNzM0Niw4MTQuMDc2Mjk0IAoJQzc1Ni4yNzQ2NTgsODE5LjA5NDc4OCA3NjMuMTExMTQ1LDgyNC4zNTMyNzEgNzcwLjE1NzIyNyw4MjkuOTA5NjY4IAoJQzc2OC4zMjI2OTMsODM4LjUxNDU4NyA3NjcuOTgwMTAzLDg0Ni44MjgwMDMgNzcwLjM1OTU1OCw4NTUuNTg3ODkxIAp6Ii8+Cjwvc3ZnPg==";

  readonly supportedTransactionVersions = new Set([
    "legacy" as TransactionVersion,
    0 as TransactionVersion,
  ]);

  private _connecting: boolean;
  private _disconnected: boolean;
  private _wallet: HyperLinkEmbed | null;
  private _publicKey: PublicKey | null;
  private _iden: number;
  private _buildEnv: HYPERLINK_BUILD_ENV_TYPE;
  private _directConnect = true;
  private _title: string;
  private _theme: HyperLinkWalletAdapterTheme;
  private _clientId: string;
  private _isDisallowed = false;
  private _installedOnDesktop: boolean;
  private _installedOnAndroid: boolean;
  private _installedOnIos: boolean;
  private readonly _forceIframe: boolean;
  private readonly dAppSessionId: string;
  private _hideDraggableWidget: boolean;
  private _hideWalletOnboard: boolean;
  private _walletAdapterNetwork:
    | WalletAdapterNetwork.Mainnet
    | WalletAdapterNetwork.Devnet;
  private _showWallet: ((page?: EmbeddedWalletPage) => void) | undefined;
  private _hideWallet: (() => void) | undefined;

  constructor({
    theme,
    title,
    clientId,
    installedOnDesktop = true,
    installedOnIos = true,
    installedOnAndroid = false,
    hideDraggableWidget = false,
    hideWalletOnboard = false,
    walletAdapterNetwork = WalletAdapterNetwork.Mainnet,
  }: WalletAdapterConfig) {
    super();
    this._buildEnv = HYPERLINK_BUILD_ENV.PRODUCTION; // TODO: only allow HYPERLINK_BUILD_ENV.PRODUCTION;
    if (typeof window !== "undefined") {
      void checkIfAllowListed(
        this._buildEnv,
        clientId,
        window.location.origin,
        () => {
          this._isDisallowed = true;
          this._wallet?.notifyDisallowed();
          this.disconnect();
        }
      );
    }
    this._forceIframe =
      (typeof document !== "undefined" &&
        document.referrer === "https://t.co/" &&
        typeof navigator !== "undefined" &&
        isMobileiOS()) ||
      isPWA();

    this.dAppSessionId = uuid();
    preLoadIframe(this._buildEnv, clientId, walletAdapterNetwork, theme);
    this._title = title;
    this._connecting = false;
    this._disconnected = false;
    this._wallet = null;
    this._publicKey = null;
    this._iden = Date.now();
    this._theme = theme;
    this._clientId = clientId;
    this._installedOnDesktop = installedOnDesktop;
    this._installedOnAndroid = installedOnAndroid;
    this._installedOnIos = installedOnIos;
    this._hideDraggableWidget = hideDraggableWidget;
    this._hideWalletOnboard = hideWalletOnboard;
    this._walletAdapterNetwork = walletAdapterNetwork;
    checkAndAttachHyperLinkInstance(this);
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get connected() {
    return !!this._wallet?.isLoggedIn;
  }

  get readyState() {
    const isAndroid = isMobileAndroid();
    const isiOS = isMobileiOS();
    const isPhantom = isPhantomBrowser();
    const isInstalled = isPhantom
      ? false
      : isAndroid
        ? this._installedOnAndroid
        : isiOS
          ? this._installedOnIos
          : this._installedOnDesktop;
    return typeof window === "undefined" || typeof document === "undefined"
      ? WalletReadyState.Unsupported
      : installedToWalletReadyState(isInstalled);
  }

  private _accountChanged = (newPublicKeyString: string) => {
    const publicKey = this._publicKey;
    if (!publicKey) return;

    if (publicKey.toBase58() === newPublicKeyString) return;

    let newPublicKey;
    try {
      newPublicKey = new PublicKey(newPublicKeyString);
    } catch (error: any) {
      this.emit("error", new WalletPublicKeyError(error?.message, error));
      return;
    }

    this._publicKey = newPublicKey;
    this.emit("connect", newPublicKey);
  };

  private removeQueryParam(key: string): void {
    const url = new URL(window.location.href);
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      window.history.replaceState({}, "", url.toString());
    }
  }

  private async _connect({
    forceNoDirectConnect,
    siwsInput,
    autoConnect = false,
  }: {
    forceNoDirectConnect?: boolean;
    siwsInput?: CustomSolanaSignInInput;
    autoConnect?: boolean;
  }): Promise<ConnectOutput | undefined> {
    console.log(
      "BEGIN: connecting status for iden",
      this.connecting,
      this._iden
    );
    if (isInApp()) {
      console.log("is in app, returning");
      this.disconnect();
      showDialog(
        this._buildEnv,
        "<p>The HyperLink Wallet is not supported in this browser. Please open this page in your default browser instead.</p>"
      );
      return Promise.reject(
        "The HyperLink Wallet is not supported in this browser."
      );
    }

    if (this.connected || this.connecting) return;

    const previouslyConnectedPublicKey = localStorage.getItem(
      "hyperLink_pk_connected"
    );
    if (previouslyConnectedPublicKey || this._forceIframe) {
      forceNoDirectConnect = true;
      autoConnect = true;
    }

    let solanaSignInOutput: SolanaSignInOutput | undefined;
    this._disconnected = false;
    try {
      if (
        this.readyState !== WalletReadyState.Installed &&
        this.readyState !== WalletReadyState.Loadable
      ) {
        throw new WalletNotReadyError();
      }

      // console.log("adapter.connect, importing Torus");
      // console.log("setting connecting to be true");
      this._connecting = true;

      // let TorusClass: typeof Torus;
      // try {
      //   // console.log("importing torus");
      //   TorusClass = (await import("./embed.js")).Torus;
      // } catch (error: any) {
      //   throw new WalletLoadError(error?.message, error);
      // }

      let wallet: HyperLinkEmbed;
      console.log("checking object on window during connect", window);
      try {
        wallet = new HyperLinkEmbed(
          this._title,
          this._buildEnv,
          this._clientId,
          this._forceIframe,
          this.dAppSessionId,
          this._walletAdapterNetwork,
          () => {
            return this._isDisallowed;
          }
        );
      } catch (error: any) {
        throw new WalletConfigError(error?.message, error);
      }
      // console.log("adapter.connect, initializing wallet");
      // add wallet ref here to unmount even if user cancels flow
      this._wallet = wallet;
      let publicKey: PublicKey;
      try {
        const { pk, siwsOutput } = await wallet.init({
          directConnect: forceNoDirectConnect ? false : this._directConnect,
          autoConnect,
          siwsInput,
          forceClickToContinue: this._forceIframe,
          theme: this._theme,
          hideDraggableWidget: this._hideDraggableWidget,
          hideWalletOnboard: this._hideWalletOnboard,
          onWalletHandshake: (methods: {
            showWallet: (page?: EmbeddedWalletPage) => void;
            hideWallet: () => void;
          }) => {
            this._showWallet = methods.showWallet;
            this._hideWallet = methods.hideWallet;
          },
        });
        publicKey = new PublicKey(pk);
        solanaSignInOutput = siwsOutput;
        // console.log(
        //   "DONE WALLET INIT!! connecting status right now is",
        //   this._connecting,
        //   "disconnected",
        //   this._disconnected,
        //   "public key",
        //   pk,
        //   "siws output",
        //   siwsOutput
        // );
      } catch (error: any) {
        await this.disconnect();
        throw new WalletConnectionError(error?.message, error);
      }

      if (this._disconnected) {
        return;
      }

      if (
        previouslyConnectedPublicKey &&
        previouslyConnectedPublicKey !== publicKey.toBase58()
      ) {
        this.disconnect();
        return;
      }

      this.removeQueryParam("hyperLinkAutoConnect");
      this.removeQueryParam("hyperLinkAutoConnectPublicKey");
      this.removeQueryParam("promptHyperLinkAutoConnect");

      wallet.on("accountChanged", this._accountChanged);

      this._publicKey = publicKey;

      localStorage.setItem("hyperLink_pk_connected", publicKey.toBase58());
      this.emit("connect", publicKey);
      console.log("FINISHED connecting");
      console.log("adapter.connect, connected");
    } catch (error: any) {
      console.error("ERROR: error was", error);
      this.emit("error", error);
      throw error;
    } finally {
      console.log("END: setting connecting to be false", this._iden);
      this._connecting = false;
    }
    return {
      siwsOutput: solanaSignInOutput,
    };
  }

  async autoConnect(): Promise<void> {
    await this._connect({
      forceNoDirectConnect: true,
      autoConnect: true,
    });
    return;
  }

  async connect(): Promise<void> {
    await this._connect({});
    return;
  }

  async disconnect(): Promise<void> {
    const wallet = this._wallet;
    this._connecting = false;
    // console.log("triggered disconnected!");
    this._disconnected = true;

    if (wallet) {
      this._wallet = null;
      this._publicKey = null;
      wallet.off("accountChanged", this._accountChanged);

      // console.log("is wallet logged in", wallet.isLoggedIn);
      try {
        if (wallet.isLoggedIn) {
          await wallet.cleanUp();
        } else {
          wallet.clearElements();
        }
        removePreviousWindowRef(HyperLinkInstanceKey.ADAPTER);
      } catch (error: any) {
        this.emit("error", new WalletDisconnectionError(error?.message, error));
      }
    }

    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.connected) throw new WalletNotConnectedError();

      // console.log("singing transaction in wallet adapter!!");
      try {
        return (
          ((await wallet.signTransaction(transaction)) as T) || transaction
        );
      } catch (error: any) {
        throw new WalletSignTransactionError(error?.message, error);
      }
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.connected) throw new WalletNotConnectedError();

      try {
        return (
          ((await wallet.signAllTransactions(transactions)) as T[]) ||
          transactions
        );
      } catch (error: any) {
        throw new WalletSignTransactionError(error?.message, error);
      }
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.connected) throw new WalletNotConnectedError();

      try {
        const { signature } = await wallet.signMessage(message);
        return signature;
      } catch (error: any) {
        throw new WalletSignMessageError(error?.message, error);
      }
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  async sendTransaction(
    transaction: TransactionOrVersionedTransaction<
      this["supportedTransactionVersions"]
    >,
    connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.connected) throw new WalletNotConnectedError();

      return wallet.sendTransaction(
        transaction,
        this.prepareTransaction.bind(this),
        connection,
        options
      );
    } catch (error: any) {
      // This logic differs from the default `sendTransaction` method in BaseSignerWalletAdapter.
      // In the default implementation, they don't emit an error if the error is of `WalletSignTransactionError` type
      // because that error is thrown by `signTransaction` which already emits an error.
      // However, we emit the error here always because the `wallet.sendTransaction` above will not emit an error
      // in the sign phase, since it goes through the `wallet` object, and not our default `signTransaction` method above.
      this.emit("error", error);
      throw error;
    }
  }

  async signIn(input?: CustomSolanaSignInInput): Promise<SolanaSignInOutput> {
    // console.log("triggering sign in!");
    try {
      if (!this.connected) {
        const output = await this._connect({
          siwsInput: input,
        });
        const siwsOutput = output?.siwsOutput;
        if (input) {
          if (!siwsOutput) {
            throw new Error("No Solana Sign In Output");
          }
          return siwsOutput;
        }
      }

      const wallet = this._wallet;
      if (!wallet || !this.connected) throw new WalletNotConnectedError();

      const publicKey = this._publicKey;
      if (!publicKey) throw new WalletNotConnectedError("no public key found");

      try {
        const siwsInput =
          typeof input === "function"
            ? input()
            : input
              ? Promise.resolve(input)
              : undefined;
        const siwsOutput = await wallet.signIn(siwsInput);

        return siwsOutput;
      } catch (error: any) {
        throw new WalletSignInError(error?.message, error);
      }
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  public showWallet(page?: EmbeddedWalletPage) {
    if (this._showWallet) {
      this._showWallet(page);
    } else {
      console.error(
        `HyperLinkWalletAdapter Error: "showWallet" method not found, please refresh or try again.`
      );
    }
  }

  public hideWallet() {
    if (this._hideWallet) {
      this._hideWallet();
    } else {
      console.error(
        `HyperLinkWalletAdapter Error: "hideWallet" method not found, please refresh or try again.`
      );
    }
  }
}
