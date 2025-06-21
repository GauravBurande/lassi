import axios from "axios";

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

  async buyNFT(mintAddress: string, price: number, buyerPublicKey: string) {
    try {
      // 1. Fetch listing info for the mint
      const listingsResp = await axios.get(
        `https://api-mainnet.magiceden.dev/v2/tokens/${mintAddress}/listings`
      );

      console.log("listing res", listingsResp);
      const listings = listingsResp.data;
      if (!Array.isArray(listings) || listings.length === 0) {
        throw new Error("No active listings found for this NFT");
      }
      // Use the first listing (lowest price, most recent, etc.)
      const listing = listings[0];

      // 2. Construct the buy instruction payload using listing info
      // Prepare query params for GET request
      const params = {
        buyer: buyerPublicKey,
        seller: listing.seller,
        tokenMint: listing.tokenMint,
        tokenATA: listing.tokenAddress,
        price: listing.price,
        auctionHouseAddress: listing.auctionHouse,
        sellerReferral: listing.sellerReferral || "",
        sellerExpiry: listing.expiry ?? 0,
        // Optionally: pdaAddress: listing.pdaAddress,
      };

      const response = await axios.get(
        `${MAGIC_EDEN_API_BASE}/instructions/buy_now`,
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.MAGIC_EDEN_API_KEY}`,
          },
        }
      );
      console.log(response.data);
      return response.data;
    } catch (error: any) {
      if (
        error?.message?.includes("No active listings found for this NFT") ||
        error?.response?.data?.message?.includes(
          "No active listings found for this NFT"
        )
      ) {
        // Show toast if available in global window (for SSR safety)
        if (typeof window !== "undefined" && (window as any).toast) {
          (window as any).toast.error("No active listings found for this NFT");
        }
        console.error("Error creating buy instruction:", error);
        throw new Error("No active listings found for this NFT");
      } else {
        console.error("Error creating buy instruction:", error);
        throw new Error("Failed to create buy instruction");
      }
    }
  }
}

export const magicEdenAPI = MagicEdenAPI.getInstance();
