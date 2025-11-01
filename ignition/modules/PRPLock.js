const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("prplock", (m) => {
  //const { apra } = m.useModule(ApraModule);
  const apra = m.getParameter("apra");
  const prplock = m.contract("PRPLock", [apra]);

  return { prplock };
});

