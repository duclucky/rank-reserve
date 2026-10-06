# RankReserve

RankReserve distributes a scarce native GEN reserve among co-ratified future-payment
promises. Independent validators interpret seniority under an immutable priority
charter; deterministic code applies a face-capped proportional waterfall.

This is a reusable Intelligent Contract primitive. Proposed integrations are a
Safe treasury reserve adapter, a DAOhaus grant-budget distributor and a LangGraph
multi-agent compensation coordinator. These are integration targets, not adopters.
The repository contains one contract and no user-facing app.

## How meaning controls the money

The sponsor deposits a whole-GEN reserve and locks 2-4 distinct payees, face limits,
exact promised activities, charter and deadlines. Each named payee ratifies the full
definition digest through a sender-checked transaction. Review requires all assents.

The leader classifies every canonical claim ID as PRIORITY, STANDARD or UNVERIFIABLE.
The sandboxed custom validator independently repeats the interpretation and compares
the complete normalized class vector. Different rationale wording is allowed;
different seniority decisions disagree. Strict JSON-text normalization rejects
duplicate, extra or missing IDs, unknown classes and model-supplied payout fields.
The model never chooses amounts or recipients.

Code funds PRIORITY before STANDARD. Equal tiers share their bounded budget in
proportion to face limits; each credit is capped at its face. Integer rounding
residual goes to the sponsor. Any UNVERIFIABLE result leaves the entire reserve
locked with no allocation, records an attempt and preserves expiry recovery.
Invalid output rejects without state or accounting mutation. Pending pools refund
the sponsor at expiry; terminal credits remain withdrawable by their owner.

## Public interface

| Write | Purpose |
| --- | --- |
| create_pool | Deposit GEN; lock charter, promises, payees, faces and deadlines |
| ratify_claim | Named payee assents to the entire immutable definition |
| review_pool | Registered party requests independent semantic consensus |
| expire_pool | Sponsor recovers an unallocated reserve after expiry |
| withdraw_credit | Credit owner emits native transfer to their own EOA |
| close_pool | Sponsor closes a terminal pool with zero liabilities |

Views: get_pool, get_claim, get_attempt, get_credit, get_accounting, get_pool_ids.
Amounts in views and examples are GEN. Consumers wait for successful FINALIZED,
then reload canonical views. Consensus status alone does not prove execution success.

## Deployment

NETWORK = Studio Dev; chain ID 61997.

CONTRACT_ADDRESS = `0x5cE19ec2f4be4fdfE86D6Ea152396d8b1787e1Df`.

[Contract explorer](https://explorer-studio-dev.genlayer.com/address/0x5cE19ec2f4be4fdfE86D6Ea152396d8b1787e1Df)
and [deployment transaction](https://explorer-studio-dev.genlayer.com/transactions/0x84b3ce67e91f385ab82cd3acaea8d44d5d7a4091b67efddf5bf403d646ff845b).
Result: SUCCESS; Status: FINALIZED. Exact deployed source matches source commit
463918c444006bedfe57b340ec00a207cd9da250; schema recognizes 6 writes and 6 views.
The [deployment identity](docs/evidence/studio-dev/deployment.json) binds source,
runner, network and address. Both explorer URLs returned HTTP 200.
The [superseded revision](docs/evidence/studio-dev/superseded/revision-179817e.json)
was fully recovered: all 8 GEN withdrawn, four pools CLOSED, native balance 0 GEN.

Real finalized worked examples: each pool holds a 2 GEN reserve against two
2 GEN faces. The immutable charter prioritizes restoration of an unavailable
existing production service over optional new features. Named payees ratified
the full definition before each review. All three reviews used five validators,
leaderOnly=false and MAJORITY_AGREE.

| Case | Finalized meaning | Result |
| --- | --- | --- |
| Restore authentication / add themes | PRIORITY / STANDARD | 2 GEN / 0 GEN credits; withdrawal proved; CLOSED |
| Restore authentication / restore data access | PRIORITY / PRIORITY | 1 GEN each; both withdrawals proved; CLOSED |
| No ratification | No judgment | Expiry refunded sponsor 2 GEN; withdrawal proved; CLOSED |
| Unspecified activity in absent annex / add themes | UNVERIFIABLE / STANDARD | RETRYABLE with 2 GEN locked and 0 GEN credits; expired, refunded, withdrawn and CLOSED |

Full lifecycle: PASS_EXECUTION. Read-only verification confirms 25 successful
finalized receipts, five exact native withdrawals, 8 GEN received and withdrawn,
zero locked/credit liabilities and native balance 0 GEN. See
[lifecycle evidence](docs/evidence/studio-dev/lifecycle.json) and
[fresh re-verification](docs/evidence/studio-dev/reverification.json).

## Verification and tooling

Use Python 3.12 and Node 22 or later. Create the repository .venv, install
requirements-dev.txt, run npm ci, then npm run check. It runs semantic GenVM lint,
ASCII/header/payable/temporal metadata checks, direct tests, receipt parser tests
and script syntax checks. Current local result: 91 Python tests and 17 Node tests
pass. Direct mode is not finalized Studio consensus.

The pinned linter predates the v0.3 run_nondet_default rename. The small
scripts/genvm_lint_rc.py adapter adds that sandboxed API to the existing safe
entrypoint reachability checks; it removes no checks and changes no grading rules.
The Windows fixture adapts stdin cleanup and resets the SDK contract registry
between isolated deployments. Runner and SDK remain pinned together.

Configuration loads ignored project .env before the authorized parent .env.
Scripts expose no keys or complete receipts. node scripts/studio-dev.mjs preflight
is read-only; smoke is an unsigned constructor/schema simulation; deploy signs
a fee-bearing deployment. node scripts/lifecycle.mjs signs bounded 2 GEN examples
and resumes from canonical views and recorded pending hashes. Use only explicitly
authorized wallets and network/value actions.

Studio's default unsigned write simulation lacks the transaction timestamp needed
by temporal guards. Fee profiling uses an explicit current timestamp in unsigned
sim_call, then estimateTransactionFeesFromSimulation. Signed writes contain no
clock override and enforce the network transaction timestamp. Diagnostic evidence
records the default failure and timestamped SUCCESS without changing the contract.

## Trust boundary and limits

Evidence is the exact constitutive promises ratified by the named wallets.
The digest binds those terms; it does not prove external debt, completed delivery,
identity or legal priority. No uploaded receipt, external evidence URL or
claimant-hosted JSON is accepted as a performance attestation. Quoted scope text
cannot redefine authority, IDs, charter, amounts or recipients.

Withdrawals debit the ledger before the pinned EVM interface emits value.
A successful parent or zero credit alone is insufficient: tooling requires the
exact native contract-balance decrease, recipient balance and fee evidence,
and any triggered child receipts. Failed emitted transfers have no automatic
compensation mechanism; a broken revision must receive no further value.
No production-security, legal, adoption, browser-wallet or cross-chain claim is made.

Read the [specification and threat model](docs/README.md) for safety rows,
the Evidence Authority Matrix, value destinations and temporal boundaries.
