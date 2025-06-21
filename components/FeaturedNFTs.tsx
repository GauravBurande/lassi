"use client";

import { useEffect, useState } from "react";
import { NFTCard } from "./NFTCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertCircle } from "lucide-react";
import { magicEdenAPI, MagicEdenNFT } from "@/lib/magiceden";
import { toast } from "sonner";

export function FeaturedNFTs() {
  // Memoize the featured NFTs so they are only fetched once per session
  const [nfts, setNfts] = useState<MagicEdenNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a module-level variable to cache the featured NFTs
  // This will persist across tab switches and component unmounts within the same session
  let featuredNFTsCache: MagicEdenNFT[] | null = null;

  useEffect(() => {
    let isMounted = true;

    const fetchFeaturedNFTs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if we already have cached NFTs
        if (featuredNFTsCache && featuredNFTsCache.length > 0) {
          if (isMounted) {
            setNfts(featuredNFTsCache);
            setLoading(false);
          }
          return;
        }

        const madLadsListings = await magicEdenAPI.getCollectionListings(
          "mad_lads",
          0,
          18
        );

        if (!madLadsListings || madLadsListings.length === 0) {
          if (isMounted) setError("No Mad Lads listings found");
          return;
        }

        // Cache the NFTs for future renders
        featuredNFTsCache = madLadsListings.slice(0, 18);

        if (isMounted) {
          setNfts(featuredNFTsCache);
          // Optionally: console.log(featuredNFTsCache[0]);
        }
      } catch (error) {
        console.error("Error fetching Mad Lads NFTs:", error);
        if (isMounted) {
          setError("Failed to load featured NFTs. Please try again later.");
          toast.error("Failed to load featured NFTs");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFeaturedNFTs();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Featured NFTs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              Loading trending NFTs from popular Solana collections...
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card
              key={index}
              className="bg-white/10 backdrop-blur-md border-white/20"
            >
              <CardContent className="p-4">
                <Skeleton className="aspect-square w-full mb-4 bg-white/20" />
                <Skeleton className="h-4 w-3/4 mb-2 bg-white/20" />
                <Skeleton className="h-4 w-1/2 bg-white/20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Featured NFTs
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Unable to Load NFTs
            </h3>
            <p className="text-gray-300 text-center max-w-md mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-white-600 text-white rounded-lg hover:from-green-700 hover:to-white-700 transition-colors"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Featured NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">
            Discover trending NFTs from popular Solana collections. All
            purchases are processed through our secure USDC → SOL swap system.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nfts.map((nft) => (
          <NFTCard key={nft.mintAddress} nft={nft} />
        ))}
      </div>
    </div>
  );
}
