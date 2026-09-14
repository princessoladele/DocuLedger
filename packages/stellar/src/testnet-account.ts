import { Keypair } from "@stellar/stellar-sdk";

/**
 * Generates a fresh Stellar keypair and funds it on Testnet via Friendbot.
 * Used by `scripts/setup-stellar-testnet.ts` to provision the operator
 * account that DocuLedger's worker uses to submit anchoring transactions.
 * Not used in normal request paths — this is a one-time setup helper.
 */
export async function createFundedTestnetAccount(
  friendbotUrl = "https://friendbot.stellar.org",
): Promise<{ publicKey: string; secretKey: string }> {
  const keypair = Keypair.random();
  const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(keypair.publicKey())}`);
  if (!response.ok) {
    throw new Error(`Friendbot funding failed: ${response.status} ${await response.text()}`);
  }
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}
