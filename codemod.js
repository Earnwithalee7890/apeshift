// scripts/codemod.ts
var codemod = async (root) => {
  const rootNode = root.root();
  const edits = [];
  const brownieFromImports = rootNode.findAll({
    rule: {
      pattern: "from brownie import $$$ITEMS"
    }
  });
  for (const node of brownieFromImports) {
    let text = node.text();
    text = text.replace("from brownie", "from ape");
    text = text.replace(/\bnetwork\b/g, "networks");
    text = text.replace(/,\s*Wei\b/g, "");
    text = text.replace(/\bWei\s*,\s*/g, "");
    text = text.replace(/,\s*config\b/g, "");
    text = text.replace(/\bconfig\s*,\s*/g, "");
    text = text.replace(/,\s*web3\b/g, "");
    text = text.replace(/\bweb3\s*,\s*/g, "");
    if (/\b[A-Z][a-zA-Z0-9_]*\b/.test(text) && !/\bproject\b/.test(text)) {
      text = text.replace("from ape import ", "from ape import project, ");
    }
    edits.push(node.replace(text));
  }
  const brownieImports = rootNode.findAll({
    rule: {
      pattern: "import brownie"
    }
  });
  for (const node of brownieImports) {
    edits.push(node.replace("import ape"));
  }
  const brownieAttrAccess = rootNode.findAll({
    rule: {
      pattern: "brownie.$ATTR"
    }
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
  const accountAccess = rootNode.findAll({
    rule: {
      pattern: "accounts[$INDEX]"
    }
  });
  for (const node of accountAccess) {
    const indexNode = node.getMatch("INDEX");
    if (indexNode) {
      const parentText = node.text();
      if (!parentText.includes("test_accounts")) {
        edits.push(node.replace(`accounts.test_accounts[${indexNode.text()}]`));
      }
    }
  }
  const deployments = rootNode.findAll({
    rule: {
      pattern: "$CONTRACT.deploy($$$ARGS)"
    }
  });
  for (const node of deployments) {
    const contractNode = node.getMatch("CONTRACT");
    if (!contractNode) continue;
    const contractText = contractNode.text();
    if (!/^[A-Z]/.test(contractText)) continue;
    if (contractText.startsWith("project.")) continue;
    let text = node.text();
    const fromDictRegex = /,?\s*\{\s*['"]from['"]\s*:\s*(.+?)(?:\s*,\s*['"]value['"]\s*:\s*(.+?))?\s*\}/g;
    text = text.replace(fromDictRegex, (fullMatch, acc, val) => {
      const updatedAcc = acc.replace(/accounts\[(\d+)\]/g, "accounts.test_accounts[$1]");
      const hasLeadingComma = /^,/.test(fullMatch.trim());
      let result = (hasLeadingComma ? ", " : "") + `sender=${updatedAcc}`;
      if (val) {
        const unwrappedVal = val.replace(/Wei\((.+?)\)/g, "$1");
        result += `, value=${unwrappedVal}`;
      }
      return result;
    });
    if (!text.startsWith("project.")) {
      text = "project." + text;
    }
    edits.push(node.replace(text));
  }
  const funcCalls = rootNode.findAll({
    rule: {
      pattern: "$OBJ.$METHOD($$$ARGS)"
    }
  });
  for (const node of funcCalls) {
    const objNode = node.getMatch("OBJ");
    const methodNode = node.getMatch("METHOD");
    if (!objNode || !methodNode) continue;
    const objText = objNode.text();
    const methodText = methodNode.text();
    if (methodText === "deploy") continue;
    if (["print", "assert", "chain", "network", "networks", "ape", "brownie", "pytest", "project"].includes(objText)) continue;
    let text = node.text();
    const hasFromDict = /\{\s*['"]from['"]\s*:/.test(text);
    if (!hasFromDict) continue;
    const fromDictRegex2 = /,?\s*\{\s*['"]from['"]\s*:\s*(.+?)(?:\s*,\s*['"]value['"]\s*:\s*(.+?))?\s*\}/g;
    text = text.replace(fromDictRegex2, (fullMatch, acc, val) => {
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
  const chainSleep = rootNode.findAll({
    rule: {
      pattern: "chain.sleep($SECS)"
    }
  });
  for (const node of chainSleep) {
    const secsNode = node.getMatch("SECS");
    if (secsNode) {
      edits.push(node.replace(`chain.pending_timestamp += ${secsNode.text()}`));
    }
  }
  const chainTime = rootNode.findAll({
    rule: {
      pattern: "chain.time()"
    }
  });
  for (const node of chainTime) {
    edits.push(node.replace("chain.pending_timestamp"));
  }
  const chainMine = rootNode.findAll({
    rule: {
      pattern: "chain.mine($BLOCKS)"
    }
  });
  for (const node of chainMine) {
    const blocksNode = node.getMatch("BLOCKS");
    if (blocksNode) {
      const blocksText = blocksNode.text();
      if (/^\d+$/.test(blocksText)) {
        edits.push(node.replace(`chain.mine(num_blocks=${blocksText})`));
      }
    }
  }
  const weiCalls = rootNode.findAll({
    rule: {
      pattern: "Wei($VAL)"
    }
  });
  for (const node of weiCalls) {
    const valNode = node.getMatch("VAL");
    if (valNode) {
      edits.push(node.replace(valNode.text()));
    }
  }
  const contractAt = rootNode.findAll({
    rule: {
      pattern: "Contract.at($ADDR)"
    }
  });
  for (const node of contractAt) {
    const addrNode = node.getMatch("ADDR");
    if (addrNode) {
      edits.push(node.replace(`Contract(${addrNode.text()})`));
    }
  }
  const showActive = rootNode.findAll({
    rule: {
      pattern: "network.show_active()"
    }
  });
  for (const node of showActive) {
    edits.push(node.replace("networks.provider.network.name"));
  }
  const networkConnect = rootNode.findAll({
    rule: {
      pattern: "network.connect($NET)"
    }
  });
  for (const node of networkConnect) {
    const netNode = node.getMatch("NET");
    if (netNode) {
      edits.push(node.replace(`# TODO(ApeShift): Replace with ape networks context manager for ${netNode.text()}`));
    }
  }
  const networkDisconnect = rootNode.findAll({
    rule: {
      pattern: "network.disconnect()"
    }
  });
  for (const node of networkDisconnect) {
    edits.push(node.replace("# TODO(ApeShift): network disconnect handled by ape context manager"));
  }
  const vmError = rootNode.findAll({
    rule: {
      pattern: "VirtualMachineError"
    }
  });
  for (const node of vmError) {
    edits.push(node.replace("ContractLogicError"));
  }
  const accountsAt = rootNode.findAll({
    rule: {
      pattern: "accounts.at($$$ARGS)"
    }
  });
  for (const node of accountsAt) {
    let text = node.text();
    text = text.replace(
      /accounts\.at\((.+?)(?:,\s*force\s*=\s*True)?\)/g,
      "accounts.impersonate_account($1)"
    );
    edits.push(node.replace(text));
  }
  const configAccess = rootNode.findAll({
    rule: {
      pattern: "config[$KEY]"
    }
  });
  for (const node of configAccess) {
    const text = node.text();
    edits.push(node.replace(`${text}  # TODO(ApeShift): migrate to ape-config.yaml`));
  }
  const web3Access = rootNode.findAll({
    rule: {
      pattern: "web3.$ATTR"
    }
  });
  for (const node of web3Access) {
    const text = node.text();
    if (!text.includes("TODO")) {
      edits.push(node.replace(`${text}  # TODO(ApeShift): replace with ape provider equivalent`));
    }
  }
  const fnIsolation = rootNode.findAll({
    rule: {
      pattern: "fn_isolation"
    }
  });
  for (const node of fnIsolation) {
    edits.push(node.replace("fn_isolation  # TODO(ApeShift): Ape handles test isolation natively via ape-test plugin"));
  }
  return rootNode.commitEdits(edits);
};
var codemod_default = codemod;
export {
  codemod_default as default
};
