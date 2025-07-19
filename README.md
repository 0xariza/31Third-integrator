 # 31Third SDK

A comprehensive JavaScript SDK for interacting with the 31Third API, providing advanced DeFi trading capabilities including single token swaps, basket swaps, and wallet rebalancing.

## Overview

The 31Third SDK enables seamless integration with the 31Third protocol, offering:
- **Single Token Swaps**: Execute direct token-to-token swaps with optimal routing
- **Basket Swaps**: Perform complex multi-token operations and portfolio rebalancing
- **Enzyme Integration**: Specialized adapter for Enzyme vault operations
- **Automatic Allowance Management**: Handles token approvals automatically
- **Gas Optimization**: Built-in gas estimation and optimization

## Features

- 🔄 **Single Token Swaps**: Direct token exchanges with best execution
- 📊 **Basket Swaps**: Multi-token portfolio rebalancing
- 🏦 **Enzyme Vault Support**: Specialized integration for Enzyme protocol
- ⚡ **Automatic Approvals**: Seamless token allowance management
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- 📈 **Quote Management**: Real-time pricing and slippage protection
- 🔧 **Configurable Parameters**: Customizable slippage, price impact, and gas settings

## Installation

1. Clone the repository and navigate to the 31Third directory:
```bash
cd 31Third
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```bash
cp ../env.example .env
```

4. Configure your environment variables:
```env
API_KEY=your_31third_api_key
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_ethereum_rpc_url
```

## Dependencies

- **ethers**: ^5.7.2 - Ethereum library for wallet and contract interactions
- **axios**: ^1.9.0 - HTTP client for API requests
- **dotenv**: ^16.5.0 - Environment variable management

## Usage

### Single Token Swaps

Execute direct token-to-token swaps with optimal routing:

```javascript
const { swapWithThirtyOneThird } = require('./src/single-swap');

// Example: Swap USDT to WETH
async function example() {
  try {
    await swapWithThirtyOneThird();
  } catch (error) {
    console.error('Swap failed:', error.message);
  }
}
```

**Configuration Options:**
- `sellToken`: Address of token to sell
- `buyToken`: Address of token to buy
- `sellAmount`: Amount to sell (in wei)
- `maxSlippageBps`: Maximum slippage tolerance (default: 500 bps = 5%)
- `maxPriceImpactBps`: Maximum price impact (default: 10000 bps = 100%)

### Basket Swaps

Perform complex multi-token portfolio rebalancing:

```javascript
const { executeWalletRebalancing } = require('./src/basket-swap');

// Example: Rebalance portfolio from GRT/USDT to target allocation
async function example() {
  try {
    await executeWalletRebalancing();
  } catch (error) {
    console.error('Rebalancing failed:', error.message);
  }
}
```

**Configuration Options:**
- `baseEntries`: Current token holdings to rebalance
- `targetEntries`: Target allocation percentages
- `maxDeviationFromTarget`: Maximum deviation tolerance (default: 0.5%)
- `maxSlippage`: Maximum slippage per trade (default: 1%)
- `maxPriceImpact`: Maximum price impact per trade (default: 5%)

### Enzyme Integration

Specialized adapter for Enzyme vault operations:

```javascript
const { ThirtyOneThirdAdapter } = require('./src/enzyme_calldata');

const adapter = new ThirtyOneThirdAdapter(API_KEY, CHAIN_ID);

// Get swap quote for Enzyme vault
const quoteData = await adapter.getSwapQuote({
  sellToken: fromTokenAddress,
  buyToken: toTokenAddress,
  sellAmount: amount,
  taker: vaultAddress,
  txOrigin: managerAddress,
});

// Prepare transaction for vault execution
const transaction = adapter.prepareTransaction(quoteData);
```

## API Reference

### Single Swap Functions

#### `getSwapQuote(options)`
Get a swap quote from 31Third API.

**Parameters:**
- `apiKey` (string): Your 31Third API key
- `sellToken` (string): Token address to sell
- `buyToken` (string): Token address to buy
- `sellAmount` (string): Amount to sell in wei
- `taker` (string): Address executing the swap
- `txOrigin` (string): Transaction origin address
- `maxSlippageBps` (number): Maximum slippage in basis points
- `maxPriceImpactBps` (number): Maximum price impact in basis points
- `minExpirySec` (number): Minimum quote expiry time
- `skipSimulation` (boolean): Skip transaction simulation
- `skipChecks` (boolean): Skip validation checks
- `encodingType` (string): Transaction encoding type

#### `checkAndSetAllowance(provider, wallet, tokenAddress, spenderAddress, amount)`
Check and set token allowance if needed.

### Basket Swap Functions

#### `requestWalletRebalancing(options)`
Request wallet rebalancing from 31Third API.

**Parameters:**
- `apiKey` (string): Your 31Third API key
- `signer` (string): Signer address
- `wallet` (string): Wallet address to rebalance
- `baseEntries` (array): Current token holdings
- `targetEntries` (array): Target allocation percentages
- `maxDeviationFromTarget` (number): Maximum deviation tolerance
- `maxSlippage` (number): Maximum slippage per trade
- `maxPriceImpact` (number): Maximum price impact per trade
- `batchTrade` (boolean): Execute as batch trade
- `revertOnError` (boolean): Revert on any trade failure
- `skipBalanceValidation` (boolean): Skip balance validation
- `failOnMissingPricePair` (boolean): Fail if price pair missing
- `async` (boolean): Execute asynchronously

#### `handleRequiredAllowances(provider, wallet, requiredAllowances)`
Handle all required token allowances for a rebalancing operation.

### Enzyme Adapter

#### `ThirtyOneThirdAdapter`
Class for Enzyme vault integration.

**Methods:**
- `getSwapQuote(options)`: Get swap quote for vault
- `prepareTransaction(quoteData)`: Prepare transaction for execution
- `checkIssues(quoteData)`: Check for any issues with quote

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
API_KEY=your_31third_api_key
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_ethereum_rpc_url

# Optional (with defaults)
CHAIN_ID=0x1  # Ethereum mainnet
```

### Supported Networks

- **Ethereum Mainnet**: `0x1`
- **Arbitrum One**: `0xa4b1`
- **Polygon**: `0x89`
- **Optimism**: `0xa`

## Error Handling

The SDK includes comprehensive error handling:

- **API Errors**: Network and API response errors
- **Transaction Errors**: Gas estimation and transaction failures
- **Allowance Errors**: Token approval failures
- **Validation Errors**: Parameter validation and balance checks

## Examples

### Basic Single Swap

```javascript
const { swapWithThirtyOneThird } = require('./src/single-swap');

// Swap 1 USDT for WETH
async function swapUSDTtoWETH() {
  try {
    await swapWithThirtyOneThird();
    console.log('Swap completed successfully!');
  } catch (error) {
    console.error('Swap failed:', error.message);
  }
}
```

### Portfolio Rebalancing

```javascript
const { executeWalletRebalancing } = require('./src/basket-swap');

// Rebalance portfolio to 60% ETH, 30% USDC, 10% USDT
async function rebalancePortfolio() {
  try {
    await executeWalletRebalancing();
    console.log('Portfolio rebalanced successfully!');
  } catch (error) {
    console.error('Rebalancing failed:', error.message);
  }
}
```

### Enzyme Vault Integration

```javascript
const { ThirtyOneThirdAdapter } = require('./src/enzyme_calldata');

async function vaultSwap() {
  const adapter = new ThirtyOneThirdAdapter(API_KEY, CHAIN_ID);
  
  const quoteData = await adapter.getSwapQuote({
    sellToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    buyToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    sellAmount: ethers.utils.parseUnits("0.1", 18),
    taker: vaultAddress,
    txOrigin: managerAddress,
  });
  
  const transaction = adapter.prepareTransaction(quoteData);
  console.log('Transaction ready for vault execution:', transaction);
}
```

## Security Considerations

- **Private Key Management**: Never commit private keys to version control
- **API Key Security**: Keep your API key secure and rotate regularly
- **Network Security**: Use secure RPC endpoints
- **Transaction Validation**: Always review transaction details before signing
- **Slippage Protection**: Set appropriate slippage limits to prevent MEV attacks

## Troubleshooting

### Common Issues

1. **Insufficient Balance**: Ensure wallet has sufficient token balance
2. **Allowance Issues**: Check if tokens are approved for the spender
3. **Gas Estimation Failures**: Try using fixed gas limits for complex transactions
4. **API Rate Limits**: Respect API rate limits and implement retry logic
5. **Network Congestion**: Adjust gas prices during high network usage

### Debug Mode

Enable detailed logging by setting environment variables:

```env
DEBUG=true
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- **Documentation**: Check the 31Third API documentation
- **Issues**: Open an issue on GitHub
- **Email**: Contact dev@31third.com for API access and support

## Changelog

### v1.0.0
- Initial release
- Single token swap functionality
- Basket swap and rebalancing
- Enzyme vault integration
- Automatic allowance management
- Comprehensive error handling