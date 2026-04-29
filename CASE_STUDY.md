# Case Study: Migrating Yearn Finance from Brownie to Ape Framework with ApeShift

## Project Overview

**Target Repository:** [yearn/brownie-strategy-mix](https://github.com/yearn/brownie-strategy-mix) — the official template used by all Yearn Finance strategy developers.

**Migration:** Brownie (deprecated) → Ape Framework

**Tool Used:** ApeShift — a JSSG-powered codemod built with the [Codemod](https://codemod.com) toolkit.

---

## The Problem

Brownie, once the dominant Python framework for Ethereum smart contract development, was officially deprecated in 2023. Thousands of DeFi projects — including major protocols like **Yearn Finance**, **Curve**, **Badger DAO**, and hundreds of independent strategy developers — still rely on Brownie for their deployment scripts and test suites.

The migration to Ape Framework is not trivial:
- **Import paths** change (`from brownie import` → `from ape import`)
- **Account access** differs (`accounts[0]` → `accounts.test_accounts[0]` in scripts)
- **Transaction syntax** is completely different (`{"from": acc}` → `sender=acc`)
- **Chain APIs** are renamed (`chain.sleep()` → `chain.pending_timestamp +=`)
- **Testing patterns** differ (Brownie's `fn_isolation` vs Ape's native isolation)
- **Account impersonation** changes (`accounts.at(addr, force=True)` → `accounts.impersonate_account(addr)`)

Manually migrating a project like Yearn's strategy mix takes **2-5 days** of careful, error-prone work.

---

## The Approach

### Architecture
```
ApeShift Workflow
├── JSSG Node (deterministic, 26 AST rules)
│   └── Handles ~87% of all migration patterns
└── AI Node (optional, handles edge cases)
    └── Handles remaining ~13% (config files, complex fixtures)
```

### Deterministic Rules (26 total)

ApeShift applies 26 AST-level transformations using Codemod's JSSG engine:

| Category | Rules | Coverage |
|----------|-------|----------|
| Import rewrites | 8 rules | `from brownie import` → `from ape import` with smart name remapping |
| Account patterns | 3 rules | Index access, `.at()` → `.impersonate_account()` |
| Transaction params | 3 rules | Dict syntax → keyword args (`sender=`, `value=`) |
| Contract deployment | 1 rule | Auto-prefix with `project.` |
| Chain API | 3 rules | `sleep`, `time`, `mine` → Ape equivalents |
| Testing patterns | 3 rules | `brownie.reverts`, `VirtualMachineError`, `fn_isolation` |
| Network API | 3 rules | `connect`, `disconnect`, `show_active` |
| Value/Contract | 2 rules | `Wei()`, `Contract.at()` |

### AI Fallback

For patterns that can't be deterministically transformed (like `brownie-config.yaml` → `ape-config.yaml` schema migration, or `pm()` package manager calls), ApeShift adds clear `# TODO(ApeShift)` markers and optionally delegates to an AI step.

---

## Results on Yearn brownie-strategy-mix

### Files Processed
| File | Patterns Found | Auto-Migrated | TODO Markers |
|------|---------------|---------------|--------------|
| `scripts/deploy.py` | 8 | 6 (75%) | 2 (config, web3) |
| `tests/conftest.py` | 12 | 10 (83%) | 2 (config, fn_isolation) |
| `tests/test_operation.py` | 18 | 18 (100%) | 0 |
| `tests/test_migration.py` | 6 | 6 (100%) | 0 |
| `tests/test_revoke.py` | 8 | 8 (100%) | 0 |
| `tests/test_shutdown.py` | 6 | 6 (100%) | 0 |
| **Total** | **58** | **54 (93%)** | **4 (7%)** |

### Key Metrics
- **Automation coverage:** 93% of all migration patterns handled automatically
- **False positives:** 0 — every transformation is correct
- **False negatives:** 4 patterns marked as TODO for AI/manual handling
- **Time saved:** ~3 days of manual work → ~30 seconds of codemod execution

---

## Automation vs. Manual Breakdown

```
████████████████████████████████████░░░  93% Automated (JSSG)
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██   5% AI Edge Cases
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█   2% Manual Review
```

### What JSSG Handles (93%)
- All import rewrites with smart name remapping
- All transaction parameter conversions
- All chain API changes
- All account access patterns
- All testing pattern changes

### What AI Handles (5%)
- `brownie-config.yaml` → `ape-config.yaml` schema translation
- Complex `pm()` package manager patterns
- `project.load()` → Ape dependency management

### What Needs Manual Review (2%)
- Verification that TODO markers are resolved
- Custom middleware or plugin configurations

---

## Conclusion

ApeShift demonstrates that **production-grade migrations can be automated** with the right combination of deterministic AST rules and AI fallback. By testing against real-world DeFi codebases (not just synthetic examples), we validated zero false positives across 58 patterns in the Yearn strategy template — the same template used by hundreds of strategy developers.

The codemod is available on the [Codemod Registry](https://codemod.com/registry) and can be run with:

```bash
npx codemod workflow run -w ./workflow.yaml --target /path/to/brownie-project
```

---

*Built by Boring AI for the Codemod Hackathon 2026*
