import dotenv from 'dotenv';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Load environment variables from .env file
dotenv.config();

// Configuration interface
export interface AppConfig {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  fullnodeUrl: string;
  packageId: string;
  privateKey: string;
  keypair: Ed25519Keypair;
  client: SuiClient;
  apiUrl: string;
  openai: {
    apiKey: string;
    baseUrl: string;
  };
}

// Default configuration values
const DEFAULT_NETWORK = 'testnet';
const DEFAULT_PACKAGE_ID = ''; 
const DEFAULT_API_URL = 'http://localhost:3000/api';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const getConfig = (overrides?: Partial<AppConfig>): AppConfig => {
  const network = overrides?.network || (process.env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet' | 'localnet') || DEFAULT_NETWORK;
  const fullnodeUrl = overrides?.fullnodeUrl || process.env.SUI_FULLNODE_URL || getFullnodeUrl(network);
  const packageId = overrides?.packageId || process.env.SUI_PACKAGE_ID || DEFAULT_PACKAGE_ID;
  const privateKey = overrides?.privateKey || process.env.SUI_PRIVATE_KEY || '';
  const apiUrl = overrides?.apiUrl || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const openaiApiKey = overrides?.openai?.apiKey || process.env.OPENAI_API_KEY || '';
  const openaiBaseUrl = overrides?.openai?.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL;

  if (!privateKey) {
    throw new Error('SUI_PRIVATE_KEY is not defined in environment variables or configuration');
  }

  // Handle private key format (suiprivkey... or raw bytes)
  let keypair: Ed25519Keypair;
  if (privateKey.startsWith('suiprivkey')) {
    keypair = Ed25519Keypair.fromSecretKey(privateKey);
  } else {
    // Fallback for raw private keys (hex string)
    try {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      const secretKey = Buffer.from(hex, 'hex');
      keypair = Ed25519Keypair.fromSecretKey(secretKey);
    } catch (e) {
      // If hex parsing fails, try passing as is (might be another format supported by library)
      keypair = Ed25519Keypair.fromSecretKey(privateKey);
    }
  }

  const client = new SuiClient({ url: fullnodeUrl });

  return {
    network,
    fullnodeUrl,
    packageId,
    privateKey,
    keypair,
    client,
    apiUrl,
    openai: {
      apiKey: openaiApiKey,
      baseUrl: openaiBaseUrl
    }
  };
};
