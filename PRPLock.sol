// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./APRA.sol";
import "./Ownable2Step.sol";

/**
 * @dev PRP lock contract.
 *
 * APRA tokens are locked for users entering PRP. The workflow is the following:
 * 1) User initiates PRP process on the website. (out of scope)
 * 2) User gives allowance for this contract. (out of scope)
 * 3) The user initiates the locking on the website. (out of scope)
 * 4) The locker account creates the lock with the proper parameters.
 * 5) The tokens are transferred from the user to this account
 *
 * Every address can be queried for its locks.
 * Tokens can be withdrawn after the lock expiration.
 */
contract PRPLock is Ownable2Step {

    APRA  public apra; // APRA contract
    
    // structure to hold vesting and withdrawn token amount for an address
    struct Locker {
        uint256 amount;
        uint256 expiresAt;
        bool breakable;
    }

    // mapping address to vested and withdrawn amount of tokens
    mapping(address => Locker[]) lockers; 

    // mapping of addresses that can lock funds
    mapping (address => bool) public _canLock;

    /**
    * @param _apra Address of APRA token contract
    */
    constructor(APRA _apra) Ownable_(_msgSender()){
        apra = _apra;
    }

    event TokensLocked(address indexed locker, uint256 amount, uint256 expiration);
    event TokensWithdrawn(address indexed locker, uint256 indexed timestamp, uint256 amount);
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);

    error NoWithdrawalBeforeExpiration();
    error NoAmountLocked();
    
    /**
    * @dev Shows lockers for the given address
    * @param locker Withdrawing address
    */
    function getLocks(address locker) public view returns (Locker[] memory) {
        Locker[] memory locks = lockers[locker];
        if(locks.length ==0){
            revert NoAmountLocked();
        }
        
        return locks;
    }

    error AmountMustBeGreaterThan0();
    error SenderCantLock();
    error LockFor0Address();
    error PRPLockNotExcludedFromFee();
    error InvalidExpiration();
    error ExprirationMismatch();

    /**
    * @dev Lock tokens for the specified address - this contract must have the required amount of allowance 
    * given by the sending account for the given token
    * @param locker Tokens are locked for this address
    * @param amount How many tokens to lock
    */
    function lockAmount(address locker, uint256 amount, uint256 expiration, uint256 lock) external {
        if(amount==0){
            revert AmountMustBeGreaterThan0();
        }
        if(!_canLock[msg.sender]){
            revert SenderCantLock();
        }
        if(locker==address(0)){
            revert LockFor0Address();
        }

        uint256 balanceBefore = apra.balanceOf(address(this));
        apra.transferFrom(locker, address(this), amount);

        // amount can not be greater than APRA supply and can not underflow
        unchecked{
            uint256 amountReceived = apra.balanceOf(address(this)) - balanceBefore;
            if(amountReceived != amount) revert PRPLockNotExcludedFromFee();
            if(expiration <= block.timestamp) revert InvalidExpiration();

            if(lock >= lockers[locker].length) {
                lockers[locker].push(Locker(amount, expiration, false));
            } else {
                 Locker memory _lock = lockers[locker][lock];
                 if(_lock.expiresAt != expiration) revert ExprirationMismatch();
                 lockers[locker][lock].amount += amount;
            }
        }
        emit TokensLocked(locker, amount, expiration);     
    }

    error NothingToWithdraw();
    error LockNotFound();
    error NotExpiredYet();

    /**
    * @dev Withdraw available tokens
    */
    function withdraw(uint256 lock) external {
        if(lock >= lockers[msg.sender].length){
            revert LockNotFound();
        }
        
        Locker memory locker =  lockers[msg.sender][lock];
        //if(locker.amount == 0){
        //    revert NothingToWithdraw();
        //}
        if(locker.expiresAt > block.timestamp && !locker.breakable){
            revert NotExpiredYet();
        }
        // amount can not be greater than APRA supply
        
        apra.transfer(msg.sender, locker.amount);
        lockers[msg.sender][lock] = lockers[msg.sender][lockers[msg.sender].length - 1];
        lockers[msg.sender].pop();

        emit TokensWithdrawn(msg.sender, block.timestamp, locker.amount);
    }

    error NothingToTransfer();
    error SelfTransferNotAllowed();
    /**
    * @dev Transfer lock
    */
    function transfer(address recipient, uint256 lock) external {
        Locker[] memory locks = lockers[msg.sender];
        if(lock >= locks.length){
            revert LockNotFound();
        }
        if(msg.sender == recipient) {
            revert SelfTransferNotAllowed();
        }

        Locker memory locker = locks[lock];
        //_lockers[recipient].push(Locker(lock.amount, lock.expiresAt, lock.breakable));
        lockers[recipient].push(locks[lock]);

        lockers[msg.sender][lock] = lockers[msg.sender][locks.length - 1];
        lockers[msg.sender].pop();

        emit TokensTransferred(msg.sender, recipient, locker.amount);

    }

    /**
     * @dev Set (`account`) to be able to lock funds .
     * Can only be called by the current owner.
     */
    function setAccountAsLocker(address account) external onlyOwner {
        _canLock[account] = true;
    }
    
    /**
     * @dev Remove (`account`) from lockers.
     * Can only be called by the current owner.
     */
    function removeAccountFromLockers(address account) external onlyOwner {
        _canLock[account] = false;
    }

    /**
     * @dev Check if (`account`) can lock funds.
     */
    function canLock(address account) external view returns(bool) {
        return _canLock[account];
    }

    /**
     * @dev Set locker breaking.
     * Can only be called by the current owner.
     */
    function setLockerBreak(address locker, uint256 lock, bool breakable) external onlyOwner {
        if(lock >= lockers[locker].length) {
            revert LockNotFound();
        } 
        lockers[locker][lock].breakable = breakable;
    }
}
