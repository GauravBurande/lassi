import axios from 'axios';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

const JUPITER_API_BASE = 'https://quote-api.jup.ag/v6';

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export class JupiterAPI {
  private static instance: JupiterAPI;
  private connection: Connection;

  private constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  public static getInstance(): JupiterAPI {
    if (!JupiterAPI.instance) {
      JupiterAPI.instance = new JupiterAPI();
    }
    return JupiterAPI.instance;
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<JupiterQuote> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false'
      });

      const response = await axios.get(`${JUPITER_API_BASE}/quote?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      throw new Error('Failed to get swap quote');
    }
  }

  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    wrapAndUnwrapSol: boolean = true,
    useSharedAccounts: boolean = true,
    feeAccount?: string,
    trackingAccount?: string,
    computeUnitPriceMicroLamports?: number
  ): Promise<JupiterSwapResponse> {
    try {
      const response = await axios.post(`${JUPITER_API_BASE}/swap`, {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol,
        useSharedAccounts,
        feeAccount,
        trackingAccount,
        computeUnitPriceMicroLamports,
        asLegacyTransaction: false,
        useTokenLedger: false,
        destinationTokenAccount: null,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: false
      });

      return response.data;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      throw new Error('Failed to create swap transaction');
    }
  }

  async executeSwap(
    swapTransactionBase64: string,
    wallet: any
  ): Promise<string> {
    try {
      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign and send the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      // Confirm the transaction
      await this.connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw new Error('Failed to execute swap');
    }
  }

  // Helper method to convert SOL to lamports
  solToLamports(sol: number): number {
    return Math.floor(sol * 1e9);
  }

  // Helper method to convert lamports to SOL
  lamportsToSol(lamports: number): number {
    return lamports / 1e9;
  }

  // Get current SOL price in USDC (approximate)
  async getSolPrice(): Promise<number> {
    try {
      // Get a small quote to determine current SOL price
      const quote = await this.getQuote(
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        1e9, // 1 SOL in lamports
        50
      );
      
      const solPriceInUsdc = parseInt(quote.outAmount) / 1e6; // USDC has 6 decimals
      return solPriceInUsdc;
    } catch (error) {
      console.error('Error getting SOL price:', error);
      return 50; // Fallback price
    }
  }
}

export const jupiterAPI = JupiterAPI.getInstance();

// Common token addresses
export const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
};