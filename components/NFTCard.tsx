"use client";

import { useState, useEffect } from "react";
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
import { Transaction, VersionedTransaction, Connection } from "@solana/web3.js";

interface NFTCardProps {
  nft: any; // Accept any, as schema is more complex than MagicEdenNFT
}

export function NFTCard({ nft }: NFTCardProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState(0);
  const [usdcRequired, setUsdcRequired] = useState<number | null>(null);
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null);

  const steps = [
    "Getting SOL price",
    "Calculating USDC needed",
    "Getting swap transaction",
    "Swapping USDC → SOL",
    "Purchasing NFT",
    "Transaction confirmed",
  ];

  const token = nft.token || {};
  const image =
    nft.extra?.img ||
    token.image ||
    nft.properties?.files?.[0]?.uri ||
    nft.properties?.files?.[1]?.uri ||
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
  const seller = nft.owner || token.owner;
  const rarity =
    nft.rarity?.howrare?.rank ||
    nft.rarity?.moonrank?.rank ||
    nft.rarity?.meInstant?.rank ||
    null;

  // Fetch SOL price and calculate USDC price for the NFT
  useEffect(() => {
    let mounted = true;
    async function fetchSolPrice() {
      try {
        const solPriceVal = await jupiterAPI.getSolPrice();
        if (mounted) {
          setUsdcPrice(price * solPriceVal);
        }
      } catch (e) {
        setUsdcPrice(null);
      }
    }
    if (price > 0) {
      fetchSolPrice();
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  if (!signTransaction) {
    throw new Error("no public key sherlock!");
  }
  // Helper function to perform the USDC -> SOL swap via Jupiter
  const swapUsdcToSol = async ({
    usdcAmount,
    publicKey,
    setPurchaseStep,
  }: {
    usdcAmount: number;
    publicKey: any;
    setPurchaseStep: (step: number) => void;
  }) => {
    toast.info("Getting swap transaction from Jupiter...");
    console.info("Getting swap transaction from Jupiter...");
    console.log("usdcAmount", usdcAmount);

    console.info("getting order");
    const orderResult = await jupiterAPI.getOrder(
      TOKEN_ADDRESSES.USDC,
      TOKEN_ADDRESSES.SOL,
      usdcAmount,
      publicKey.toString(),
      100 // 1% slippage
    );
    console.log("Jupiter getOrder response:", orderResult);
    const { txn, requestId } = orderResult;
    if (!txn) {
      throw new Error(
        "Jupiter API did not return a swap transaction. Please try again later."
      );
    }
    setPurchaseStep(3);

    // Step 4: Execute swap
    toast.info("Swapping USDC to SOL...");
    console.info("Swapping USDC to SOL...");
    const swapSignature = await jupiterAPI.executeSwap(
      txn,
      { signTransaction },
      requestId
    );

    toast.success(`Swap completed! Signature: ${swapSignature.slice(0, 8)}...`);
    console.log(`Swap completed! Signature: ${swapSignature}...`);
    setPurchaseStep(4);

    return swapSignature;
  };

  // Helper function to buy NFT from Magic Eden
  const buyNftFromMagicEden = async ({
    mintAddress,
    price,
    publicKey,
  }: {
    mintAddress: string;
    price: number;
    publicKey: any;
  }) => {
    toast.info("Purchasing NFT from Magic Eden...");
    console.info("Purchasing NFT from Magic Eden...");
    const buyInstruction = await magicEdenAPI.buyNFT(
      mintAddress,
      price,
      publicKey.toString()
    );

    // Real implementation: execute the buy instruction
    // buyInstruction is expected to have a base64 transaction string (legacy or versioned)
    let txBase64 =
      buyInstruction.transaction ||
      buyInstruction.tx ||
      buyInstruction.data ||
      buyInstruction;
    if (!txBase64) throw new Error("No transaction returned from Magic Eden");

    // Try both VersionedTransaction and Transaction deserialization
    let transaction;
    try {
      const txBuf = Uint8Array.from(Buffer.from(txBase64, "base64"));
      try {
        transaction = VersionedTransaction.deserialize(txBuf);
      } catch (e) {
        transaction = Transaction.from(txBuf);
      }
    } catch (e) {
      throw new Error("Failed to deserialize Magic Eden transaction");
    }

    // Sign with wallet
    const signedTx = await signTransaction(transaction);
    // Send and confirm
    const connection = new Connection("https://api-mainnet.magiceden.dev/v2");
    const txid = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(txid, "confirmed");
    setPurchaseStep(5);
    toast.success(`NFT purchase tx: ${txid.slice(0, 8)}...`);
    console.info(`NFT purchase tx: ${txid}`);

    // Step 6: Complete
    toast.success(`Successfully purchased ${name}!`);
    console.log(`Successfully purchased ${name}!`);
    return txid;
  };

  const handlePurchase = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setPurchaseStep(0);

    try {
      // todo: uncomment
      // Step 1: Get current SOL price
      // toast.info("Getting current SOL price...");
      // console.info("Getting current SOL price...");
      // const solPrice = await jupiterAPI.getSolPrice();
      // setUsdcPrice(price * solPrice);
      // console.log("solPrice", solPrice);
      // setPurchaseStep(1);

      // // Step 2: Calculate USDC needed
      // toast.info("Calculating USDC required...");
      // console.info("Calculating USDC required...");
      // const usdcNeeded = price * solPrice * 1.02; // Add 2% buffer for slippage
      // console.log("usdcNeeded", usdcNeeded);
      // setUsdcRequired(usdcNeeded);
      // setPurchaseStep(2);

      // // Step 3 & 4: Swap USDC to SOL
      // const usdcAmount = Math.floor(usdcNeeded * 1e6); // USDC has 6 decimals
      // await swapUsdcToSol({
      //   usdcAmount,
      //   publicKey,
      //   signTransaction,
      //   setPurchaseStep,
      // });

      // Step 5 & 6: Buy NFT from Magic Eden

      await buyNftFromMagicEden({
        mintAddress,
        price,
        publicKey,
      });
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
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-green-400 font-bold text-lg">
              <Coins className="w-4 h-4 text-green-400" />
              {usdcPrice !== null ? (
                `$${usdcPrice.toFixed(2)}`
              ) : (
                <span className="text-gray-400">--</span>
              )}
              <span className="text-xs font-normal text-gray-300 ml-1">
                USDC
              </span>
            </div>
            <div className="flex items-center gap-1 text-white font-bold text-base opacity-60 mt-0.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              {price}{" "}
              <span className="text-xs font-normal text-gray-300 ml-1">
                SOL
              </span>
            </div>
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
          className="w-full bg-green-500 text-white font-semibold"
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
          className="w-full border-white/20 text-gray-300 hover:bg-white/10 hover:text-neutral-200"
          onClick={openMagicEden}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View on Magic Eden
        </Button>
      </CardFooter>
    </Card>
  );
}
