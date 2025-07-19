const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

// ABI for ERC20 approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

/**
 * Request a wallet rebalancing from 31Third API
 */
async function requestWalletRebalancing({
  apiKey,
  signer,
  wallet,
  baseEntries,
  targetEntries,
  maxDeviationFromTarget = 0.005,
  maxSlippage = 0.01,
  maxPriceImpact = 0.05,
  batchTrade = true,
  revertOnError = true,
  skipBalanceValidation = false,
  failOnMissingPricePair = true,
  async = false
}) {
  const url = "https://api.31third.com/0.1/rebalancing/wallet";
  
  const requestBody = {
    signer,
    wallet,
    baseEntries,
    targetEntries,
    maxDeviationFromTarget,
    maxSlippage,
    maxPriceImpact,
    batchTrade,
    revertOnError,
    skipBalanceValidation,
    failOnMissingPricePair,
    async
  };
  
  console.log("API Request Body:", JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        "x-api-key": apiKey,
        "chain-id": "0x1", // Ethereum mainnet
        "Content-Type": "application/json"
      }
    });
    
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    throw new Error(`31Third API error: ${JSON.stringify(errorMessage)}`);
  }
}

/**
 * Check token balance
 */
async function getTokenBalance(provider, tokenAddress, walletAddress) {
  // Create contract instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  // Get token details
  const balance = await tokenContract.balanceOf(walletAddress);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  
  return {
    address: tokenAddress,
    balance,
    decimals,
    symbol,
    formattedBalance: ethers.utils.formatUnits(balance, decimals)
  };
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
 * Check and approve all required tokens based on required allowances in the API response
 */
async function handleRequiredAllowances(provider, wallet, requiredAllowances) {
    console.log("Checking and setting required allowances...");
    
    if (!requiredAllowances || requiredAllowances.length === 0) {
      console.log("No token allowances required");
      return;
    }
  
    console.log("Required allowances:", JSON.stringify(requiredAllowances, null, 2));
    
    const approvalPromises = requiredAllowances.map(async (allowance) => {
      // Extract the correct properties from the allowance object
      const tokenAddress = allowance.token.address;
      const spenderAddress = allowance.allowanceTarget;
      const neededAllowance = allowance.neededAllowance;
      
      if (!tokenAddress || !spenderAddress || !neededAllowance) {
        console.error(`Missing required allowance data: `, JSON.stringify(allowance, null, 2));
        throw new Error("Incomplete allowance data");
      }
      
      console.log(`Setting allowance for ${allowance.token.symbol}: ${neededAllowance}`);
      
      return checkAndSetAllowance(
        provider,
        wallet,
        tokenAddress,
        spenderAddress,
        ethers.BigNumber.from(neededAllowance)
      );
    });
    
    await Promise.all(approvalPromises);
    console.log("All required token approvals completed");
  }
/**
 * Execute a wallet rebalancing with 31Third API
 */
async function executeWalletRebalancing() {
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
  
  // Define tokens to sell (base entries)
  const baseEntries = [
    {
      tokenAddress: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7", // GRT (The Graph)
      amount: ethers.utils.parseUnits("2", 18).toString() // 6 GRT (18 decimals)
    },
    {
      tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      amount: ethers.utils.parseUnits("0.2", 6).toString() // 0.68 USDT (6 decimals)
    }
  ];
  
  // Define tokens to buy (target entries with percentage allocations)
  const targetEntries = [
    {
      tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      allocation: 0.5 // 50%
    },
    {
      tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      allocation: 0.5 // 50%
    }
  ];
  
  console.log("Requesting wallet rebalancing from 31Third API...");
  
  // Request rebalancing from 31Third API
  const rebalancingData = await requestWalletRebalancing({
    apiKey: API_KEY,
    signer: wallet.address,
    wallet: wallet.address,
    baseEntries,
    targetEntries,
    maxSlippage: 0.01, // 1%
    maxPriceImpact: 0.05, // 5%
    batchTrade: true
  });
  
  // Log the response for debugging
  console.log("\nAPI Response Data:", JSON.stringify(rebalancingData, null, 2));
  
  // Display rebalancing plan summary
  console.log("\n======= Rebalancing Plan Summary =======");
  console.log(`Transaction ID: ${rebalancingData.id || 'N/A'}`);
  console.log(`Sell Value (USD): $${rebalancingData.sellValueInUsd || 'N/A'}`);
  console.log(`Estimated Value Loss (USD): $${rebalancingData.estimatedValueLossInUsd || 'N/A'}`);
  console.log(`Estimated Receive Value (USD): $${rebalancingData.estimatedReceiveValueInUsd || 'N/A'}`);
  console.log(`Min Receive Value (USD): $${rebalancingData.minReceiveValueInUsd || 'N/A'}`);
  console.log(`Estimated Gas Fees: ${rebalancingData.estimatedGasFees ? 
    ethers.utils.formatEther(rebalancingData.estimatedGasFees) + ' ETH' : 'N/A'}`);
  console.log(`Estimated Gas Fees (USD): $${rebalancingData.estimatedGasFeesInUsd || 'N/A'}`);
  console.log(`Estimated Protocol Fees (USD): $${rebalancingData.estimatedProtocolFeesInUsd || 'N/A'}`);
  console.log(`Expiration: ${rebalancingData.expirationTimestamp || 'N/A'}`);
  console.log(`Executable: ${rebalancingData.executable === true ? 'Yes' : 'No'}`);
  
  // Check if any tokens don't have price pairs
  if (rebalancingData.tokensWithoutPricePair && rebalancingData.tokensWithoutPricePair.length > 0) {
    console.log("\n⚠️ Warning: The following tokens do not have price pairs:");
    rebalancingData.tokensWithoutPricePair.forEach(token => {
      console.log(`- ${token}`);
    });
  }
  
  // Display trades information
  if (rebalancingData.trades && Array.isArray(rebalancingData.trades) && rebalancingData.trades.length > 0) {
    console.log("\n======= Trades to Execute =======");
    rebalancingData.trades.forEach((trade, index) => {
      console.log(`\nTrade ${index + 1}:`);
      
      try {
        // Create a more detailed trade summary using available information
        if (trade.sellToken) {
          console.log(`  Sell Token: ${trade.sellToken.symbol || 'Unknown'} (${trade.sellToken.address || 'N/A'})`);
          console.log(`  Sell Amount: ${trade.sellAmount ? 
            ethers.utils.formatUnits(trade.sellAmount, trade.sellToken.decimals || 18) : 'N/A'}`);
        } else if (trade.sellTokenAddress) {
          console.log(`  Sell Token Address: ${trade.sellTokenAddress}`);
          console.log(`  Sell Amount: ${trade.sellAmount || 'N/A'}`);
        }
        
        if (trade.buyToken) {
          console.log(`  Buy Token: ${trade.buyToken.symbol || 'Unknown'} (${trade.buyToken.address || 'N/A'})`);
          console.log(`  Buy Amount: ${trade.buyAmount ? 
            ethers.utils.formatUnits(trade.buyAmount, trade.buyToken.decimals || 18) : 'N/A'}`);
        } else if (trade.buyTokenAddress) {
          console.log(`  Buy Token Address: ${trade.buyTokenAddress}`);
          console.log(`  Buy Amount: ${trade.buyAmount || 'N/A'}`);
        }
        
        if (trade.price) {
          console.log(`  Rate: ${trade.price}`);
        }
        
        // If individual trade transaction data is available
        if (trade.txHandler) {
          console.log(`  Transaction Handler: ${trade.txHandler}`);
        }
      } catch (error) {
        console.log(`  Error formatting trade ${index + 1}: ${error.message}`);
        console.log(`  Raw trade data: ${JSON.stringify(trade, null, 2)}`);
      }
    });
  } else {
    console.log("\nNo trades data in the API response.");
  }
  
  // Check if the transaction data is available for batch trade
  if (!rebalancingData.txHandler || !rebalancingData.txData) {
    console.log("\n⚠️ No valid transaction data in the API response. Cannot execute the swap.");
    return;
  }
  
  // Handle required allowances
  await handleRequiredAllowances(provider, wallet, rebalancingData.requiredAllowances);
  
  // Extract transaction data
  const tx = {
    to: rebalancingData.txHandler,
    data: rebalancingData.txData,
    value: rebalancingData.txValue ? 
      ethers.BigNumber.from(rebalancingData.txValue) : 
      ethers.BigNumber.from("0"),
    gasPrice: await provider.getGasPrice(),
  };
  
  // Estimate gas limit or use a safe default
  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      from: wallet.address,
      to: tx.to,
      data: tx.data,
      value: tx.value
    });
    // Add 20% buffer to gas estimate
    gasLimit = gasLimit.mul(120).div(100);
  } catch (error) {
    console.warn("Gas estimation failed, using default gas limit:", error.message);
    gasLimit = ethers.BigNumber.from("3000000"); // Higher gas limit for batch transactions
  }
  
  console.log(`\nEstimated gas limit: ${gasLimit.toString()}`);
  
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
  
  console.log("\nTransaction details:");
  console.log(`To: ${transaction.to}`);
  console.log(`Value: ${ethers.utils.formatEther(transaction.value)} ETH`);
  console.log(`Gas Price: ${ethers.utils.formatUnits(transaction.gasPrice, "gwei")} gwei`);
  console.log(`Gas Limit: ${transaction.gasLimit.toString()}`);
  console.log(`Nonce: ${transaction.nonce}`);
  
  // Confirm transaction execution
  console.log("\n⚠️ Ready to execute the transaction. Do you want to proceed? (y/n)");
  // In a real application, you would wait for user input here
  // For this script, we'll assume 'y' and proceed
  
  try {
    // Sign the transaction
    console.log("\nSigning transaction...");
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
      transaction.gasLimit = transaction.gasLimit.mul(150).div(100); // Increase by 50%
      
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

/**
 * Check token balances before and after rebalancing
 */
async function checkBalances(provider, walletAddress, tokens) {
  console.log("\nChecking token balances...");
  
  const balancePromises = tokens.map(token => 
    getTokenBalance(provider, token, walletAddress)
  );
  
  const balances = await Promise.all(balancePromises);
  
  balances.forEach(tokenData => {
    console.log(`${tokenData.symbol}: ${tokenData.formattedBalance}`);
  });
  
  return balances;
}

// Main function to execute the entire process
async function main() {
  // Load environment variables
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL;
  
  if (!PRIVATE_KEY || !RPC_URL) {
    throw new Error("Please set PRIVATE_KEY and RPC_URL in your .env file");
  }
  
  // Create wallet and provider
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Token addresses to track
  const tokens = [
    "0xc944E90C64B2c07662A292be6244BDf05Cda44a7", // GRT (The Graph)
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  // USDC
  ];
  
  // Check balances before rebalancing
  console.log("Balances before rebalancing:");
  await checkBalances(provider, wallet.address, tokens);
  
  // Execute the rebalancing
  await executeWalletRebalancing();
  
  // Check balances after rebalancing
  console.log("\nBalances after rebalancing:");
  await checkBalances(provider, wallet.address, tokens);
}

// Execute the script
main()
  .then(() => {
    console.log("✅ Wallet rebalancing completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error executing wallet rebalancing:", error.message);
    process.exit(1);
  });