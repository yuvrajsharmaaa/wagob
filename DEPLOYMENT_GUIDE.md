# 🚀 WajoB Smart Contracts - Deployment Guide

## ✅ Build Status

All contracts compiled successfully with TON FunC compiler v0.4.6:

### JobRegistry
- **Hash**: `3d7e686cc28739d6704f890e22b9f46839dfdc980de4a24a96ecb77527a7e9b3`
- **Size**: 619 bytes
- **Status**: ✅ Ready for deployment

### Escrow  
- **Hash**: `05c7ba6e559ce65d5e07a84e2cc9b0ead9c7fe615d351954f8e6c5e36cd32b1e`
- **Size**: 1211 bytes
- **Status**: ✅ Ready for deployment

### Reputation
- **Hash**: `fec42b85f11b80feafdcaafaddee64d9359dd45366db0b6fd1037074dc099429`
- **Size**: 553 bytes
- **Status**: ✅ Ready for deployment

---

## 📦 Prerequisites

```bash
# Already installed in this project:
npm install -D @ton/blueprint @ton/core @ton/crypto
```

---

## 🔨 Build Contracts

Build all contracts:
```bash
cd /home/yuvrajs/Desktop/wagob/contract

# Build individually
npx blueprint build DeployJobRegistry
npx blueprint build DeployEscrow
npx blueprint build DeployReputation

# Or build interactively
npx blueprint build
```

Compiled artifacts are saved to `/build/*.compiled.json`

---

## 🧪 Test Contracts (Recommended Before Deployment)

Create unit tests first:

```bash
npx blueprint test
```

Test files to create:
- `/tests/DeployJobRegistry.spec.ts`
- `/tests/DeployEscrow.spec.ts`
- `/tests/DeployReputation.spec.ts`

---

## 🌐 Deploy to Testnet

### 1. Deploy JobRegistry

```bash
cd /home/yuvrajs/Desktop/wagob/contract
npx blueprint run deployDeployJobRegistry --testnet
```

**What happens:**
1. Prompts for wallet (TON Connect or mnemonics)
2. Initializes contract with your address as owner
3. Deploys to TON testnet
4. Verifies deployment by calling `get_job_count()`

**Expected output:**
```
JobRegistry deployed at: EQ...
Owner: EQ...
Initial job count: 0
```

### 2. Deploy Escrow

```bash
npx blueprint run deployDeployEscrow --testnet
```

**Configuration:**
- Owner: Your wallet address
- Platform fee: 2.5% (250 basis points)

**Expected output:**
```
Escrow deployed at: EQ...
Owner: EQ...
Platform fee: 2.5%
Initial escrow count: 0
Fee (basis points): 250
```

### 3. Deploy Reputation

```bash
npx blueprint run deployDeployReputation --testnet
```

**Expected output:**
```
Reputation deployed at: EQ...
Owner: EQ...
Initial rating count: 0
```

---

## 🎯 Deploy to Mainnet

**⚠️ IMPORTANT: Test thoroughly on testnet first!**

### Checklist Before Mainnet:
- [ ] All unit tests passing
- [ ] Integration tests completed on testnet
- [ ] Contracts audited (recommended)
- [ ] Wallet has sufficient TON for gas (~0.5 TON recommended)

### Deploy Commands:

```bash
# JobRegistry
npx blueprint run deployDeployJobRegistry --mainnet

# Escrow
npx blueprint run deployDeployEscrow --mainnet

# Reputation
npx blueprint run deployDeployReputation --mainnet
```

---

## 📝 Post-Deployment

### Save Contract Addresses

After deployment, save the addresses to a config file:

```json
{
  "testnet": {
    "jobRegistry": "EQ...",
    "escrow": "EQ...",
    "reputation": "EQ..."
  },
  "mainnet": {
    "jobRegistry": "EQ...",
    "escrow": "EQ...",
    "reputation": "EQ..."
  }
}
```

### Verify Deployment

```typescript
// Test JobRegistry
const jobCount = await jobRegistry.getJobCount();
console.log('Jobs:', jobCount); // Should be 0

// Test Escrow
const escrowCount = await escrow.getEscrowCount();
const fee = await escrow.getFeeBps();
console.log('Escrows:', escrowCount); // Should be 0
console.log('Fee:', fee); // Should be 250

// Test Reputation
const ratingCount = await reputation.getRatingCount();
console.log('Ratings:', ratingCount); // Should be 0
```

---

## 🔄 Integration with Frontend

Update React app with deployed contract addresses:

```javascript
// src/config/contracts.js
export const CONTRACTS = {
  jobRegistry: Address.parse('EQ...'),
  escrow: Address.parse('EQ...'),
  reputation: Address.parse('EQ...')
};
```

---

## 📊 Monitoring

### Check Contract Balance
```bash
# Using TON CLI
ton-cli account <contract_address>

# Or use TON Explorer
# Testnet: https://testnet.tonscan.org/address/<address>
# Mainnet: https://tonscan.org/address/<address>
```

### View Transactions
```bash
# TON Explorer shows all transactions
# Can filter by method calls, gas usage, etc.
```

---

## 🔐 Security Notes

1. **Owner Key Management**
   - Store owner wallet mnemonics securely
   - Consider using hardware wallet for mainnet
   - Never commit private keys to Git

2. **Contract Immutability**
   - These contracts are immutable once deployed
   - Cannot upgrade logic after deployment
   - To update, must deploy new contracts and migrate

3. **Gas Reserves**
   - Keep ~0.1 TON in each contract for rent
   - Contracts pay storage fees over time
   - Monitor balances to prevent freezing

---

## 🛠 Troubleshooting

### "Could not determine executable to run"
- **Solution**: Run commands from `/contract` directory, not root

### "Insufficient funds"
- **Solution**: Fund wallet with TON before deployment
  - Testnet: Use testnet faucet
  - Mainnet: Send TON from exchange/wallet

### "Compilation error"
- **Solution**: 
  ```bash
  # Clean and rebuild
  rm -rf build/
  npx blueprint build
  ```

### "Deployment timeout"
- **Solution**: 
  - Check network connection
  - Verify wallet has funds
  - Try again with higher gas value

---

## 📚 Resources

- **TON Docs**: https://docs.ton.org
- **Blueprint**: https://github.com/ton-org/blueprint
- **TON Explorer (Testnet)**: https://testnet.tonscan.org
- **TON Explorer (Mainnet)**: https://tonscan.org
- **TON Faucet (Testnet)**: https://t.me/testgiver_ton_bot

---

## 🎓 Next Steps

1. ✅ Contracts built successfully
2. ⏳ **Write unit tests** (recommended next)
3. ⏳ Deploy to testnet
4. ⏳ Integration test full job lifecycle
5. ⏳ Update frontend with contract addresses
6. ⏳ Audit contracts (for mainnet)
7. ⏳ Deploy to mainnet

---

**Built with ❤️ using TON Blueprint**  
**FunC Compiler**: v0.4.6  
**Network**: TON Blockchain
