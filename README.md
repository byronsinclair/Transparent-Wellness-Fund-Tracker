# 🌿 Transparent Wellness Fund Tracker

Welcome to a revolutionary Web3 solution for ensuring transparency and accountability in community health programs! This project uses the Stacks blockchain and Clarity smart contracts to track wellness funds, allowing donors, communities, and auditors to monitor contributions, proposals, and disbursements in real-time. It solves the real-world problem of opacity in charitable fund management, where mismanagement or corruption often erodes trust in health initiatives like vaccination drives, mental health support, or fitness programs.

By leveraging blockchain's immutability, all transactions are verifiable, preventing fraud and building donor confidence. Funds are locked until community-approved, ensuring every penny goes toward genuine wellness efforts.

## ✨ Features

🔒 Secure fund creation and contribution tracking  
💰 Transparent donation logging with immutable records  
📜 Proposal submission for fund usage (e.g., buying equipment or hiring trainers)  
🗳️ Community voting on proposals to ensure democratic decisions  
💸 Automated disbursements only after approval thresholds are met  
📊 Real-time auditing and reporting tools  
🚫 Anti-fraud mechanisms like duplicate prevention and role-based access  
🔍 Public verification of fund status and history  
📈 Custom token for rewards (e.g., incentivizing participation)  
🛡️ Compliance checks for health program guidelines

## 🛠 How It Works

This project consists of 8 interconnected Clarity smart contracts that handle different aspects of fund management. Here's a high-level overview:

1. **FundRegistry.clar**: Central registry for creating and listing wellness funds. It ensures unique fund IDs and prevents duplicates.
2. **WellnessFund.clar**: Manages individual fund balances, accepts contributions (in STX or custom tokens), and tracks total raised.
3. **ProposalManager.clar**: Allows authorized users to submit proposals for fund usage, including details like amount, purpose, and beneficiaries.
4. **VotingSystem.clar**: Handles voting on proposals using token-weighted or one-vote-per-member systems, with time-bound sessions.
5. **DisbursementEngine.clar**: Executes payouts to approved recipients only after a proposal passes voting and meets quorum.
6. **AuditLogger.clar**: Logs all actions (contributions, votes, disbursements) in an immutable ledger for auditing.
7. **GovernanceToken.clar**: Issues and manages a custom SIP-010 fungible token for governance, rewards, and staking in funds.
8. **BeneficiaryRegistry.clar**: Registers and verifies beneficiaries (e.g., health clinics or individuals) to ensure funds reach legitimate parties.

**For Donors**  
- Connect your wallet and select a fund via the FundRegistry.  
- Call the contribute function in WellnessFund with your donation amount.  
- Receive governance tokens as a reward for participation.  

Your contribution is logged instantly in AuditLogger, and you can verify it anytime.

**For Community Members/Admins**  
- Propose fund usage via ProposalManager (e.g., "Allocate 500 STX for yoga classes").  
- Vote on proposals using VotingSystem—your governance tokens give weight to your vote.  
- Once approved, DisbursementEngine handles the payout to registered beneficiaries in BeneficiaryRegistry.  

All steps are transparent and auditable.

**For Auditors/Verifiers**  
- Query AuditLogger for transaction history.  
- Use FundRegistry to list all active funds and their status.  
- Verify proposal outcomes and disbursements without needing permission.  

This ensures full accountability—no hidden fees or misallocations.

## 🚀 Getting Started

1. Set up your Stacks development environment with Clarinet.  
2. Deploy the contracts in order: Start with FundRegistry, then link the others (e.g., WellnessFund references the registry).  
3. Test interactions: Simulate donations, proposals, votes, and audits.  
4. Integrate with a frontend (e.g., React + Hiro Wallet) for user-friendly access.  

## 📝 Smart Contract Details

Each contract is written in Clarity for security and predictability. Key functions include:  
- `register-fund` (FundRegistry): Creates a new fund with metadata like program name and goal.  
- `contribute` (WellnessFund): Adds funds and mints governance tokens.  
- `submit-proposal` (ProposalManager): Stores proposal details with a unique hash.  
- `vote-on-proposal` (VotingSystem): Records votes and checks for majority.  
- `disburse-funds` (DisbursementEngine): Transfers approved amounts.  
- `log-action` (AuditLogger): Appends events to the chain.  
- `mint-tokens` (GovernanceToken): Issues tokens for incentives.  
- `register-beneficiary` (BeneficiaryRegistry): Adds verified recipients with proof (e.g., hash of ID).  

Contracts interact via traits for modularity (e.g., WellnessFund implements a fund-trait used by ProposalManager).

## 🔮 Future Enhancements

- Integration with oracles for off-chain health impact verification (e.g., program completion proofs).  
- Multi-sig approvals for high-value disbursements.  
- Cross-chain bridges for broader donation sources.  

This project empowers communities to run health programs with trust and efficiency—join the movement! 🚀