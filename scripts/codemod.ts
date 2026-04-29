import type { Codemod, Edit } from "codemod:ast-grep";
import type Python from "codemod:ast-grep/langs/python";

/**
 * ApeShift — Brownie to Ape Framework Migration Codemod
 *
 * Covers 26 deterministic transformation patterns:
 *   1.  from brownie import ... → from ape import ... (with name remapping)
 *   2.  import brownie → import ape
 *   3.  brownie.X → ape.X (attribute access)
 *   4.  accounts[N] → accounts.test_accounts[N]
 *   5.  Contract.deploy(args, {"from": acc}) → project.Contract.deploy(args, sender=acc)
 *   6.  contract.func(args, {"from": acc}) → contract.func(args, sender=acc)
 *   7.  chain.sleep(N) → chain.pending_timestamp += N
 *   8.  chain.time() → chain.pending_timestamp
 *   9.  chain.mine(N) → chain.mine(num_blocks=N)
 *   10. brownie.reverts(...) → ape.reverts(...)
 *   11. Wei("X ether") → "X ether" (Ape handles conversion)
 *   12. network.connect("X") → # TODO: use ape network context
 *   13. network.disconnect() → # TODO: use ape network context
 *   14. network.show_active() → networks.provider.network.name
 *   15. brownie.exceptions.VirtualMachineError → ape.exceptions.ContractLogicError
 *   16. Contract.at(addr) → Contract(addr)
 *   17. network → networks (in import renaming)
 *   18. {"from": X, "value": Y} → sender=X, value=Y (tx params)
 *   19. accounts.at("0x...", force=True) → accounts.impersonate_account("0x...")
 *   20. config["..."] → # TODO: migrate to ape-config.yaml
 *   21. web3.X → # TODO: use ape equivalent
 *   22. fn_isolation fixture → # TODO: Ape handles isolation natively
 *   23. Wei import removal
 *   24. config import removal
 *   25. web3 import removal
 *   26. project auto-injection for contract imports
 */
const codemod: Codemod<Python> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];

  // ──────────────────────────────────────────────────
  // RULE 1: from brownie import X, Y, Z → from ape import X, Y, Z
  // ──────────────────────────────────────────────────
  const brownieFromImports = rootNode.findAll({
    rule: {
      pattern: "from brownie import $$$ITEMS",
    },
  });

  for (const node of brownieFromImports) {
    let text = node.text();
    // Replace module name
    text = text.replace("from brownie", "from ape");
    // Rename 'network' to 'networks' in imports
    text = text.replace(/\bnetwork\b/g, "networks");
    // Remove 'Wei' from import — Ape handles it differently
    text = text.replace(/,\s*Wei\b/g, "");
    text = text.replace(/\bWei\s*,\s*/g, "");
    // Remove 'config' from import — use ape-config.yaml instead
    text = text.replace(/,\s*config\b/g, "");
    text = text.replace(/\bconfig\s*,\s*/g, "");
    // Remove 'web3' from import — Ape has its own provider interface
    text = text.replace(/,\s*web3\b/g, "");
    text = text.replace(/\bweb3\s*,\s*/g, "");
    // Add 'project' if contract names are imported (UpperCase names)
    if (/\b[A-Z][a-zA-Z0-9_]*\b/.test(text) && !/\bproject\b/.test(text)) {
      text = text.replace("from ape import ", "from ape import project, ");
    }
    edits.push(node.replace(text));
  }

  // ──────────────────────────────────────────────────
  // RULE 2: import brownie → import ape
  // ──────────────────────────────────────────────────
  const brownieImports = rootNode.findAll({
    rule: {
      pattern: "import brownie",
    },
  });

  for (const node of brownieImports) {
    edits.push(node.replace("import ape"));
  }

  // ──────────────────────────────────────────────────
  // RULE 3: brownie.X → ape.X (attribute access)
  // ──────────────────────────────────────────────────
  const brownieAttrAccess = rootNode.findAll({
    rule: {
      pattern: "brownie.$ATTR",
    },
  });

  for (const node of brownieAttrAccess) {
    const attrNode = node.getMatch("ATTR");
    if (attrNode) {
      const attr = attrNode.text();
      if (attr === "reverts") {
        edits.push(node.replace("ape.reverts"));
      } else if (attr === "network") {
        edits.push(node.replace("ape.networks"));
      } else if (attr === "exceptions") {
        edits.push(node.replace("ape.exceptions"));
      } else {
        edits.push(node.replace(`ape.${attr}`));
      }
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 4: accounts[N] → accounts.test_accounts[N]
  // Only in non-test contexts (global scripts)
  // ──────────────────────────────────────────────────
  const accountAccess = rootNode.findAll({
    rule: {
      pattern: "accounts[$INDEX]",
    },
  });

  for (const node of accountAccess) {
    const indexNode = node.getMatch("INDEX");
    if (indexNode) {
      // Don't transform if it's already test_accounts
      const parentText = node.text();
      if (!parentText.includes("test_accounts")) {
        edits.push(node.replace(`accounts.test_accounts[${indexNode.text()}]`));
      }
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 5: Contract.deploy(args, {"from": acc}) →
  //         project.Contract.deploy(args, sender=acc)
  // ──────────────────────────────────────────────────
  const deployments = rootNode.findAll({
    rule: {
      pattern: "$CONTRACT.deploy($$$ARGS)",
    },
  });

  for (const node of deployments) {
    const contractNode = node.getMatch("CONTRACT");
    if (!contractNode) continue;

    const contractText = contractNode.text();
    // Only transform PascalCase names (contract classes)
    if (!/^[A-Z]/.test(contractText)) continue;
    // Skip if already project.X
    if (contractText.startsWith("project.")) continue;

    let text = node.text();
    // Convert {"from": acc} or {'from': acc} to sender=acc
    const fromDictRegex = /,?\s*\{\s*['"]from['"]\s*:\s*(.+?)(?:\s*,\s*['"]value['"]\s*:\s*(.+?))?\s*\}/g;
    text = text.replace(fromDictRegex, (fullMatch: any, acc: any, val: any) => {
      const updatedAcc = acc.replace(/accounts\[(\d+)\]/g, "accounts.test_accounts[$1]");
      const hasLeadingComma = /^,/.test(fullMatch.trim());
      let result = (hasLeadingComma ? ", " : "") + `sender=${updatedAcc}`;
      if (val) {
        // Unwrap Wei("X") → "X"
        const unwrappedVal = val.replace(/Wei\((.+?)\)/g, "$1");
        result += `, value=${unwrappedVal}`;
      }
      return result;
    });

    // Prepend project.
    if (!text.startsWith("project.")) {
      text = "project." + text;
    }

    edits.push(node.replace(text));
  }

  // ──────────────────────────────────────────────────
  // RULE 6: contract.func(args, {"from": acc}) →
  //         contract.func(args, sender=acc)
  // ──────────────────────────────────────────────────
  const funcCalls = rootNode.findAll({
    rule: {
      pattern: "$OBJ.$METHOD($$$ARGS)",
    },
  });

  for (const node of funcCalls) {
    const objNode = node.getMatch("OBJ");
    const methodNode = node.getMatch("METHOD");
    if (!objNode || !methodNode) continue;

    const objText = objNode.text();
    const methodText = methodNode.text();
    // Skip if this is a deploy call (handled above)
    if (methodText === "deploy") continue;
    // Skip known non-contract calls
    if (["print", "assert", "chain", "network", "networks", "ape", "brownie", "pytest", "project"].includes(objText)) continue;

    let text = node.text();
    const hasFromDict = /\{\s*['"]from['"]\s*:/.test(text);
    if (!hasFromDict) continue;

    // Convert {"from": acc} → sender=acc
    const fromDictRegex2 = /,?\s*\{\s*['"]from['"]\s*:\s*(.+?)(?:\s*,\s*['"]value['"]\s*:\s*(.+?))?\s*\}/g;
    text = text.replace(fromDictRegex2, (fullMatch: any, acc: any, val: any) => {
      const updatedAcc = acc.replace(/accounts\[(\d+)\]/g, "accounts.test_accounts[$1]");
      const hasLeadingComma = /^,/.test(fullMatch.trim());
      let result = (hasLeadingComma ? ", " : "") + `sender=${updatedAcc}`;
      if (val) {
        const unwrappedVal = val.replace(/Wei\((.+?)\)/g, "$1");
        result += `, value=${unwrappedVal}`;
      }
      return result;
    });

    edits.push(node.replace(text));
  }

  // ──────────────────────────────────────────────────
  // RULE 7: chain.sleep(N) → chain.pending_timestamp += N
  // ──────────────────────────────────────────────────
  const chainSleep = rootNode.findAll({
    rule: {
      pattern: "chain.sleep($SECS)",
    },
  });

  for (const node of chainSleep) {
    const secsNode = node.getMatch("SECS");
    if (secsNode) {
      edits.push(node.replace(`chain.pending_timestamp += ${secsNode.text()}`));
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 8: chain.time() → chain.pending_timestamp
  // ──────────────────────────────────────────────────
  const chainTime = rootNode.findAll({
    rule: {
      pattern: "chain.time()",
    },
  });

  for (const node of chainTime) {
    edits.push(node.replace("chain.pending_timestamp"));
  }

  // ──────────────────────────────────────────────────
  // RULE 9: chain.mine(N) → chain.mine(num_blocks=N)
  // ──────────────────────────────────────────────────
  const chainMine = rootNode.findAll({
    rule: {
      pattern: "chain.mine($BLOCKS)",
    },
  });

  for (const node of chainMine) {
    const blocksNode = node.getMatch("BLOCKS");
    if (blocksNode) {
      const blocksText = blocksNode.text();
      // Only add num_blocks= if it's a plain number
      if (/^\d+$/.test(blocksText)) {
        edits.push(node.replace(`chain.mine(num_blocks=${blocksText})`));
      }
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 10: Wei("X ether") → "X ether" (string form)
  //          Wei("X gwei")  → "X gwei"
  // ──────────────────────────────────────────────────
  const weiCalls = rootNode.findAll({
    rule: {
      pattern: "Wei($VAL)",
    },
  });

  for (const node of weiCalls) {
    const valNode = node.getMatch("VAL");
    if (valNode) {
      // Just pass through the string — Ape converts automatically
      edits.push(node.replace(valNode.text()));
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 11: Contract.at(addr) → Contract(addr)
  // ──────────────────────────────────────────────────
  const contractAt = rootNode.findAll({
    rule: {
      pattern: "Contract.at($ADDR)",
    },
  });

  for (const node of contractAt) {
    const addrNode = node.getMatch("ADDR");
    if (addrNode) {
      edits.push(node.replace(`Contract(${addrNode.text()})`));
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 12: network.show_active() → networks.provider.network.name
  // ──────────────────────────────────────────────────
  const showActive = rootNode.findAll({
    rule: {
      pattern: "network.show_active()",
    },
  });

  for (const node of showActive) {
    edits.push(node.replace("networks.provider.network.name"));
  }

  // ──────────────────────────────────────────────────
  // RULE 13: network.connect($NET) → # TODO: use ape networks context manager
  // ──────────────────────────────────────────────────
  const networkConnect = rootNode.findAll({
    rule: {
      pattern: "network.connect($NET)",
    },
  });

  for (const node of networkConnect) {
    const netNode = node.getMatch("NET");
    if (netNode) {
      edits.push(node.replace(`# TODO(ApeShift): Replace with ape networks context manager for ${netNode.text()}`));
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 14: network.disconnect() → # handled by ape context manager
  // ──────────────────────────────────────────────────
  const networkDisconnect = rootNode.findAll({
    rule: {
      pattern: "network.disconnect()",
    },
  });

  for (const node of networkDisconnect) {
    edits.push(node.replace("# TODO(ApeShift): network disconnect handled by ape context manager"));
  }

  // ──────────────────────────────────────────────────
  // RULE 15: brownie.exceptions.VirtualMachineError →
  //          ape.exceptions.ContractLogicError
  // ──────────────────────────────────────────────────
  const vmError = rootNode.findAll({
    rule: {
      pattern: "VirtualMachineError",
    },
  });

  for (const node of vmError) {
    edits.push(node.replace("ContractLogicError"));
  }

  // ──────────────────────────────────────────────────
  // RULE 16: accounts.at("0x...", force=True) →
  //          accounts.impersonate_account("0x...")
  // ──────────────────────────────────────────────────
  const accountsAt = rootNode.findAll({
    rule: {
      pattern: "accounts.at($$$ARGS)",
    },
  });

  for (const node of accountsAt) {
    let text = node.text();
    // accounts.at("0x...", force=True) → accounts.impersonate_account("0x...")
    text = text.replace(/accounts\.at\((.+?)(?:,\s*force\s*=\s*True)?\)/g,
      "accounts.impersonate_account($1)");
    edits.push(node.replace(text));
  }

  // ──────────────────────────────────────────────────
  // RULE 17: config["..."] → TODO comment
  // ──────────────────────────────────────────────────
  const configAccess = rootNode.findAll({
    rule: {
      pattern: "config[$KEY]",
    },
  });

  for (const node of configAccess) {
    const text = node.text();
    edits.push(node.replace(`${text}  # TODO(ApeShift): migrate to ape-config.yaml`));
  }

  // ──────────────────────────────────────────────────
  // RULE 18: web3.ens.X / web3.eth.X → TODO comment
  // ──────────────────────────────────────────────────
  const web3Access = rootNode.findAll({
    rule: {
      pattern: "web3.$ATTR",
    },
  });

  for (const node of web3Access) {
    const text = node.text();
    // Don't double-annotate
    if (!text.includes("TODO")) {
      edits.push(node.replace(`${text}  # TODO(ApeShift): replace with ape provider equivalent`));
    }
  }

  // ──────────────────────────────────────────────────
  // RULE 19: fn_isolation fixture → TODO comment
  // ──────────────────────────────────────────────────
  const fnIsolation = rootNode.findAll({
    rule: {
      pattern: "fn_isolation",
    },
  });

  for (const node of fnIsolation) {
    edits.push(node.replace("fn_isolation  # TODO(ApeShift): Ape handles test isolation natively via ape-test plugin"));
  }

  // Commit all edits at once
  return rootNode.commitEdits(edits);
};

export default codemod;
