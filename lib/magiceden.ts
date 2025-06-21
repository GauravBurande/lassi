import axios from "axios";
import { toast } from "sonner";

const MAGIC_EDEN_API_BASE = "https://api-mainnet.magiceden.dev/v2";

export interface MagicEdenNFT {
  mintAddress: string;
  name: string;
  image: string;
  collectionName: string;
  price: number;
  seller: string;
  tokenMint: string;
  tokenAddress: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface MagicEdenCollection {
  symbol: string;
  name: string;
  description: string;
  image: string;
  floorPrice: number;
  listedCount: number;
  volumeAll: number;
}

export class MagicEdenAPI {
  private static instance: MagicEdenAPI;
  private apiKey: string | null = null;

  private constructor() {}

  public static getInstance(): MagicEdenAPI {
    if (!MagicEdenAPI.instance) {
      MagicEdenAPI.instance = new MagicEdenAPI();
    }
    return MagicEdenAPI.instance;
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
    };
  }

  async getPopularCollections(
    limit: number = 20
  ): Promise<MagicEdenCollection[]> {
    try {
      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/collections?offset=0&limit=${limit}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching popular collections:", error);
      throw new Error("Failed to fetch popular collections");
    }
  }

  async getCollectionStats(collectionSymbol: string) {
    try {
      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/collections/${collectionSymbol}/stats`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching collection stats:", error);
      throw new Error("Failed to fetch collection stats");
    }
  }

  async getCollectionListings(
    collectionSymbol: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<MagicEdenNFT[]> {
    try {
      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/collections/${collectionSymbol}/listings?offset=${offset}&limit=${limit}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching collection listings:", error);
      throw new Error("Failed to fetch collection listings");
    }
  }

  async searchCollections(query: string): Promise<MagicEdenCollection[]> {
    try {
      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/collections?offset=0&limit=50`,
        { headers: this.getHeaders() }
      );

      // Filter collections by name or symbol containing the query
      const collections = response.data;
      return collections.filter(
        (collection: MagicEdenCollection) =>
          collection.name.toLowerCase().includes(query.toLowerCase()) ||
          collection.symbol.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error("Error searching collections:", error);
      throw new Error("Failed to search collections");
    }
  }

  async getNFTByMint(mintAddress: string): Promise<MagicEdenNFT> {
    try {
      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/tokens/${mintAddress}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching NFT by mint:", error);
      throw new Error("Failed to fetch NFT details");
    }
  }

  async buyNFT(
    mintAddress: string,
    price: number,
    buyerPublicKey: string,
    connection: any
  ) {
    try {
      // 1. Fetch listing info for the mint
      const listingsResp = await axios.get(
        `https://api-mainnet.magiceden.dev/v2/tokens/${mintAddress}/listings`
      );
      const listings = listingsResp.data;
      if (!Array.isArray(listings) || listings.length === 0) {
        throw new Error("No active listings found for this NFT");
      }
      const listing = listings[0];

      // 2. Construct the buy instruction payload using listing info
      console.log("auctionhouser", listing.auctionHouse);
      if (!listing.auctionHouse) {
        toast.error("You can't buy this one, it doesn't has auction house!");
        return;
      }
      const params: any = {
        buyer: buyerPublicKey,
        seller: listing.seller,
        auctionHouseAddress: listing.auctionHouse,
        tokenMint: mintAddress,
        tokenATA: listing.tokenAddress,
        price: listing.price.toString(),
      };
      if (listing.expiry !== undefined && listing.expiry !== 0) {
        params.sellerExpiry = listing.expiry;
      }

      const buyIxResponse = await axios.get(
        `${MAGIC_EDEN_API_BASE}/instructions/buy_now`,
        {
          headers: {
            Authorization: `Bearer 0717815d-e286-4d15-bf7c-68b07901c858`,
            Accept: "application/json",
          },
          params: params,
        }
      );

      if (!buyIxResponse.data?.txSigned?.data) {
        throw new Error(
          "Magic Eden buy_now did not return a signed transaction component (txSigned.data missing)."
        );
      }

      // 3. Deserialize the transaction and handle address lookup tables
      const {
        VersionedTransaction,
        TransactionMessage,
        AddressLookupTableAccount,
        PublicKey,
      } = await import("@solana/web3.js");
      const meSignedTxData = new Uint8Array(
        Buffer.from(buyIxResponse.data.txSigned.data, "base64")
      );
      const meTransaction = VersionedTransaction.deserialize(meSignedTxData);
      const meMessage = meTransaction.message;

      let addressLookupTableAccounts: any[] = [];
      if (meMessage.addressTableLookups.length > 0) {
        const lookupTableKeys = meMessage.addressTableLookups.map(
          (lookup: any) => lookup.accountKey.toBase58()
        );
        // Helper to fetch lookup table accounts
        const getAddressLookupTableAccounts = async (
          keys: string[],
          connection: any
        ) => {
          const addressLookupTableAccountInfos =
            await connection.getMultipleAccountsInfo(
              keys.map((key) => new PublicKey(key))
            );
          return addressLookupTableAccountInfos.reduce(
            (acc: any[], accountInfo: any, index: number) => {
              const addressLookupTableAddress = keys[index];
              if (accountInfo) {
                const addressLookupTableAccount = new AddressLookupTableAccount(
                  {
                    key: new PublicKey(addressLookupTableAddress),
                    state: AddressLookupTableAccount.deserialize(
                      new Uint8Array(accountInfo.data)
                    ),
                  }
                );
                acc.push(addressLookupTableAccount);
              }
              return acc;
            },
            []
          );
        };
        addressLookupTableAccounts = await getAddressLookupTableAccounts(
          lookupTableKeys,
          connection
        );
      }

      // 4. Decompile and recompile the transaction with a fresh blockhash
      // const decompiledInstructions = TransactionMessage.decompile(meMessage, {
      //   addressLookupTableAccounts: addressLookupTableAccounts,
      // }).instructions;
      // // const { blockhash } = await connection.getLatestBlockhash();
      // const finalMessage = new TransactionMessage({
      //   payerKey: new PublicKey(buyerPublicKey),
      //   recentBlockhash: blockhash,
      //   instructions: decompiledInstructions,
      // }).compileToV0Message(addressLookupTableAccounts);
      const finalTransaction = new VersionedTransaction(meMessage);
      const base64Transaction = Buffer.from(
        finalTransaction.serialize()
      ).toString("base64");
      return { transaction: base64Transaction };
    } catch (error: any) {
      if (
        error?.message?.includes("No active listings found for this NFT") ||
        error?.response?.data?.message?.includes(
          "No active listings found for this NFT"
        )
      ) {
        if (typeof window !== "undefined" && (window as any).toast) {
          (window as any).toast.error("No active listings found for this NFT");
        }
        throw new Error("No active listings found for this NFT");
      } else {
        throw new Error(error?.message || "Failed to create buy instruction");
      }
    }
  }
}

export const magicEdenAPI = MagicEdenAPI.getInstance();
