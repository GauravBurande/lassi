import axios from "axios";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";

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
    this.connection = new Connection("https://api-mainnet.magiceden.dev/v2");
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
        onlyDirectRoutes: "false",
        asLegacyTransaction: "false",
      });

      const response = await axios.get(`${JUPITER_API_BASE}/quote?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error getting Jupiter quote:", error);
      throw new Error("Failed to get swap quote");
    }
  }

  async getOrder(
    inputMint: string,
    outputMint: string,
    amount: number,
    taker: string,
    slippageBps: number = 50
  ): Promise<{ txn: string; requestId: string }> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        taker,
        slippageBps: slippageBps.toString(),
      });

      const response = await axios.get(
        `https://lite-api.jup.ag/ultra/v1/order?${params}`
      );
      console.log("Jupiter getOrder response:", response.data);
      const orderResponse = response.data;
      console.log("order res", orderResponse);
      return {
        txn: orderResponse.transaction,
        requestId: orderResponse.requestId,
      };
    } catch (error) {
      console.error("Error getting Jupiter order:", error);
      throw new Error("Failed to get swap order");
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
        skipUserAccountsRpcCalls: false,
      });

      return response.data;
    } catch (error) {
      console.error("Error getting swap transaction:", error);
      throw new Error("Failed to create swap transaction");
    }
  }

  /**
   * Executes a Jupiter swap transaction.
   * Throws a more descriptive error if a 403 Forbidden is encountered.
   */
  async executeSwap(
    swapTransactionBase64: string,
    wallet: any,
    requestId: any
  ): Promise<string> {
    if (!swapTransactionBase64) {
      throw new Error("No swap transaction provided to executeSwap.");
    }
    try {
      // Deserialize the transaction
      const swapTransactionBuf = Uint8Array.from(
        Buffer.from(swapTransactionBase64, "base64")
      );
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign and send the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      const signedTxBs64 = Buffer.from(signedTransaction.serialize()).toString(
        "base64"
      );

      console.log("signedTxBs64", signedTxBs64);

      let executeResponse;
      try {
        const response = await fetch(
          "https://lite-api.jup.ag/ultra/v1/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              signedTransaction: signedTxBs64,
              requestId: requestId,
            }),
          }
        );
        executeResponse = await response.json();
        console.log("excute res", executeResponse);
      } catch (fetchError) {
        console.error(
          "Error sending transaction to Jupiter execute endpoint:",
          fetchError
        );
        throw new Error(
          "Failed to send transaction to Jupiter execute endpoint"
        );
      }

      if (!executeResponse || !executeResponse.signature) {
        console.error(
          "No signature returned from Jupiter execute endpoint:",
          executeResponse
        );
        throw new Error("No signature returned from Jupiter execute endpoint");
      }

      return executeResponse.signature;
    } catch (error: any) {
      // Check for 403 Forbidden error from RPC
      if (
        error &&
        (error.code === 403 ||
          (typeof error.message === "string" &&
            error.message.includes("403")) ||
          (typeof error.message === "string" &&
            error.message.includes("Access forbidden")))
      ) {
        console.error("Jupiter swap failed: Access forbidden (403).", error);
        throw new Error(
          "Swap failed: Access forbidden (403). This may be due to rate limits, RPC restrictions, or Jupiter API access issues. Please try again later or check your RPC endpoint."
        );
      }
      console.error("Error executing swap:", error);
      throw new Error("Failed to execute swap");
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
        "So11111111111111111111111111111111111111112", // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        1e9, // 1 SOL in lamports
        50
      );

      const solPriceInUsdc = parseInt(quote.outAmount) / 1e6; // USDC has 6 decimals
      return solPriceInUsdc;
    } catch (error) {
      console.error("Error getting SOL price:", error);
      return 50; // Fallback price
    }
  }
}

export const jupiterAPI = JupiterAPI.getInstance();

// Common token addresses
export const TOKEN_ADDRESSES = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};
