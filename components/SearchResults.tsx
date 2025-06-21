"use client";

import { NFTCard } from "./NFTCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, AlertCircle } from "lucide-react";
import { MagicEdenNFT } from "@/lib/magiceden";

interface SearchResultsProps {
  results: MagicEdenNFT[];
  searchQuery: string;
}

export function SearchResults({ results, searchQuery }: SearchResultsProps) {
  console.log(results[0]);
  return (
    <div>
      <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Results
            {searchQuery && (
              <span className="text-sm font-normal text-gray-300">
                for &quot;{searchQuery}&quot;
              </span>
            )}
          </CardTitle>
        </CardHeader>
        {results.length > 0 && (
          <CardContent>
            <p className="text-gray-300">
              Found {results.length} NFT{results.length !== 1 ? "s" : ""}{" "}
              matching your search.
            </p>
          </CardContent>
        )}
      </Card>

      {results.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Results Found
            </h3>
            <p className="text-gray-300 text-center max-w-md">
              {searchQuery
                ? `No NFTs found for "${searchQuery}". Try searching for a different collection name or mint address.`
                : "Enter a search term above to find NFTs from Magic Eden."}
            </p>
            <div className="mt-4 text-sm text-gray-400 text-center">
              <p>Search tips:</p>
              {/* <p>
                • Use collection names like &quot;DeGods&quot; or
                &quot;y00ts&quot;
              </p> */}
              <p>• Enter a specific mint address (44 characters)</p>
              <p>• Try popular nft&apos;s mit address</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((nft) => (
            <NFTCard key={nft.mintAddress} nft={nft} />
          ))}
        </div>
      )}
    </div>
  );
}
