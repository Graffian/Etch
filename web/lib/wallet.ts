export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
};

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getProvider(): WalletProvider | undefined {
  return (window as unknown as { ethereum?: WalletProvider }).ethereum;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "MetaMask isn't installed. Get it at metamask.io, then reload.",
    );
  }
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("No account returned by the wallet.");
  }
  return accounts[0];
}

export async function ensureSepolia(): Promise<void> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("MetaMask isn't installed.");
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia",
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
      return;
    }
    throw err instanceof Error ? err : new Error("Could not switch to Sepolia.");
  }
}

// signAnchor writes a 32-byte Merkle root into the calldata of a zero-value
// transaction to the zero address. The transaction hash is the permanent proof.
export async function signAnchor(
  account: string,
  rootHex: string,
): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("MetaMask isn't installed.");
  }
  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: ZERO_ADDRESS,
        value: "0x0",
        data: `0x${rootHex}`,
      },
    ],
  })) as string;
  if (typeof txHash !== "string" || txHash === "") {
    throw new Error("Wallet did not return a transaction hash.");
  }
  return txHash;
}
