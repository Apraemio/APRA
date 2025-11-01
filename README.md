
# Apraemio $APRA token

$APRA is the token of the Apraemio project. This repository contains the source code of the token and the vesting contract among some distribution related technical contracts. Initial deployment is on Binance chain.

# Specifications

## Project Overview

$APRA is coded in Solidity and is a BEP20 (ERC20) based token. The OpenZeppelin base contract is extended with simple logic to implement a fee on transfers and add safer methods to modify allowances.

The TimeLock contract implements the vesting logic described in the whitepaper: 60% of token purchases are locked in the vesting contract until the start of the ICO (CEX listing). After that 10% of the original purchase can be withdrawn at the end of every month (30 days) thus releasing the whole amount during a 6 months cooldown period. In case a wallet associated with a lock would be compromised it is possible to transfer the lock to another wallet.

The PRPLock contract implements the Priority Redemption Program locking. It locks funds for a year. One user can have several locks. In case a wallet associated with a lock would be compromised it is possible to transfer the lock to another wallet. A lock can be broken before expiration with admin confirmation.

# Functional Requirements

## Features

The $APRA token contract (APRA.sol) has the following functions:

- Upon deployment:
  - Total supply of tokens is minted to the funds wallet (*wallet parameter*).
  - Deployer addres becomes the owner (Admin)
  - ERC20 (BEP20) standard fields are set: name (Apraemio), symbol (APRA), decimals (18)
  - 1% fee is set (*tokenFee*), taking fees is enabled (*takeFee*), fee collecting wallet is set from *feeWallet* parameter.
- Basic BEP20 functions work according to the standard (*name, symbol, decimals*)
- Ownable traits provide the usual functions (*owner, getOwner, renounceOwnership, transferOwnership*) and the *onlyOwner* modifier
- Fee logic:
  - Token transfers incur a fee that is a fixed percent of the tokens being transferred.
  - Token fee is sent to the fee wallet.
  - Token fees can be enabled or disabled globally with *setTakeFee*.
  - Token fees can be disabled for individual addresses (*includeInFee, excludeFromFee*), the current state is stored in the *_isExcludedFromFee* mapping and can be queried with *isExcludedFromFee*
  - The fee wallet can be modified (*changeFeeWallet*)
- A user can transfer its tokens to another address (*transfer*)
- Token balance can be queried for any address (*balanceOf*)
- Users can burn their tokens that decreases the totalSupply as well. Burning does not incur a fee.
- Allowances:
  - An address can give an allowance to another one (*approve*)
  - Allowances can be used for transfers (*transferFrom*) and burning (*burnFrom*)
  - Current allowance between two addresses can be queried with *allowance*
  - Although allowance can be modified with the *approve* function it is safer to use *increaseAllowance* and *decreaseAllowance*

The TimeLock contract (TimeLock_v2.sol) implements token vesting.

- Upon presale token purchases users only receive 40% of their tokens, the rest is locked in the contract (*lockAmount*) A lock is represented by a *Locker* structure that contains the full and the withdrawn amounts. Tokens locked for the same address are added to the existing lock.
- Tokens can be withdrawn (*withdraw*) when:
  - The *icoTimestamp* is set (the expected date of the ICO or CEX listing as a UNiX timestamp) - can be a past date in case the ICO date can not be published in advance (due to legal issues or human error) It is possible that even the whole amount of locked tokens could be withdrawn at once in an edge case.
  - The *icoTimestamp* is locked (*icoLocked*). It is only possible to modify the timestamp before locking it. Once locked (*lockIcoTimestamp*) it can not be unlocked.
  - After the icoTimestamp 10% of the original amount can be withdrawn every 30 days. The whole amount is freed after 180 days after the ICO timestamp.
- It is possible to query the amount of tokens that can be withdrawn at a given time after the ICO timestamp is set. *available* has two versions that can be used for the sender or a given address at the current time, *availableAt* comes in also two flavors and specifies a timestamp for either the sender or a specific address.
- If an account is compromised it can transfer it's lock to another address (*transfer*)
- It is not possible to lock tokens after the *icoTimestamp*
- Only locker accounts can lock tokens. It can be queried (*canLock*) if an address can lock. The owner can add (*setAccountAsLocker*) and remove (*removeAccountFromLockers*) addressess from the list that can lock tokens.

The PRPLock contract (PRPLock.sol) implements PRP locking.

- Upon entering the PRP users lock their tokens for a one year period. A lock is represented by a *Locker* structure that contains the token amount and expiration date. Tokens locked for the same address will create a new lock.
- Locking happens via Locker accounts
- Tokens can be withdrawn (*withdraw*) after the expiration date.
- A lock can be broken before expiration in two steps: 1. (*break*) 2. (*confirm*)
- It is possible to query the locks for a user. *available* has two versions that can be used for the sender or a given address at the current time
- If an account is compromised it can transfer it's lock to another address (*transfer*)

## Roles

The $APRA contract has the following roles:

- User (default): can transfer tokens, or give allowance to another address to do so
- Admin (owner): can enable or disable the fee feature globally and mark addresses to be exempt from fee payment. Can as well trasfer the admin role to another address or denounce it.

The TimeLock contract has three roles:

- User (default): can create, withdraw or transfer a lock.
- Admin (owner): can set the ICO timestamp and lock the ICO timestamp.
- Locker: A list of locker accounts is maintained who can lock amounts for users. 

The PRPLock contract has three roles as well:

- User (default): can create, withdraw or transfer a lock.
- Admin (owner): can confirm breaking locks. Can as well trasfer the admin role to another address.
- Locker: A list of locker accounts is maintained who can lock amounts for users.

# Technical Requirements

 This project has been developed with Solidity language, using Hardhat as a
 development environment. Plain javascript is the selected language for testing and
 scripting.
 In addition, OpenZeppelin’s libraries are used in the project. Their source is included in the repository.

# Getting Started

Recommended Node version is 20.10.0 and above.

## Available commands

```bash
# install dependencies
$ npm install

# build for production
$ npm run build

# clean, build, run tests
$ npm run rebuild

# run tests
$ npm run test

# compute tests coverage
$ npm run coverage

# eslint automatically fix problems
$ npm run lint

# run pretty-quick on .ts , .tsx files
$ npm run lint-quick

# deploy to a network configured in Hardhat
$ npm run deploy [network]
```

# Project Structure

The project is EVM compatible, the primary target is Binance chain.

## Tests

Tests are found in the `./test/` folder. `./test/shared/` contains various test helpers. No additional keys are required to run the tests.

Both positive and negative cases are covered, and test coverage is 100% for both permanent infrastructure contracts: APRA and TimeLock and their base contracts: BEP20, Context, Ownable.

## Contracts

Solidity smart contracts are found in `./contracts/`

## Deploy

Deploy script can be found in the `./scripts/` folder (`./scripts/deploy.js`).

For deployments Hardhat ingnition is used, the implementing scripts are available in `./ignition/modules/`

Rename `./.env.sample` to `./.env` in the project root.
You can select here the funds, fees and deployer accounts. The sample accounts are the "built-in" hardhat accounts available on the localhost network. If you want to deploy on other networks you must create the required definitions in `./hardhat.config.js`.

example:

```bash
# start chain on localhost
$ npx hardhat node

# deploy the contracts on local chain
$ npm run deploy localhost
```
