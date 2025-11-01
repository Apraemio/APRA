const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { expandTo18Decimals, ZERO_ADDRESS } = require("./shared/utilities");

const ApraModule = require("../ignition/modules/Apra");
const PRPLockModule = require("../ignition/modules/PRPLock");

const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;


describe("PRPLock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployPRPLock() {
    const [owner, funds, fees, alice, bob] = await ethers.getSigners();
    const parameters = {
      apra: {
        fees: fees.address,
        funds: funds.address
      }
    }
    const { apra } = await ignition.deploy(ApraModule,
      {
        defaultSender: owner.address,
        parameters
      }
    );
    
    const { prplock } = await ignition.deploy(PRPLockModule, {
      defaultSender: owner.address,
      parameters: { prplock: { apra: await apra.getAddress() } }
    },
    );

    await apra.excludeFromFee(prplock);
    await prplock.setAccountAsLocker(funds.address);
    await apra.connect(funds).transfer(alice.address, expandTo18Decimals(10000));

    return { apra, owner, funds, fees, prplock, alice, bob };
  }

  async function deployAndLockAlice1000() {
    const { apra, owner, funds, fees, prplock, alice, bob } = await deployPRPLock();

    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    //await prplock.setAccountAsLocker(funds.address);
    await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
    await prplock.connect(funds).lockAmount(alice, expandTo18Decimals(1000), unlockTime, 0);

    return { apra, owner, funds, fees, prplock, alice, bob };
  }

  describe("Deployment", function () {

    it("Init", async function () {
      const { apra, owner, funds, fees, prplock } = await loadFixture(deployPRPLock);
      expect(await prplock.owner()).to.equal(owner);
    });

    it("PRPLock not excluded from fee", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      await apra.includeInFee(prplock);
      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(1000), unlockTime, 0)).to.be.revertedWithCustomError(
        prplock,
        "PRPLockNotExcludedFromFee"
      );
    });
  });

  describe("Ownership", function () {
   
    it("Set locker", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      await expect(prplock.connect(alice).setAccountAsLocker(alice)).to.be.revertedWithCustomError(
        prplock,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Remove locker", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      await expect(prplock.connect(alice).removeAccountFromLockers(alice)).to.be.revertedWithCustomError(
        prplock,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Set locker break", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await prplock.connect(funds).lockAmount(alice, expandTo18Decimals(1000), unlockTime, 0);
      await expect(prplock.connect(alice).setLockerBreak(alice, 0, true)).to.be.revertedWithCustomError(
        prplock,
        "OwnableUnauthorizedAccount"
      );
    });
    
  });
//await time.latest() + ONE_YEAR_IN_SECS + 1
  describe("Lock amount", function () {

    it("getLocks - no amount locked", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      await expect(prplock.getLocks(alice)).to.be.revertedWithCustomError(
        prplock,
        "NoAmountLocked"
      );
    });


    it("getLocks - lock amount", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      
      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(100), unlockTime, 0)).to.changeTokenBalances(
        apra,
        [funds, fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(0), expandTo18Decimals(100), expandTo18Decimals(-100)]
      );

      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(200), unlockTime+1, 1)).to.changeTokenBalances(
        apra,
        [funds, fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(0), expandTo18Decimals(200), expandTo18Decimals(-200)]
      );

      // We can increase the time in Hardhat Network
      // await time.increaseTo(ONE_YEAR_IN_SECS + unlockTime);
      const result1 = await prplock["getLocks(address)"](alice);
      expect(result1[0].amount).equal(expandTo18Decimals(100));
      expect(result1[0].breakable).equal(false);
      expect(result1[0].expiresAt).equal(unlockTime);

      expect(result1[1].amount).equal(expandTo18Decimals(200));
      expect(result1[1].breakable).equal(false);
      expect(result1[1].expiresAt).equal(unlockTime+1);

      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(100), unlockTime, 0)).to.changeTokenBalances(
        apra,
        [funds, fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(0), expandTo18Decimals(100), expandTo18Decimals(-100)]
      );
      const result2 = await prplock["getLocks(address)"](alice);
      expect(result2[0].amount).equal(expandTo18Decimals(200));
      expect(result2[0].breakable).equal(false);
      expect(result2[0].expiresAt).equal(unlockTime);

      expect(result2[1].amount).equal(expandTo18Decimals(200));
      expect(result2[1].breakable).equal(false);
      expect(result2[1].expiresAt).equal(unlockTime+1);

    });

    it("Lock - no amount", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(0), unlockTime, 0)).to.be.revertedWithCustomError(
        prplock,
        "AmountMustBeGreaterThan0"
      );
    });

    it("Lock - zero address", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      
      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      await expect(prplock.connect(funds).lockAmount(ZERO_ADDRESS, expandTo18Decimals(10), unlockTime, 0)).to.be.revertedWithCustomError(
        prplock,
        "LockFor0Address"
      );
    });


    it("Lock - not locker", async function () {
      const { apra, owner, funds, fees, prplock, alice } = await loadFixture(deployPRPLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      //
      await apra.connect(alice).approve(prplock, expandTo18Decimals(1000));
      await prplock.connect(owner).removeAccountFromLockers(funds);
      await expect(prplock.connect(funds).lockAmount(alice, expandTo18Decimals(10), unlockTime, 0)).to.be.revertedWithCustomError(
        prplock,
        "SenderCantLock"
      );
    });


  });

  describe("Can lock", function () {
    it("Can lock", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const canlock = await prplock.canLock(funds);
      expect(canlock) 
      const canlockAlice = await prplock.canLock(alice);
      expect(!canlockAlice) 
      await prplock.removeAccountFromLockers(funds);
      const canlockFalse = await prplock.canLock(funds);
      expect(!canlockFalse) 
      
    });
  });

  describe("Transfer lock", function () {
    it("Transfer", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      
      const result1 = await prplock["getLocks(address)"](alice);
      expect(result1[0].amount).equal(expandTo18Decimals(1000));
      expect(result1[0].breakable).equal(false);
      const expires = result1[0].expiresAt;

      await expect(prplock.getLocks(bob)).to.be.revertedWithCustomError(
        prplock,
        "NoAmountLocked"
      );

      await expect(prplock.connect(alice).transfer(alice, 0)).to.be.revertedWithCustomError(
        prplock,
        "SelfTransferNotAllowed"
      ) 
      await prplock.connect(alice).transfer(bob,0);

      const result2 = await prplock["getLocks(address)"](bob);
      expect(result2[0].amount).equal(expandTo18Decimals(1000));
      expect(result2[0].breakable).equal(false);
      expect(result2[0].expiresAt).equal(expires);

      await expect(prplock.getLocks(alice)).to.be.revertedWithCustomError(
        prplock,
        "NoAmountLocked"
      );
      
    });


    it("Transfer - already withdrawn", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      
      await time.increaseTo(1+unlockTime);
      await prplock.connect(alice).withdraw(0);

      await expect(prplock.connect(alice).transfer(bob,0)).to.be.revertedWithCustomError(
        prplock,
        "LockNotFound"
      );
    });


    it("Transfer to existing lock", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

      await apra.connect(funds).transfer(bob, expandTo18Decimals(1000));
      await apra.connect(bob).approve(prplock, expandTo18Decimals(1000));
      await prplock.connect(funds).lockAmount(bob, expandTo18Decimals(100), unlockTime + 2, 0);

      const result1 = await prplock["getLocks(address)"](alice);
      expect(result1[0].amount).equal(expandTo18Decimals(1000));
      expect(result1[0].breakable).equal(false);
      const expires1 = result1[0].expiresAt;

      const result2 = await prplock["getLocks(address)"](bob);
      expect(result2[0].amount).equal(expandTo18Decimals(100));
      expect(result2[0].breakable).equal(false);
      const expires2 = result2[0].expiresAt;
      
      await prplock.connect(alice).transfer(bob,0);
      const result3 = await prplock["getLocks(address)"](bob);
      expect(result3[0].amount).equal(expandTo18Decimals(100));
      expect(result3[0].breakable).equal(false);
      expect(result3[0].expiresAt).equal(expires2);
      expect(result3[1].amount).equal(expandTo18Decimals(1000));
      expect(result3[1].breakable).equal(false);
      expect(result3[1].expiresAt).equal(expires1);

      await expect(prplock.getLocks(alice)).to.be.revertedWithCustomError(
        prplock,
        "NoAmountLocked"
      );
    });


  });


  describe("Withdraw", function () {

    it("Withdraw", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      
      await time.increaseTo(unlockTime + 2);
      
      await expect(prplock.connect(alice).withdraw(0)).to.changeTokenBalances(
        apra,
        [fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
    });

    it("Withdraw - nothing to withdraw", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
     
      await time.increaseTo(2 + unlockTime);
     
      await expect(prplock.connect(alice).withdraw(0)).to.changeTokenBalances(
        apra,
        [fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
      await expect(prplock.connect(alice).withdraw(0)).to.be.revertedWithCustomError(
        prplock,
        "LockNotFound"
      );
    });

    it("Withdraw - not expired yet", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
     
      
      await expect(prplock.connect(alice).withdraw(0)).to.be.revertedWithCustomError(
        prplock,
        "NotExpiredYet"
      );
    });

  });

   describe("BreakLock", function () {

    it("BreakLock", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      await prplock.connect(owner).setLockerBreak(alice, 0, true);
      
      await expect(prplock.connect(alice).withdraw(0)).to.changeTokenBalances(
        apra,
        [fees, prplock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
    });

     it("BreakLock - lock not found", async function () {
      const { apra, owner, funds, fees, prplock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      await expect(prplock.connect(owner).setLockerBreak(alice, 1, true)).to.be.revertedWithCustomError(
        prplock,
        "LockNotFound"
      );
    });

  });
});
