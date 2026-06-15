import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, celoAlfajores } from "viem/chains";

export type CeloMode = "simulate" | "alfajores" | "celo";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "anchorHash",
    stateMutability: "nonpayable",
    inputs: [{ name: "hash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isAnchored",
    stateMutability: "view",
    inputs: [{ name: "hash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export function getCeloMode(): CeloMode {
  const raw = (process.env.CELO_MODE || "simulate").toLowerCase();
  if (raw === "celo" || raw === "alfajores" || raw === "simulate") return raw;
  return "simulate";
}

export function getCeloEnvironmentLabel(mode: CeloMode = getCeloMode()): string {
  if (mode === "simulate") return "Simulation (hash local uniquement)";
  if (mode === "alfajores") return "Celo Alfajores (testnet)";
  return "Celo mainnet";
}

export function isCeloConfigured(): boolean {
  const mode = getCeloMode();
  if (mode === "simulate") return false;
  return Boolean(process.env.CELO_PRIVATE_KEY?.trim());
}

export function celoExplorerTxUrl(network: string, txHash: string): string {
  if (network === "celo") return `https://celoscan.io/tx/${txHash}`;
  return `https://alfajores.celoscan.io/tx/${txHash}`;
}

function resolveChain(mode: CeloMode) {
  return mode === "celo" ? celo : celoAlfajores;
}

const ALFAJORES_RPC_FALLBACKS = [
  "https://alfajores-forno.celo-testnet.org",
  "https://1rpc.io/celo/alfajores",
  "https://endpoints.omniatech.io/v1/celo/alfajores/public",
];

function resolveRpcUrl(mode: CeloMode): string {
  const custom = process.env.CELO_RPC_URL?.trim();
  if (custom) return custom;
  const chain = resolveChain(mode);
  if (mode === "alfajores") {
    return ALFAJORES_RPC_FALLBACKS[0] ?? chain.rpcUrls.default.http[0];
  }
  return chain.rpcUrls.default.http[0];
}

function createCeloTransport(mode: CeloMode) {
  const urls =
    mode === "alfajores"
      ? [process.env.CELO_RPC_URL?.trim(), ...ALFAJORES_RPC_FALLBACKS].filter(
          (url, index, list): url is string => Boolean(url) && list.indexOf(url) === index
        )
      : [resolveRpcUrl(mode)];

  if (urls.length <= 1) {
    return http(urls[0], { timeout: 12_000 });
  }
  return fallback(urls.map((url) => http(url, { timeout: 12_000 })));
}

function hashToBytes32(hashSha256: string): Hex {
  const hex = hashSha256.replace(/^0x/i, "").slice(0, 64).padStart(64, "0");
  return `0x${hex}` as Hex;
}

function normalizePrivateKey(value: string): Hex {
  const trimmed = value.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

export interface CeloAnchorResult {
  txHash: string;
  network: CeloMode;
  blockNumber: string;
}

export async function anchorHashOnCelo(hashSha256: string): Promise<CeloAnchorResult | null> {
  const mode = getCeloMode();
  if (mode === "simulate") return null;

  const privateKey = process.env.CELO_PRIVATE_KEY?.trim();
  if (!privateKey) return null;

  const chain = resolveChain(mode);
  const transport = createCeloTransport(mode);
  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  const hashBytes = hashToBytes32(hashSha256);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const registry = process.env.CELO_REGISTRY_ADDRESS?.trim() as Address | undefined;
  let txHash: Hex;

  if (registry) {
    txHash = await walletClient.writeContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "anchorHash",
      args: [hashBytes],
    });
  } else {
    txHash = await walletClient.sendTransaction({
      account,
      chain,
      to: account.address,
      value: BigInt(0),
      data: hashBytes,
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return {
    txHash,
    network: mode,
    blockNumber: receipt.blockNumber.toString(),
  };
}

export async function verifyHashOnCelo(
  network: string,
  txHash: string,
  expectedHashSha256: string
): Promise<boolean> {
  if (!txHash || network === "simulate") return false;
  const mode: CeloMode = network === "celo" ? "celo" : "alfajores";
  const chain = resolveChain(mode);
  const transport = createCeloTransport(mode);
  const publicClient = createPublicClient({ chain, transport });

  const registry = process.env.CELO_REGISTRY_ADDRESS?.trim() as Address | undefined;
  const expected = hashToBytes32(expectedHashSha256);

  if (registry) {
    return publicClient.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "isAnchored",
      args: [expected],
    });
  }

  const tx = await publicClient.getTransaction({ hash: txHash as Hex });
  if (!tx?.input) return false;
  const input = tx.input.toLowerCase();
  return input.includes(expected.slice(2).toLowerCase());
}
