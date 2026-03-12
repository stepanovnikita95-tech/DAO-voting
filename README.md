# DAO Voting with OpenZeppelin Governor

[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.30-black?logo=solidity)](https://docs.soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-orange)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Foundry%20tests-%E2%9C%94%EF%B8%8F-brightgreen)](https://book.getfoundry.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests & Coverage](https://github.com/stepanovnikita95-tech/DAO-voting/actions/workflows/test.yml/badge.svg)](https://github.com/stepanovnikita95-tech/DAO-voting/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/stepanovnikita95-tech/DAO-voting/branch/main/graph/badge.svg)](https://codecov.io/gh/stepanovnikita95-tech/DAO-voting)
[![Foundry Tests](https://github.com/stepanovnikita95-tech/DAO-voting/actions/workflows/forge-test.yml/badge.svg)](https://github.com/stepanovnikita95-tech/DAO-voting/actions/workflows/forge-test.yml)


**Fully tested DAO governance system** built with OpenZeppelin Governor + Timelock + ERC20Votes.

This project implements a complete decentralized autonomous organization (DAO) with on-chain voting, proposal lifecycle, timelock delay, quorum requirements, and protection against common attacks (flash-loan, double-voting, etc.).

## Features

- **ERC20Votes token** (DAOToken) — governance token with checkpointed voting power
- **Governor** — voting logic with configurable delay, period, threshold & quorum
- **TimelockController** — delay before execution (security feature)
- Full proposal lifecycle: **propose → vote → queue → execute**
- Access control: only Governor can queue/execute
- Protection checks: flash-loan resistance, reentrancy, double-voting
- **90%+ test coverage** — unit, integration, fuzzing, invariants & end-to-end tests
- CI/CD with GitHub Actions + Codecov badge

## Tech Stack

- Solidity ^0.8.30
- OpenZeppelin Contracts ^5.0
- Hardhat + TypeChain + Chai
- Solidity Coverage
- GitHub Actions + Codecov
- Foundry Tests (fuzzing, invariants)

## Deployment

→ GoverToken deployed to: 0xB82A5a934632b7edB582796a0D54c7A0D96a5Da2
Contract verification:
https://repo.sourcify.dev/contracts/full_match/11155111/0xB82A5a934632b7edB582796a0D54c7A0D96a5Da2/

→ TimeLock deployed to: 0x70F78ba3C0F28499CF36abC873e69cCA80eC1a8C
Contract verification: 
https://repo.sourcify.dev/contracts/full_match/11155111/0x70F78ba3C0F28499CF36abC873e69cCA80eC1a8C/

→ Governance deployed to: 0xC50a67a90f41f3d3aD1E78B99062Da50E0FE54b8
Contract verification:
https://repo.sourcify.dev/contracts/partial_match/11155111/0xC50a67a90f41f3d3aD1E78B99062Da50E0FE54b8/

→ Star deployed to: 
0x9cc04CEe3724A232Cd8eE87404Bf58Aa43271E81
Contract verification: 
https://repo.sourcify.dev/contracts/full_match/11155111/0x9cc04CEe3724A232Cd8eE87404Bf58Aa43271E81/

## Tests Coverage

- Deployment & initialization
- Proposal creation / cancellation
- Voting (For / Against / Abstain)
- Quorum & majority checks
- Timelock delay & execution
- Access control (only Governor can queue/execute)
- Flash-loan protection
- Reentrancy & double-voting protection
- Fuzzing, invariants

## Security Considerations

- Uses audited OpenZeppelin Contracts v5.0
- Timelock delay protects from instant malicious proposals
- Voting power snapshot prevents flash-loan attacks
- Access control via roles (PROPOSER_ROLE, EXECUTOR_ROLE)



## Installation & Local Setup

```bash
# Hardhat
git clone https://github.com/stepanovnikita95-tech/DAO-voting.git
cd DAO-voting
npm install
npx hardhat test

# Foundry (in root foundry-dao-voting)
forge test -vvv
