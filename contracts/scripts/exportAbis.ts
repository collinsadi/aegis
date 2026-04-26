import * as fs from "fs";
import * as path from "path";

const ARTIFACTS_DIR = path.resolve(__dirname, "../artifacts/contracts");
const SDK_ABIS_DIR = path.resolve(__dirname, "../../sdk/abis");

interface AbiExport {
  artifactPath: string;  // relative to ARTIFACTS_DIR
  outputName: string;    // filename to write in sdk/abis/
}

// Add any new contracts here. Format: relative path to artifact JSON → output filename.
const EXPORTS: AbiExport[] = [
  {
    artifactPath: "AegisAccount.sol/AegisAccount.json",
    outputName: "AegisAccount.json",
  },
  {
    artifactPath: "AegisENSResolver.sol/AegisENSResolver.json",
    outputName: "AegisENSResolver.json",
  },
  {
    artifactPath: "AegisFactory.sol/AegisFactory.json",
    outputName: "AegisFactory.json",
  },
  {
    artifactPath: "verifier/Groth16Verifier.sol/Groth16Verifier.json",
    outputName: "Groth16Verifier.json",
  },
];

async function main() {
  if (!fs.existsSync(SDK_ABIS_DIR)) {
    fs.mkdirSync(SDK_ABIS_DIR, { recursive: true });
  }

  for (const exp of EXPORTS) {
    const artifactPath = path.join(ARTIFACTS_DIR, exp.artifactPath);
    if (!fs.existsSync(artifactPath)) {
      console.error(`Artifact not found: ${artifactPath}`);
      console.error("Run: npm run compile first");
      process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abiOnly = { abi: artifact.abi };
    const outputPath = path.join(SDK_ABIS_DIR, exp.outputName);

    fs.writeFileSync(outputPath, JSON.stringify(abiOnly, null, 2));
    console.log(`Exported: ${exp.outputName} → sdk/abis/${exp.outputName}`);
  }

  console.log(`${EXPORTS.length} ABI files exported to sdk/abis/`);
  console.log("\nABI export complete. sdk/abis/ is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
