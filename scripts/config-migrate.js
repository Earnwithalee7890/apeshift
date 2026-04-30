// scripts/config-migrate.ts
var codemod = async (root) => {
  const rootNode = root.root();
  const edits = [];
  const fullText = rootNode.text();
  if (!fullText.includes("compiler") && !fullText.includes("wallets") && !fullText.includes("dotenv")) {
    return fullText;
  }
  let result = fullText;
  result = result.replace(
    /compiler:\s*\n\s*solc:\s*\n(\s*)remappings:/g,
    "solidity:\n$1import_remapping:"
  );
  result = result.replace(/^compiler:\s*\n\s*solc:\s*\n/gm, "solidity:\n");
  result = result.replace(
    /wallets:\s*\n\s*from_key:\s*.+/g,
    "# TODO(ApeShift): Brownie wallets.from_key removed.\n# Import your key with: ape accounts import <alias>"
  );
  result = result.replace(
    /dotenv:\s*.+/g,
    "# TODO(ApeShift): dotenv is handled natively by ape. Place .env in project root."
  );
  result = result.replace(
    /networks:\s*\n(\s*)default:\s*(.+)/g,
    "ethereum:\n$1default_network: $2"
  );
  if (!result.includes("name:")) {
    result = "name: migrated-ape-project\nplugins:\n  - name: solidity\n\n" + result;
  }
  return result;
};
var config_migrate_default = codemod;
export {
  config_migrate_default as default
};
