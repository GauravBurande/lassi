"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Wallet, Clock } from "lucide-react";
import { FeaturedNFTs } from "@/components/FeaturedNFTs";
import { SearchResults } from "@/components/SearchResults";
import { toast } from "sonner";
import { magicEdenAPI, MagicEdenNFT } from "@/lib/magiceden";
import Image from "next/image";

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MagicEdenNFT[]>([]);
  const [activeTab, setActiveTab] = useState("featured");

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a collection name or mint address");
      return;
    }

    setIsSearching(true);
    try {
      // Check if it's a mint address (44 characters, base58)
      if (searchQuery.length === 44) {
        try {
          const nft = await magicEdenAPI.getNFTByMint(searchQuery);
          setSearchResults([nft]);
          setActiveTab("search");
          toast.success("NFT found!");
        } catch (error) {
          toast.error("NFT not found or not listed on Magic Eden");
          setSearchResults([]);
        }
      } else {
        // Search for collections
        const collections = await magicEdenAPI.searchCollections(searchQuery);
        if (collections.length > 0) {
          // Get listings from the first matching collection
          const listings = await magicEdenAPI.getCollectionListings(
            collections[0].symbol,
            0,
            20
          );
          setSearchResults(listings);
          console.log(listings);
          setActiveTab("search");
          toast.success(
            `Found ${listings.length} listings in ${collections[0].name}`
          );
        } else {
          setSearchResults([]);
          toast.error("No collections found matching your search");
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <header className="relative z-10 bg-black/80 border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-3">
            <Image
              src="/icon.png"
              alt="Lassi Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg shadow-lg"
            />
            <span className="text-2xl font-bold text-white tracking-tight">
              Lassi
            </span>
          </div>
          <span className="hidden md:block text-gray-400 text-base font-medium">
            Buy Solana NFTs with USDC
          </span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!connected ? (
          <Card className="max-w-md mx-auto bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-white flex items-center justify-center gap-2">
                <Wallet className="w-6 h-6" />
                Connect Your Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-300 mb-6">
                Connect your Solana wallet to start buying NFTs with USDC
              </p>
              <WalletMultiButton className="!bg-gradient-to-r !from-green-600 !to-white-600 hover:!from-green-700 hover:!to-white-700 !w-full" />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Search Section */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search NFTs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter collection name or mint address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="bg-gradient-to-r from-green-600 to-white-600 hover:from-green-700 hover:to-white-700"
                  >
                    {isSearching ? "Searching..." : "Search"}
                  </Button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Search by the specific mint address address
                </p>
              </CardContent>
            </Card>

            {/* Main Content Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 bg-white/10 backdrop-blur-md">
                <TabsTrigger
                  value="featured"
                  className="data-[state=active]:bg-green-600"
                >
                  Featured NFTs
                </TabsTrigger>
                <TabsTrigger
                  value="search"
                  className="data-[state=active]:bg-green-600"
                >
                  Search Results
                </TabsTrigger>
                <TabsTrigger
                  value="coming-soon"
                  className="data-[state=active]:bg-green-600"
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Coming Soon
                </TabsTrigger>
              </TabsList>

              <TabsContent value="featured" className="mt-6">
                <FeaturedNFTs />
              </TabsContent>

              <TabsContent value="search" className="mt-6">
                <SearchResults
                  results={searchResults}
                  searchQuery={searchQuery}
                />
              </TabsContent>

              <TabsContent value="coming-soon" className="mt-6">
                <Card className="bg-white/10 backdrop-blur-md border-white/20">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="w-12 h-12 text-green-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Coming Soon
                    </h3>
                    <div className="text-gray-300 text-center max-w-md space-y-2">
                      <p>• Transaction History & Portfolio Tracking</p>
                      <p>• Advanced Filtering & Sorting Options</p>
                      <p>• Price Alerts & Notifications</p>
                      <p>• Bulk Purchase Operations</p>
                      <p>• Analytics & Market Insights</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
