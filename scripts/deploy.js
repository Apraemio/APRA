const ApraModule = require("../ignition/modules/Apra");
const TimeLockModule = require("../ignition/modules/TimeLock");
const PRPLockModule = require("../ignition/modules/PRPLock");

require('dotenv').config()

async function main() {
    const parameters = {
        apra: {
            fees: process.env.FEES_ADDRESS,
            funds: process.env.FUNDS_ADDRESS
        }
    }
    const { apra } = await hre.ignition.deploy(ApraModule, {
        defaultSender: process.env.DEPLOYER_ADDRESS,
        parameters},);
    
  
    console.log(`Apra deployed to: ${await apra.getAddress()}`);

    const { timelock }= await hre.ignition.deploy(TimeLockModule, {
        defaultSender: process.env.DEPLOYER_ADDRESS,
        parameters: {timelock:{apra:await apra.getAddress()}}},
    ); 

    console.log(`TimeLock deployed to: ${await timelock.getAddress()}`);

    const { prplock }= await hre.ignition.deploy(PRPLockModule, {
        defaultSender: process.env.DEPLOYER_ADDRESS,
        parameters: {prplock:{apra:await apra.getAddress()}}},
    ); 

    console.log(`PRPLock deployed to: ${await prplock.getAddress()}`);

    
}
  
main().catch(console.error);