import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import {
  PublicKey,
  Connection,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";

const getAddressLookupTableAccounts = async (
  keys: string[],
  connection: Connection
): Promise<AddressLookupTableAccount[]> => {
  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index];
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(
          new Uint8Array(accountInfo.data)
        ),
      });
      acc.push(addressLookupTableAccount);
    }
    return acc;
  }, new Array<AddressLookupTableAccount>());
};

export async function POST(req: NextRequest) {
  try {
    const { buyerAddress, mint } = await req.json();

    if (!buyerAddress || !mint) {
      return NextResponse.json(
        { error: "Missing required parameters: buyerAddress, mint" },
        { status: 400 }
      );
    }

    const buyer = new PublicKey(buyerAddress);

    const endpoint =
      process.env.SOLANA_RPC_URL || "https://api-mainnet.magiceden.dev/v2";
    const connection = new Connection(endpoint, "confirmed");
    const bearerToken = process.env.MAGIC_EDEN_API_KEY;

    if (!bearerToken) {
      console.error("MAGIC_EDEN_API_KEY is not set in environment variables.");
      return NextResponse.json(
        { error: "Server configuration error: Missing API Key" },
        { status: 500 }
      );
    }

    let auctionHouseAddress: string = "";
    let seller: string = "";
    let priceInSol: number = 0;
    let tokenATA: string = "";
    let sellerExpiry: number = -1;

    try {
      const listingResponse = await axios.get(
        `https://api-mainnet.magiceden.dev/v2/tokens/${mint}/listings`,
        { headers: { Accept: "application/json" } }
      );

      if (!listingResponse.data || listingResponse.data.length === 0) {
        return NextResponse.json(
          {
            error: "NFT is not listed for sale or listing data is unavailable.",
          },
          { status: 404 }
        );
      }

      const listingData = listingResponse.data[0];

      auctionHouseAddress = listingData.auctionHouse || "";
      seller = listingData.seller;
      priceInSol = parseFloat(listingData.price);
      tokenATA = listingData.tokenAddress;
      sellerExpiry =
        listingData.expiry !== undefined ? parseInt(listingData.expiry) : -1;

      if (isNaN(priceInSol) || !seller || !tokenATA) {
        console.error("Incomplete critical listing data:", listingData);
        throw new Error(
          "Missing critical NFT listing data (seller, price, tokenAddress from listing)"
        );
      }
    } catch (error: any) {
      console.error(
        "Error fetching/processing NFT listing data:",
        error.response?.data || error.message,
        error
      );
      const detail = error.response?.data?.message || error.message;
      return NextResponse.json(
        { error: `Failed to fetch NFT listing data: ${detail}` },
        { status: 500 }
      );
    }

    try {
      const meApiEndpoint = `https://api-mainnet.magiceden.dev/v2/instructions/buy_now`;

      const params: any = {
        buyer: buyer.toString(),
        seller: seller.toString(),
        auctionHouseAddress: auctionHouseAddress,
        tokenMint: mint,
        tokenATA: tokenATA,
        price: priceInSol.toString(),
      };
      if (sellerExpiry !== -1 && sellerExpiry !== 0) {
        params.sellerExpiry = sellerExpiry;
      }

      const buyIxResponse = await axios.get(meApiEndpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: "application/json",
        },
        params: params,
      });

      if (!buyIxResponse.data?.txSigned?.data) {
        console.error(
          "Invalid response structure from Magic Eden buy_now:",
          buyIxResponse.data
        );
        throw new Error(
          "Magic Eden buy_now did not return a signed transaction component (txSigned.data missing)."
        );
      }

      const meSignedTxData = new Uint8Array(
        Buffer.from(buyIxResponse.data.txSigned.data, "base64")
      );
      const meTransaction = VersionedTransaction.deserialize(meSignedTxData);
      const meMessage = meTransaction.message;

      let addressLookupTableAccounts: AddressLookupTableAccount[] = [];
      if (meMessage.addressTableLookups.length > 0) {
        const lookupTableKeys = meMessage.addressTableLookups.map((lookup) =>
          lookup.accountKey.toBase58()
        );
        addressLookupTableAccounts = await getAddressLookupTableAccounts(
          lookupTableKeys,
          connection
        );
      }

      const decompiledInstructions = TransactionMessage.decompile(meMessage, {
        addressLookupTableAccounts: addressLookupTableAccounts,
      }).instructions;

      const { blockhash } = await connection.getLatestBlockhash();

      const finalMessage = new TransactionMessage({
        payerKey: buyer,
        recentBlockhash: blockhash,
        instructions: decompiledInstructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const finalTransaction = new VersionedTransaction(finalMessage);

      const base64Transaction = Buffer.from(
        finalTransaction.serialize()
      ).toString("base64");

      return NextResponse.json({ transaction: base64Transaction });
    } catch (error: any) {
      console.error(
        "Error getting Magic Eden buy_now instructions:",
        error.response?.status,
        error.response?.data || error.message,
        error.config?.params,
        error
      );
      const statusCode = error.response?.status || 500;
      let errorMessage = "Unknown error processing buy instruction.";
      if (axios.isAxiosError(error) && error.response) {
        errorMessage =
          error.response.data?.message ||
          error.response.data?.error ||
          JSON.stringify(error.response.data) ||
          error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (
        statusCode === 400 &&
        (errorMessage === "Unknown error processing buy instruction." ||
          errorMessage === "{}")
      ) {
        errorMessage = "Bad Request - Check API parameters sent to Magic Eden.";
      }

      return NextResponse.json(
        { error: `Failed to get Magic Eden buy instructions: ${errorMessage}` },
        { status: statusCode }
      );
    }
  } catch (error: any) {
    console.error("Internal Server Error in /api/buy-nft:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
