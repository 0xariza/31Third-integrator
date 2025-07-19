const axios = require("axios");
const ethers = require("ethers");

class ThirtyOneThirdAdapter {
  constructor(apiKey, chainId = "0xa4b1") {
    this.API_KEY = apiKey;
    this.CHAIN_ID = chainId; // Ethereum mainnet by default, passed as hex string
    this.BASE_URL = "https://api.31third.com/0.1";
  }

  async getSwapQuote({
    sellToken,
    buyToken,
    sellAmount,
    taker,
    txOrigin,
    maxSlippageBps = 50,
    maxPriceImpactBps = 10000,
    minExpirySec = 120,
    skipSimulation = false,
    skipChecks = false,
  }) {
    const url = `${this.BASE_URL}/swap/quote`;

    const params = {
      sellToken,
      buyToken,
      sellAmount,
      taker,
      txOrigin,
      maxSlippageBps,
      maxPriceImpactBps,
      minExpirySec,
      skipSimulation,
      skipChecks,
      // encodingType: "enzyme-vault",
    };

    try {
      const response = await axios.get(url, {
        headers: {
          "x-api-key": this.API_KEY,
          "chain-id": this.CHAIN_ID,
        },
        params,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data || error.message;
      console.error("Error fetching swap quote:", errorMessage);
      throw new Error(`31Third API error: ${JSON.stringify(errorMessage)}`);
    }
  }

  /**
   * Execute a swap based on the quote
   * @param {Object} quoteData - The quote data returned from getSwapQuote
   * @returns {Object} - Transaction object ready to be signed and sent
   */
  prepareTransaction(quoteData) {
    if (!quoteData || !quoteData.transaction) {
      throw new Error("Invalid quote data. Missing transaction information.");
    }

    return {
      to: quoteData.transaction.to,
      data: quoteData.transaction.data,
      value: quoteData.transaction.value,
      gasLimit: quoteData.transaction.gasLimit,
      gasPrice: quoteData.transaction.gasPrice,
    };
  }

  /**
   * Check if there are any issues with the quote (balance, allowance)
   * @param {Object} quoteData - The quote data returned from getSwapQuote
   * @returns {Object|null} - Issues object or null if no issues
   */
  checkIssues(quoteData) {
    return quoteData.issues || null;
  }
}

// Example usage
async function swapWithThirtyOneThird() {
  const API_KEY = "6c8e528a-1ed1-497a-a71e-889170cfe52e"; // Request via dev@31third.com
  const CHAIN_ID = "0x1"; // Ethereum mainnet

  const adapter = new ThirtyOneThirdAdapter(API_KEY, CHAIN_ID);
  const fromTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
  const toTokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // USDT
  const amount = ethers.utils.parseUnits("0.00001", 18); // 10 USDT (USDT has 6 decimals)
  const vaultAddress = "0xef816305E54008535E4998014cbba4B9c54B8768"; // Enzyme vault address
  const managerAddress = "0xaE87F9BD09895f1aA21c5023b61EcD85Eba515D1"; // Authorized manager address

  try {
    // Get quote for the swap
    const quoteData = await adapter.getSwapQuote({
      sellToken: fromTokenAddress,
      buyToken: toTokenAddress,
      sellAmount: amount,
      taker: vaultAddress,
      txOrigin: managerAddress,
    });

    console.log("quoteData   ", quoteData);

    const issues = adapter.checkIssues(quoteData);
    if (issues) {
      console.warn("Quote has issues:", issues);
    }

    const transaction = adapter.prepareTransaction(quoteData);

    console.log("transaction data to submit", quoteData.transaction.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Execute the example
swapWithThirtyOneThird();
