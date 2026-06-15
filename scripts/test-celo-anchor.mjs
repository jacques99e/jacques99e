/**
 * Teste l'ancrage d'un hash sur Celo Alfajores (sans toucher Supabase).
 */
import fs from "fs";
import path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoAlfajores } from "viem/chains";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const pk = env.CELO_PRIVATE_KEY?.trim();
const rpc = env.CELO_RPC_URL?.trim() || celoAlfajores.rpcUrls.default.http[0];

if (!pk) {
  console.error("[celo-test] CELO_PRIVATE_KEY manquant — lancez scripts/setup-celo.ps1");
  process.exit(1);
}

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const publicClient = createPublicClient({ chain: celoAlfajores, transport: http(rpc) });
const walletClient = createWalletClient({
  account,
  chain: celoAlfajores,
  transport: http(rpc),
});

const balance = await publicClient.getBalance({ address: account.address });
console.log(`[celo-test] Wallet: ${account.address}`);
console.log(`[celo-test] Solde: ${Number(balance) / 1e18} CELO`);

if (balance === BigInt(0)) {
  console.warn("[celo-test] Solde zero — financez via https://faucet.celo.org (reseau Alfajores)");
  console.warn(`[celo-test] Adresse a crediter: ${account.address}`);
  process.exit(0);
}

const testHash = `0x${"ab".repeat(32)}`;
const txHash = await walletClient.sendTransaction({
  account,
  chain: celoAlfajores,
  to: account.address,
  value: BigInt(0),
  data: testHash,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
console.log(`[celo-test] Ancrage OK — tx: https://alfajores.celoscan.io/tx/${txHash}`);
console.log(`[celo-test] Bloc: ${receipt.blockNumber}`);
