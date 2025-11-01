const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("timelock", (m) => {
  //const { apra } = m.useModule(ApraModule);
  const apra = m.getParameter("apra");
  const timelock = m.contract("TimeLock", [apra]);

  return { timelock };
});

