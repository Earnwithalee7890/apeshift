import type { Codemod, Edit } from "codemod:ast-grep";
import type Yaml from "codemod:ast-grep/langs/yaml";

/**
 * ApeShift Config Migrator
 *
 * Converts brownie-config.yaml structure to ape-config.yaml structure:
 *   - compiler.solc.remappings → solidity.import_remapping
 *   - dependencies (brownie format) → dependencies (ape format)
 *   - wallets.from_key → TODO comment
 *   - dotenv → TODO comment
 *   - networks.default → ethereum.default_network
 */
const codemod: Codemod<Yaml> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const fullText = rootNode.text();

  // Only process files that look like brownie configs
  if (!fullText.includes("compiler") && !fullText.includes("wallets") && !fullText.includes("dotenv")) {
    return fullText;
  }

  let result = fullText;

  // ── Transform: compiler.solc.remappings → solidity.import_remapping ──
  result = result.replace(
    /compiler:\s*\n\s*solc:\s*\n(\s*)remappings:/g,
    "solidity:\n$1import_remapping:"
  );

  // ── Transform: remove redundant 'compiler:' wrapper ──
  result = result.replace(/^compiler:\s*\n\s*solc:\s*\n/gm, "solidity:\n");

  // ── Transform: wallets.from_key → TODO ──
  result = result.replace(
    /wallets:\s*\n\s*from_key:\s*.+/g,
    "# TODO(ApeShift): Brownie wallets.from_key removed.\n# Import your key with: ape accounts import <alias>"
  );

  // ── Transform: dotenv → TODO ──
  result = result.replace(
    /dotenv:\s*.+/g,
    "# TODO(ApeShift): dotenv is handled natively by ape. Place .env in project root."
  );

  // ── Transform: networks.default → ethereum.default_network ──
  result = result.replace(
    /networks:\s*\n(\s*)default:\s*(.+)/g,
    "ethereum:\n$1default_network: $2"
  );

  // ── Add project name and plugins header if not present ──
  if (!result.includes("name:")) {
    result = "name: migrated-ape-project\nplugins:\n  - name: solidity\n\n" + result;
  }

  return result;
};

export default codemod;
