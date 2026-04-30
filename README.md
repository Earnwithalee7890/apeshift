# ApeShift Pro 🐒⚡

> **Production-grade Brownie → Ape Framework migration codemod**
>
> Built with [Codemod](https://codemod.com) · JSSG (ast-grep) · Python AST transformations

[![Registry: apeshift-pro](https://img.shields.io/badge/codemod--registry-apeshift--pro-6366f1?style=for-the-badge&logo=codemod)](https://app.codemod.com/registry/apeshift-pro)
[![Live Demo](https://img.shields.io/badge/Interactive-Demo-ff69b4?style=for-the-badge&logo=vercel)](https://earnwithalee7890.github.io/apeshift/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=for-the-badge)]()

---

## What is ApeShift?

ApeShift automates **93%** of the code migration from [Brownie](https://github.com/eth-brownie/brownie) (deprecated) to [Ape Framework](https://apeworx.io/) using deterministic AST transformations powered by Codemod's JSSG engine. Validated against real DeFi codebases (Yearn Finance).

No regex hacks. No string replacements. **Real AST-level code understanding.**

---

## 💡 Why We Built This (The Value Proposition)

**The Problem:**
Brownie was the industry-standard Python testing framework for Ethereum smart contracts, but it is now officially **deprecated and unmaintained**. Thousands of DeFi protocols (like Yearn, Curve, and countless others) have massive test suites stuck on a dying framework. Migrating these repositories to the modern **Ape Framework** manually is a nightmare: it takes weeks of engineering time, is highly prone to human error, and halts product development.

**The Solution:**
We built ApeShift to completely eliminate the friction of migrating. By leveraging Codemod and AST (Abstract Syntax Tree) parsing, ApeShift understands Python semantics and automatically translates Brownie-specific syntax into Ape-compatible code.

**The Impact:**
- ⏱️ **Saves Weeks of Work:** What used to take a developer 2 weeks of tedious find-and-replace now takes **15 seconds**.
- 🛡️ **Zero False Positives:** Because it uses AST (via `ast-grep`), it only modifies actual code structures, ignoring comments, strings, and unrelated variables.
- 🔄 **Standardization:** Helps the entire Web3 Python ecosystem safely move to Ape Framework without abandoning their legacy test suites.

---

## 🎯 Coverage — 26 Deterministic Transformation Rules

| #  | Brownie Pattern | Ape Equivalent | Type |
|----|----------------|----------------|------|
| 1  | `from brownie import X` | `from ape import X` | Import |
| 2  | `import brownie` | `import ape` | Import |
| 3  | `brownie.X` | `ape.X` | Attribute |
| 4  | `accounts[N]` | `accounts.test_accounts[N]` | Accounts |
| 5  | `Token.deploy(args, {"from": acc})` | `project.Token.deploy(args, sender=acc)` | Deploy |
| 6  | `contract.func({"from": acc})` | `contract.func(sender=acc)` | Transaction |
| 7  | `contract.func(args, {"from": X, "value": Y})` | `contract.func(args, sender=X, value=Y)` | Tx Params |
| 8  | `chain.sleep(N)` | `chain.pending_timestamp += N` | Chain API |
| 9  | `chain.time()` | `chain.pending_timestamp` | Chain API |
| 10 | `chain.mine(N)` | `chain.mine(num_blocks=N)` | Chain API |
| 11 | `Wei("1 ether")` | `"1 ether"` | Value |
| 12 | `brownie.reverts("msg")` | `ape.reverts("msg")` | Testing |
| 13 | `Contract.at(addr)` | `Contract(addr)` | Contract |
| 14 | `network.show_active()` | `networks.provider.network.name` | Network |
| 15 | `network.connect(X)` | `# TODO: ape context manager` | Network |
| 16 | `network.disconnect()` | `# TODO: ape context manager` | Network |
| 17 | `VirtualMachineError` | `ContractLogicError` | Exception |
| 18 | `network` (import) | `networks` | Import |
| 19 | `accounts.at("0x...", force=True)` | `accounts.impersonate_account("0x...")` | Accounts |
| 20 | `config["..."]` | `# TODO: ape-config.yaml` | Config |
| 21 | `web3.X` | `# TODO: ape provider` | Web3 |
| 22 | `fn_isolation` | `# TODO: ape-test handles natively` | Testing |
| 23 | `Wei` (import) | removed | Import |
| 24 | `config` (import) | removed | Import |
| 25 | `web3` (import) | removed | Import |
| 26 | Contract names (import) | auto-inject `project` | Import |

---

## 🚀 Quick Start

### Run directly from Codemod Registry (Recommended)

Run the codemod on your project without downloading the repo:

```bash
npx codemod@latest apeshift-pro --target /path/to/your/brownie-project
```

### Run locally from the repository

If you clone this repository, you can run the workflow locally:

```bash
npx codemod workflow run -w ./workflow.yaml --target /path/to/brownie-project
```

### Run with AI edge-case handling (Local only)

```bash
npx codemod workflow run -w ./workflow.yaml --target /path/to/brownie-project \
  -p run_ai_step=true
```

### Run tests

```bash
npx codemod jssg test -l python ./scripts/codemod.ts
```

---

## 📁 Project Structure

```
apeshift/
├── codemod.yaml          # Package manifest
├── workflow.yaml         # Orchestration: JSSG → AI fallback
├── CASE_STUDY.md         # Yearn Finance migration case study
├── scripts/
│   └── codemod.ts        # 26 AST transformation rules (JSSG)
├── tests/
│   ├── fixtures/         # Synthetic test (all 26 patterns)
│   ├── yearn/            # Real Yearn conftest.py migration
│   └── yearn_tests/      # Real Yearn test_operation.py migration
├── .github/workflows/
│   └── publish.yml       # CI/CD pipeline
├── index.html            # Interactive demo playground
├── package.json
└── README.md
```

---

## 🏗 Architecture

```
┌─────────────────────────┐
│   workflow.yaml         │
│  (orchestration)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   JSSG Node             │
│   scripts/codemod.ts    │
│   26 deterministic      │
│   AST rules             │
│   ≈ 93% coverage        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   AI Node (optional)    │
│   Edge cases:           │
│   - Config migration    │
│   - Complex fixtures    │
│   - Network contexts    │
│   ≈ 7% coverage         │
└─────────────────────────┘
```

---

## 🧪 Testing

The codemod includes 3 snapshot test suites — including tests from the real [Yearn Finance brownie-strategy-mix](https://github.com/yearn/brownie-strategy-mix):

```bash
npx codemod jssg test -l python ./scripts/codemod.ts
# test result: ok. 3 passed; 0 failed
```

See [CASE_STUDY.md](CASE_STUDY.md) for full coverage analysis.

---

## 📦 Publishing

```bash
npx codemod login
npx codemod publish
```

Or via GitHub Actions with [Trusted Publishers](https://docs.codemod.com/publishing#trusted-publishers).

---

## 📚 References

- [Codemod Documentation](https://docs.codemod.com/introduction)
- [Ape Framework Docs](https://docs.apeworx.io/ape/stable/)
- [Brownie → Ape Migration Guide](https://docs.apeworx.io/ape/stable/userguides/quickstart.html)
- [JSSG Reference](https://docs.codemod.com/jssg/intro)

---

## License

MIT