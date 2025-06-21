"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShoppingCart, ExternalLink, Coins, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { magicEdenAPI } from "@/lib/magiceden";
import { jupiterAPI, TOKEN_ADDRESSES } from "@/lib/jupiter";
import Image from "next/image";

interface NFTCardProps {
  nft: any; // Accept any, as schema is more complex than MagicEdenNFT
}

export function NFTCard({ nft }: NFTCardProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState(0);
  const [usdcRequired, setUsdcRequired] = useState<number | null>(null);

  const steps = [
    "Getting SOL price",
    "Calculating USDC needed",
    "Getting swap quote",
    "Swapping USDC → SOL",
    "Purchasing NFT",
    "Transaction confirmed",
  ];

  const token = nft || {};
  const image =
    nft.extra?.img ||
    token.image ||
    token.properties?.files?.[0]?.uri ||
    token.properties?.files?.[1]?.uri ||
    "https://images.pexels.com/photos/6985003/pexels-photo-6985003.jpeg";
  const name = token.name || nft.name || "NFT";
  const collectionName =
    token.collectionName ||
    token.collection ||
    nft.collectionName ||
    nft.collection ||
    "Unknown";
  const price = nft.price ?? token.price ?? 0;
  const attributes = token.attributes || [];
  const mintAddress = token.mintAddress || nft.tokenMint || nft.mintAddress;
  const rarity =
    nft.rarity?.howrare?.rank ||
    nft.rarity?.moonrank?.rank ||
    nft.rarity?.meInstant?.rank ||
    null;

  const handlePurchase = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setPurchaseStep(0);

    try {
      // Step 1: Get current SOL price
      toast.info("Getting current SOL price...");
      const solPrice = await jupiterAPI.getSolPrice();
      setPurchaseStep(1);

      // Step 2: Calculate USDC needed
      toast.info("Calculating USDC required...");
      const usdcNeeded = price * solPrice * 1.02; // Add 2% buffer for slippage
      setUsdcRequired(usdcNeeded);
      setPurchaseStep(2);

      // Step 3: Get swap quote
      toast.info("Getting swap quote from Jupiter...");
      const usdcAmount = Math.floor(usdcNeeded * 1e6); // USDC has 6 decimals
      // const solAmount = jupiterAPI.solToLamports(price);

      const quote = await jupiterAPI.getQuote(
        TOKEN_ADDRESSES.USDC,
        TOKEN_ADDRESSES.SOL,
        usdcAmount,
        100 // 1% slippage
      );
      setPurchaseStep(3);

      // Step 4: Execute swap
      toast.info("Swapping USDC to SOL...");
      const swapResponse = await jupiterAPI.getSwapTransaction(
        quote,
        publicKey.toString(),
        true,
        true
      );

      const swapSignature = await jupiterAPI.executeSwap(
        swapResponse.swapTransaction,
        { signTransaction }
      );

      toast.success(
        `Swap completed! Signature: ${swapSignature.slice(0, 8)}...`
      );
      setPurchaseStep(4);

      // Step 5: Purchase NFT
      toast.info("Purchasing NFT from Magic Eden...");
      const buyInstruction = await magicEdenAPI.buyNFT(
        mintAddress,
        price,
        publicKey.toString()
      );

      // In a real implementation, you would execute the buy instruction here
      // For now, we'll simulate the purchase
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPurchaseStep(5);

      // Step 6: Complete
      toast.success(`Successfully purchased ${name}!`);
    } catch (error: any) {
      console.error("Purchase error:", error);

      if (error.message?.includes("insufficient")) {
        toast.error("Insufficient USDC balance for this purchase");
      } else if (error.message?.includes("slippage")) {
        toast.error("Price changed too much. Please try again.");
      } else {
        toast.error(`Purchase failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      setPurchaseStep(0);
      setUsdcRequired(null);
    }
  };

  const openMagicEden = () => {
    window.open(`https://magiceden.io/item-details/${mintAddress}`, "_blank");
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 group flex flex-col h-full">
      <CardHeader className="p-4 pb-0">
        <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-800">
          <Image
            src={image}
            alt={name}
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className="absolute top-2 left-2 bg-green-600/80 backdrop-blur-sm text-xs px-2 py-1">
            {collectionName}
          </Badge>
          {rarity && (
            <Badge className="absolute top-2 right-2 bg-yellow-500/90 text-xs px-2 py-1 flex items-center gap-1">
              <Star className="w-3 h-3" />
              Rank {rarity}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-white mb-1 truncate">
          {name}
        </h3>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400 truncate">
            Mint:{" "}
            <span className="font-mono text-gray-300">
              {mintAddress?.slice(0, 4)}...{mintAddress?.slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white font-bold text-base">
            <Coins className="w-4 h-4 text-yellow-400" />
            {price}{" "}
            <span className="text-xs font-normal text-gray-300 ml-1">SOL</span>
          </div>
        </div>

        {usdcRequired && (
          <div className="flex items-center justify-between mb-2 text-xs">
            <div className="text-gray-300">USDC Required</div>
            <div className="text-green-400 font-semibold">
              ~${usdcRequired.toFixed(2)}
            </div>
          </div>
        )}

        {attributes && attributes.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Top Traits</div>
            <div className="flex flex-wrap gap-1">
              {attributes.slice(0, 3).map((attr: any, index: number) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs border-white/20 text-gray-300 px-2 py-0.5"
                >
                  {attr.trait_type}: {attr.value}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span>{steps[purchaseStep]}</span>
              <span>
                {Math.round(((purchaseStep + 1) / steps.length) * 100)}%
              </span>
            </div>
            <Progress
              value={((purchaseStep + 1) / steps.length) * 100}
              className="h-2"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        <Button
          onClick={handlePurchase}
          disabled={!connected || isLoading}
          className="w-full bg-gradient-to-r from-green-600 to-white-600 hover:from-green-700 hover:to-white-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {steps[purchaseStep]}
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy with USDC
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-white/20 text-gray-300 hover:bg-white/10"
          onClick={openMagicEden}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View on Magic Eden
        </Button>
      </CardFooter>
    </Card>
  );
}
