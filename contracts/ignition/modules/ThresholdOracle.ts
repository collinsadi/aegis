import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ThresholdOracleModule = buildModule("ThresholdOracleModule", (m) => {
  // The authorized oracle addresses that can submit threat scores.
  // For production: replace with your actual oracle wallet addresses.
  // For a 2-of-3 setup: provide 3 addresses, quorum = 2.
  const oracle1 = m.getParameter("oracle1", "0x0000000000000000000000000000000000000001");
  const oracle2 = m.getParameter("oracle2", "0x0000000000000000000000000000000000000002");
  const oracle3 = m.getParameter("oracle3", "0x0000000000000000000000000000000000000003");

  // Quorum: how many oracles must vote before the average is checked.
  // 2 means 2-of-3 must agree before any action is taken.
  const quorum = m.getParameter("quorum", 2);

  // Threat threshold: average score must be >= this to trigger deprecateECDSA().
  // 70 matches the existing QuantumOracle threshold in AegisAccount.sol.
  const threshold = m.getParameter("threshold", 70);

  const thresholdOracle = m.contract("ThresholdOracle", [
    [oracle1, oracle2, oracle3],
    quorum,
    threshold,
  ]);

  return { thresholdOracle };
});

export default ThresholdOracleModule;
