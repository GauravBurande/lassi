import { VersionedTransaction } from "@solana/web3.js";
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
            Authorization: `Bearer ${process.env.MAGIC_EDEN_API_KEY}`,
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

      const meSignedTxData = new Uint8Array(
        Buffer.from(buyIxResponse.data.txSigned.data, "base64")
      );
      const meTransaction = VersionedTransaction.deserialize(meSignedTxData);
      const meMessage = meTransaction.message;

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
        toast.error("No active listings found for this NFT");
        throw new Error("No active listings found for this NFT");
      } else {
        throw new Error(error?.message || "Failed to create buy instruction");
      }
    }
  }
}

export const magicEdenAPI = MagicEdenAPI.getInstance();
