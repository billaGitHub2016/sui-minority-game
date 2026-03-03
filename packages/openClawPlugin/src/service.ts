import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { blake2bHex } from 'blakejs';
import { getConfig, AppConfig } from './config';
import { bcs } from '@mysten/sui/bcs';
import * as tlock from 'tlock-js';

// Constants
const MODULE_NAME = 'minority_game';

export interface Poll {
  id: string;
  question: string;
  option1: string;
  option2: string;
  endTime: number;
}

export interface VoteResult {
  status: 'success' | 'failed';
  digest?: string;
  error?: string;
}

export class MinorityGameService {
  private client: SuiClient;
  private packageId: string;
  private keypair: Ed25519Keypair;
  private apiUrl: string;
  private network: string;

  constructor(configOverrides?: Partial<AppConfig>) {
    const config = getConfig(configOverrides);
    this.client = config.client;
    this.packageId = config.packageId;
    this.apiUrl = config.apiUrl;
    this.network = config.network;
    this.keypair = config.keypair;
  }

  /**
   * Helper to execute a transaction
   */
  async fetchActivePolls(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiUrl}/topics/active`);
      if (!response.ok) {
        throw new Error(`Failed to fetch active polls: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data.topics || [];
    } catch (e: any) {
      console.error('Error fetching active polls:', e);
      return [];
    }
  }

  async executeTx(tx: Transaction): Promise<VoteResult> {
    try {
      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      await this.client.waitForTransaction({ digest: result.digest });

      if (result.effects?.status.status === 'success') {
        return { status: 'success', digest: result.digest };
      } else {
        return { 
          status: 'failed', 
          digest: result.digest, 
          error: result.effects?.status.error || 'Unknown error' 
        };
      }
    } catch (e: any) {
      console.error('Transaction execution failed:', e);
      return { status: 'failed', error: e.message };
    }
  }

  /**
   * Commit a vote (Phase 1)
   * @param pollId The object ID of the Poll (Sui Object ID)
   * @param choice The user's choice (string)
   * @param salt A random salt for hashing
   * @param topicDatabaseId The database UUID of the topic (required for backend backup)
   * @param pollEndTime The end time of the poll (required for timelock encryption)
   */
  async commitVote(pollId: string, choice: string, salt: string, topicDatabaseId?: string, pollEndTime?: number): Promise<VoteResult> {
    const tx = new Transaction();
    
    // Hash: blake2b(choice + salt)
    const hashInput = choice + salt;
    const hash = blake2bHex(hashInput, undefined, 32); // 32 bytes output
    const hashBytes = Buffer.from(hash, 'hex');

    // Split 0.1 SUI (100_000_000 MIST) for stake
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000)]);
    tx.setGasBudget(100_000_000); // 0.1 SUI

    tx.moveCall({
      target: `${this.packageId}::${MODULE_NAME}::commit_vote`,
      arguments: [
        tx.object(pollId),
        tx.pure.vector('u8', hashBytes),
        coin,
        tx.object('0x6'), // Clock
      ],
    });

    const txResult = await this.executeTx(tx);

    if (txResult.status === 'success' && txResult.digest) {
      // Backup to Backend
      console.log('Transaction successful. Backing up vote to backend...');
      try {
        // Use topicDatabaseId if available, otherwise try pollId (which might fail if it's not UUID)
        const dbId = topicDatabaseId || pollId;
        await this.backupVoteToBackend(dbId, choice, salt, txResult.digest, pollEndTime);
        console.log('Backup successful.');
      } catch (e: any) {
        console.error('Backup failed:', e);
        // We still return success for the chain tx, but maybe warn about backup?
        // Or we can return a partial success status if needed.
        return {
          status: 'success',
          digest: txResult.digest,
          error: `Chain success, but backup failed: ${e.message}`
        };
      }
    }

    return txResult;
  }

  // Placeholder encryption method
  // Ideally this should use a public key from the backend/admin
  private async encrypt(text: string, round: number): Promise<string> {
    // Timelock encryption
    // Compatible with route.ts logic: 
    // const plaintext = await tlock.timelockDecrypt(vote.salt, tlock.mainnetClient());
    
    // So we must use mainnetClient for encryption too (or default which is usually mainnet/fastnet)
    // tlock-js encrypts to a round.
    
    // Note: tlock.timelockEncrypt returns a Promise<string> (base64 encoded ciphertext usually)
    const client = tlock.mainnetClient();
    const ciphertext = await tlock.timelockEncrypt(
      round,
      Buffer.from(text),
      client
    );
    return ciphertext;
  }

  /**
   * Backup vote to backend DB so it can be revealed later by the admin/cron.
   */
  async backupVoteToBackend(pollId: string, choice: string, salt: string, txDigest: string, pollEndTime?: number): Promise<void> {
    
    let encryptedChoice = choice;
    let encryptedSalt = salt;

    if (pollEndTime) {
       // Calculate round from pollEndTime
       // Drand Mainnet: Genesis 1595431050, Period 30s
       // We want to encrypt it so it can be decrypted AFTER pollEndTime.
       // So round = ceil((pollEndTime/1000 - genesis) / period)
       
       const GENESIS = 1595431050;
       const PERIOD = 30;
       const now = Math.floor(Date.now() / 1000);
       const targetTime = Math.floor(pollEndTime / 1000);
       
       // Ensure we are encrypting for the future. 
       // If pollEndTime is in the past, just use current round + 1 or similar to allow immediate decryption.
       const safeTargetTime = Math.max(targetTime, now + 30); 
       
       const round = Math.ceil((safeTargetTime - GENESIS) / PERIOD);
       
       // Prepare payload as expected by route.ts: JSON.stringify({ choice, salt })
       const payload = JSON.stringify({ choice, salt });
       
       console.log(`Encrypting vote for round ${round} (approx ${(safeTargetTime - now)/60} mins from now)`);
       
       try {
         const ciphertext = await this.encrypt(payload, round);
         
         // Set choice to "ENCRYPTED" as flag
         encryptedChoice = "ENCRYPTED";
         // Set salt to the ciphertext
         encryptedSalt = ciphertext;
       } catch (e) {
         console.warn("Timelock encryption failed, falling back to plaintext backup:", e);
         // Fallback is plaintext (original choice/salt)
       }
    } else {
        console.warn("No pollEndTime provided, skipping timelock encryption (plaintext backup).");
    }

    const payload = {
      topic_id: pollId,
      user_address: this.keypair.getPublicKey().toSuiAddress(),
      choice: encryptedChoice,
      salt: encryptedSalt,
      tx_digest: txDigest,
      network: this.network
    };

    const response = await fetch(`${this.apiUrl}/vote/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Backend API Error: ${data.error}`);
    }
  }

  /**
   * Helper to generate salt
   */
  generateSalt(): string {
     // Generate a random 16-byte hex string (32 chars)
    return Array.from({length: 16}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  getAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  async getBalance(): Promise<number> {
    const balance = await this.client.getBalance({ owner: this.getAddress() });
    return parseInt(balance.totalBalance);
  }

  async transferSui(recipient: string, amount: number): Promise<VoteResult> {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    tx.transferObjects([coin], tx.pure.address(recipient));
    return this.executeTx(tx);
  }
}
