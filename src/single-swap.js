const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

// ABI for ERC20 approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

/**
 * Get a swap quote from 31Third API
 */
async function getSwapQuote({
  apiKey,
  sellToken,
  buyToken,
  sellAmount,
  taker,
  txOrigin,
  maxSlippageBps = 500,
  maxPriceImpactBps = 10000,
  minExpirySec = 60,
  skipSimulation = false,
  skipChecks = true,
  encodingType = "basic"
}) {
  const url = "https://api.31third.com/0.1/swap/quote";
  
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
    encodingType
  };
  
  try {
    const response = await axios.get(url, {
      headers: {
        "x-api-key": apiKey,
        "chain-id": "0x1" // Ethereum mainnet
      },
      params
    });
    
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    throw new Error(`31Third API error: ${JSON.stringify(errorMessage)}`);
  }
}

/**
 * Check and set token allowance if needed
 */
async function checkAndSetAllowance(
  provider,
  wallet,
  tokenAddress,
  spenderAddress,
  amount
) {
  console.log(`Checking allowance for ${tokenAddress} to spender ${spenderAddress}`);
  
  // Create contract instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  
  // Check current allowance
  const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
  console.log(`Current allowance: ${currentAllowance.toString()}`);
  
  // If allowance is insufficient, approve
  if (currentAllowance.lt(amount)) {
    console.log(`Setting approval for ${tokenAddress}`);
    
    // Define approval amount - approve a large amount to avoid future approvals
    const approvalAmount = ethers.constants.MaxUint256;
    
    // Create and send approval transaction
    const approveTx = await tokenContract.approve(spenderAddress, approvalAmount, {
      gasLimit: 100000,
      gasPrice: await provider.getGasPrice()
    });
    
    console.log(`Approval transaction sent: ${approveTx.hash}`);
    console.log(`Waiting for approval confirmation...`);
    
    // Wait for confirmation
    const approveReceipt = await approveTx.wait(1);
    console.log(`Approval confirmed in block ${approveReceipt.blockNumber}`);
    
    return true;
  } else {
    console.log(`Token allowance is sufficient`);
    return false;
  }
}

/**
 * Execute a swap with 31Third API
 */
async function swapWithThirtyOneThird() {
  // Load environment variables
  const API_KEY = process.env.API_KEY || "6c8e528a-1ed1-497a-a71e-889170cfe52e"; // Default API key
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL;
  
  if (!PRIVATE_KEY || !RPC_URL) {
    throw new Error("Please set PRIVATE_KEY and RPC_URL in your .env file");
  }
  
  // Create wallet and provider
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`Using wallet address: ${wallet.address}`);
  
  // Token addresses and amount
  const fromTokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // USDT
  const toTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
  const amount = ethers.utils.parseUnits("1", 6); // 10 USDT (USDT has 6 decimals)
  
  console.log("Getting swap quote from 31Third API...");
  
  // Get quote from 31Third API
  const quoteData = await getSwapQuote({
    apiKey: API_KEY,
    sellToken: fromTokenAddress,
    buyToken: toTokenAddress,
    sellAmount: amount,
    taker: wallet.address,
    txOrigin: wallet.address
  });
  
  console.log(`Quote received: ${quoteData.sellToken.symbol} → ${quoteData.buyToken.symbol}`);
  console.log(`Sell amount: ${ethers.utils.formatUnits(quoteData.sellAmount, quoteData.sellToken.decimals)} ${quoteData.sellToken.symbol}`);
  console.log(`Buy amount: ${ethers.utils.formatUnits(quoteData.buyAmount, quoteData.buyToken.decimals)} ${quoteData.buyToken.symbol}`);
  console.log(`Rate: 1 ${quoteData.sellToken.symbol} = ${quoteData.price} ${quoteData.buyToken.symbol}`);
  console.log(`Expires at: ${quoteData.expiresAt}`);
  
  // Check the spender address from the quote
  const spenderAddress = quoteData.transaction.to;
  
  // Check and set allowance if needed
  await checkAndSetAllowance(
    provider,
    wallet,
    fromTokenAddress,
    spenderAddress,
    ethers.BigNumber.from(amount)
  );
  
  // Extract transaction data
  const tx = {
    to: quoteData.transaction.to,
    data: quoteData.transaction.data,
    value: ethers.BigNumber.from(quoteData.transaction.value || "0"), // Convert to BigNumber
    gasPrice: quoteData.transaction.gasPrice ? 
      ethers.BigNumber.from(quoteData.transaction.gasPrice) : 
      await provider.getGasPrice(),
  };
  
  // Use a fixed gas limit since estimation failed
  const gasLimit = ethers.BigNumber.from("500000");
  console.log(`Using fixed gas limit: ${gasLimit.toString()}`);
  
  // Get nonce
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  
  // Prepare transaction for signing
  const transaction = {
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gasLimit: gasLimit,
    gasPrice: tx.gasPrice,
    nonce: nonce,
    chainId: (await provider.getNetwork()).chainId
  };
  
  console.log("Transaction details:");
  console.log(`To: ${transaction.to}`);
  console.log(`Value: ${ethers.utils.formatEther(transaction.value)} ETH`);
  console.log(`Gas Price: ${ethers.utils.formatUnits(transaction.gasPrice, "gwei")} gwei`);
  console.log(`Gas Limit: ${transaction.gasLimit.toString()}`);
  console.log(`Nonce: ${transaction.nonce}`);
  
  try {
    // Sign the transaction
    console.log("Signing transaction...");
    const signedTx = await wallet.signTransaction(transaction);
    console.log("Transaction signed!");
    
    // Send the transaction
    console.log("Sending transaction...");
    const txResponse = await provider.sendTransaction(signedTx);
    console.log(`Transaction sent with hash: ${txResponse.hash}`);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const receipt = await txResponse.wait(1);
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    return receipt;
  } catch (error) {
    console.error("Error with transaction:", error.message);
    
    // If there's an error about gas limit, try again with a higher limit
    if (error.message.includes("gas limit") || error.message.includes("UNPREDICTABLE_GAS_LIMIT")) {
      console.log("Trying with higher gas limit...");
      transaction.gasLimit = ethers.BigNumber.from("750000");
      
      const signedTx = await wallet.signTransaction(transaction);
      const txResponse = await provider.sendTransaction(signedTx);
      console.log(`Transaction sent with hash: ${txResponse.hash}`);
      
      const receipt = await txResponse.wait(1);
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      return receipt;
    }
    
    throw error;
  }
}

// Execute the script
swapWithThirtyOneThird()
  .then(() => {
    console.log("✅ Swap completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error executing swap:", error.message);
    process.exit(1);
  });