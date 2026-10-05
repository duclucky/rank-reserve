# RankReserve specification

## Identity

IDEA-038, RankReserve, rank-reserve, Intelligent Contracts. Status DESIGN.
Target Studio Dev, chain 61997, RPC https://studio-next.genlayer.com/api.
Public repository PENDING_PUBLICATION. Real lifecycle PENDING_EXECUTION.
No app or frontend. The contract owns judgment, accounting and enforcement.

## One-sentence product hook

Ratify exact future-payment promises, then let independent semantic consensus
determine their priority before code distributes a scarce GEN reserve.

## Trust problem and fingerprint

Neither sponsor nor competing payees should interpret the priority charter alone.
Replacing consensus with a signed database or one backend model loses neutral
adjudication of meaning controlling the funded distribution.

1. Trust problem: neutral seniority interpretation before scarce reserve allocation.
2. Actors/adversary: sponsor and 2-4 distinct named payees competing for reserve.
3. Evidence class + authenticity mechanism: immutable constitutive charter and
   future promises, authenticated funding and exact-definition wallet ratification.
4. Consensus question: PRIORITY, STANDARD or UNVERIFIABLE for each exact promise.
5. State machine: RATIFYING -> READY -> SETTLED or RETRYABLE; pending -> REFUNDED;
   zero-liability terminal pools -> CLOSED; append-only attempt history.
6. Direct consequence: senior tiers exhaust actual reserve first, equal tier shares
   proportionally; code opens bounded native-GEN credits and withdrawal rights.
7. Reuse surface: isolated pools, claim/attempt/credit/accounting views and public
   create/ratify/review/expire/withdraw/close methods.

## Mandatory gate matrix

All fourteen admission findings were recorded before production code in the
parent admission record. This public specification includes the rationale.

| Gate | Status | Reason |
| --- | --- | --- |
| Replacement | PASS_ADMISSION | EVM/database cannot neutrally interpret qualitative priority |
| Judgment | PASS_ADMISSION | Semantic class of promise under exact charter |
| Evidence availability | PASS_ADMISSION | Locked state is available to validators; unsigned target spike SUCCESS twice |
| Evidence authenticity | PASS_ADMISSION | Constitutive state, sender role and exact definition ratification; authority matrix below |
| Equivalence | PASS_ADMISSION | Independent replay of complete class vector; prose ignored |
| Consequence | PASS_ADMISSION | Native GEN reserve becomes class-derived bounded credits |
| Adversarial | PASS_ADMISSION | Sponsor refund versus payee seniority incentives |
| State model | PASS_ADMISSION | Keyed storage, locked definition, attempts, temporal guards, zero closure |
| Reuse | PASS_ADMISSION | Three named proposed consumers and API below |
| Contract count | PASS_ADMISSION | One necessary reserve/judgment/enforcement state owner |
| Differentiation | PASS_ADMISSION | Priority waterfall, not debt netting, bid ranking or execution grants |
| Claim-to-code | PASS_ADMISSION | Complete planned matrix below |
| Full lifecycle | PASS_ADMISSION / PENDING_EXECUTION | All acceptance branches specified; live evidence required |
| Scope honesty | PASS_ADMISSION | Constitutive escrow promises, no external debt/service/legal proof |

## Actors, roles and incentives

| Actor | Permissions | Value at risk | Bias incentive |
| --- | --- | --- | --- |
| Sponsor | Create, review, expire, withdraw own residual/refund, zero-close | Actual 1-100 whole GEN reserve | Prefer refund or one allocation |
| Named payee | Ratify exact pool definition, review, withdraw own credit | Potential face-limited payment right | Prefer senior classification |
| Validator | Independent semantic evaluation | Protocol role, no application custody | Must compare meaning |
| Proposed consumer | Call views and register signed actions through its own authority | Integration-dependent | Cannot replace canonical state |

## Scope and non-goals

In scope: funded constitutive priority-payment promises, 2-4 payees, two tiers,
proportional partial distributions, exact accounting, bounded retries and expiry.
Out of scope: legal insolvency/debt adjudication, completed work, title/identity,
private evidence, external payment receipts, cross-chain proofs, apps, adoption.
Product/frontend blueprint and frontend lifecycle matrix: N/A, contract-only.

## State model

Pool IDs 1-64 ASCII [A-Za-z0-9_-]. Claims use pool:index, index 0..N-1.
Charter 1-1600 ASCII characters. Promise scope 1-1000 ASCII characters.
Definitions are immutable; no updates/overwrites. Payees distinct, nonzero,
different from sponsor. Face values 1-100 whole GEN, passed as face_gen integers.
Actual reserve 1-100 whole GEN, total face must exceed actual reserve.
Pool creation claims are JSON array of exact objects payee/face_gen/scope.
Scope describes a future undertaking; it is not evidence of completion.

Storage: @gl.storage.allow dataclasses Pool and Claim; str-keyed TreeMap pools,
claims, per-pool/address credits and immutable attempt records. bigint for exact
money and counters; collections declared at class body. Global received, locked,
credits and withdrawn counters reconcile every pool.

Canonical time: gl.message.datetime parsed as timezone-aware datetime. No missing,
naive or invented time fallback. Creation requires now < ratify < review <= now+7d.
Ratify requires now < ratify deadline; review requires now < review deadline.
Equality is late. Expire requires now >= review deadline, equality permitted.
Each affected write calls the time guard itself, even when phase is stale.

RATIFYING -> READY only when all exact named payees ratify. READY/RETRYABLE ->
SETTLED only from valid complete semantic classes with no UNVERIFIABLE. Review
UNVERIFIABLE -> RETRYABLE with unallocated reserve. Max 2 recorded attempts.
Technical UNDETERMINED leaves state unchanged; diagnose before retry.
RATIFYING/READY/RETRYABLE -> REFUNDED by sponsor at review expiry.
SETTLED/REFUNDED -> CLOSED by sponsor only after locked and all pool credits zero.
No writes accept new value except creation. No settlement or refund twice.

## Write-method safety matrix

This matrix is locked before implementation; there are six public writes.

| Method | Caller | Allowed states | Forbidden states | Temporal/expiry gate | Idempotency | Value/accounting effect | Views affected | Negative tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create_pool | Funding sender becomes sponsor | Absent pool | Existing ID; invalid roles/claims/value | now < ratify < review <= now+7d | Duplicate ID rejects | Actual reserve received/locked exactly once | pool, claim, accounting | Duplicate, wrong roles, zero/dust/excess value, invalid JSON/IDs, past/equal/>7d |
| ratify_claim | Exact named payee | RATIFYING | READY, RETRYABLE, terminal, duplicate signer | now < ratify; equality late even stale RATIFYING | Duplicate rejects | No value; records exact definition assent | pool, claim | Outsider/sponsor, wrong pool/digest/version, deadline -1/0/+1, duplicates/closed, unchanged accounting |
| review_pool | Sponsor or any named payee | READY, RETRYABLE; all ratified; attempts<2 | RATIFYING, SETTLED, REFUNDED, CLOSED, exhausted | now < review; equality late even stale READY/RETRYABLE | Terminal repeat rejects; bounded append-only retries | Complete class vector allocates reserve once or no consequence on UNVERIFIABLE | pool, claim, attempt, credit, accounting | Wrong caller/state, invalid coverage/classes, semantic mismatch, expiry boundaries, closed/duplicate/exhausted, unchanged GEN on rejection |
| expire_pool | Sponsor | RATIFYING, READY, RETRYABLE | SETTLED, REFUNDED, CLOSED | now >= review; equality expired; partial assent allowed because expired rights end | Repeat rejects | Whole unallocated reserve becomes sponsor refund credit once | pool, sponsor credit, accounting | Wrong actor/state, deadline -1/0/+1 with stale phases, partial assent, duplicate/closed, no double refund |
| withdraw_credit | Credit owner transaction sender | SETTLED, REFUNDED with own positive credit | Pending, CLOSED, zero or foreign credit | N/A: terminal liabilities remain withdrawable forever | Cleared credit rejects duplicate | Debit credit/liability, increment withdrawn, EVM transfer own address on finalized | credit, claim, pool, accounting | Wrong actor/state/zero, double withdrawal, closed, exact emitted recipient/value, unchanged rejection accounting |
| close_pool | Sponsor | SETTLED, REFUNDED with zero locked/pool credits | Pending, nonzero liabilities, CLOSED | N/A: closure depends on liability, not age | Duplicate rejects | No value; explicit zero-liability closure | pool, accounting | Wrong caller/state, open credits, duplicate/closed, unchanged ledger |

## Evidence policy

Authority is the exact constitutive state accepted by the named wallets. A hash
binds assent to those bytes; transaction authentication supplies the authority.
A hash alone never authenticates outside delivery/debt. No evidence URL, uploaded
receipt, remote JSON, signature string or screenshot input is accepted as proof.
Each pool/version/claim/payee/deadline is in canonical definition digest. Unique
pool ID and one assent per payee block replay. Ratification timestamp is canonical
transaction time; no claimed timestamp or external signer parser is used.
Source version RR_V1 is immutable. URL/domain policy N/A: no consequential web fetch.
W3C ODRL was fetched during feasibility as design context only.
Missing assent blocks review; conflicting/ambiguous semantic meaning records
UNVERIFIABLE and allocates nothing. Missing model/source response is an execution
error/undetermined, never fabricated success. Private evidence excluded.
Untrusted scope text is delimited JSON data; cannot change charter, IDs, payees,
face amounts, reserve, authority or destination rules. Model never supplies these.

### Evidence Authority Matrix

| Consequential claim/fact | Evidence/artifact | Data controller | Authoritative source/issuer | Deterministic verification | Canonical objective/entity/actor binding | Freshness/anti-replay | Semantic role after verification | Non-penalizing failure state | Consequence blocked | Required negative test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Actual funded priority-payment promises | Locked pool charter, exact claims and reserve | Sponsor authors; payees must ratify | Contract constitutive state and funding transaction | Claim schema, roles, value, version and immutable digest; no external fact accepted | Pool ID/index, sponsor/payee, charter, face, deadlines/version in digest | Unique pool ID; creation time window; no edits | Interpret promised activity under charter | Reject creation/assent or UNVERIFIABLE without allocation | Credit, settlement and transfer | Matching digest in other pool, extra authority/recipient fields, counterfeit external performance body cannot open consequence |
| Named payee accepts exact definition | Ratify transaction and canonical digest | Named wallet controls assent | Network signature plus sender checked against locked payee | sender equals payee; full definition digest equality; valid phase/time | Exact pool/index/payee/version already locked | One assent; transaction now < deadline | Opens review readiness, never proves work occurred | Revert, canonical state unchanged | Review readiness and allocation | Forged signer, duplicate/replayed/wrong entity/version/digest, stale timestamp at boundary; ledger unchanged |

## Consensus design

Leader captures all state into bounded immutable locals before nondeterminism.
Prompt treats scope and charter as constitutive interpretation input, explicitly
excludes factual debt/work verification, lists exact claim IDs and all three enums.
Model returns JSON text with classes mapping every expected ID exactly once plus optional reason.
Use response_format=text to preserve duplicate keys; the pinned SDK's JSON mode
parses before contract normalization and would otherwise hide duplicate keys.
Normalization rejects extra/missing/duplicate semantic IDs, invalid classes, unknown
consequence fields (payout/payee/amount/rank) or unsupported coverage. The expected
IDs and coverage are code-derived. Optional prose is discarded from equivalence
and discarded rather than stored; prose cannot fail consensus.

| Critical field | Bounds | Comparison rule | Why critical |
| --- | --- | --- | --- |
| Class vector | 2-4 fixed IDs; PRIORITY/STANDARD/UNVERIFIABLE | Independent replay compares normalized tuple per canonical ID | Determines tier waterfall |
| Coverage/identity | Full exact canonical IDs, no duplicates | Deterministic validation before comparison/settlement | No extra or missing creditor |
| Rationale | Optional text within the bounded raw answer | Discarded; ignored in equivalence | Wording changes no right/value |

Validator returns False unless candidate is gl.vm.Return. It independently reruns
the same prompt and normalizes its own answer; malformed output or meaning mismatch
disagrees. gl.vm.run_nondet_default provides sandboxed comparison. Comparing the
normalized enum vector expresses agreement on meaning; never compare raw JSON blobs.
Invalid leader data rejects before mutation; no format-only acceptance.
UNVERIFIABLE is non-penalizing, bounded retry with reserve intact; expiry recovery
always remains available. Do not retry a semantic ambiguous promise until accepted
public-behavior policy for revision exists; v1 has no definition edits.

## Consequence and accounting

PRIORITY tier first, then STANDARD. For each tier take min(reserve remaining,
tier face total). Each payee gets floor(tier budget*its face/tier face total).
All rounding residual is sponsor credit. Each payee is capped by its face; no
model-specified amount, payee or rank. Total allocations+residual = actual reserve.

| Verdict | Canonical state change | Consumer action | Value movement |
| --- | --- | --- | --- |
| Full known classes | SETTLED, store exact classes and attempt | Read finalized priority/credit views | Reserve -> deterministic credits |
| Any UNVERIFIABLE | RETRYABLE, append attempt only | Diagnose or wait expiry | No allocation or transfer |
| Invalid output/technical failure | No mutation | Diagnose; do not assume attempt advanced | No movement |
| Expiry | REFUNDED, pending reserve zero | Sponsor reads refund credit | Reserve -> sponsor credit |
| Withdrawal | Own credit cleared once | Verify finalized child and native deltas | Credit -> own EOA |
| Zero close | CLOSED | Stop new operations | No liability/value remaining |

Ledger: total_received = total_locked + total_credits + total_withdrawn.
Each pool received = pool locked + pool credits + pool withdrawn. Nonnegative.
Accepted semantic write commits ledger consequence; lifecycle tooling waits for
successful FINALIZED and canonical reads. External EVM transfer is emitted after
debit through the pinned EVM proxy, whose emit_transfer has no on parameter.
Finalized parent and child plus exact native decrease and recipient/fee/child
receipt proof mandatory. A successful parent/zero ledger alone is insufficient.
No cure/restore/appeal API; protocol appeals remain external protocol behavior.

### Value-destination matrix

| Value item | Payer/source | Locked state | Release destination | Refund destination | Forfeit destination | Terminal states covered | Duplicate/late/retry behavior | Canonical proof view |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Actual funded reserve | Sponsor 1-100 whole GEN | RATIFYING/READY/RETRYABLE | Named payees by deterministic tier/face waterfall | Sponsor at expiry | N/A: no penalties | SETTLED/REFUNDED/CLOSED | Duplicate allocation rejects; late review rejects; retry retains entire reserve | pool/accounting |
| Senior/standard credits | Allocated reserve | Terminal pull liability | Each exact named creditor to own EOA | N/A: credit remains withdrawable forever | N/A | SETTLED/withdrawn/CLOSED | No double credit/withdraw; zero prevents close until withdrawn | claim/credit/accounting |
| Rounding residual | Integer pro-rata division | Terminal sponsor credit | Sponsor own EOA | Same sponsor, no alternate destination | N/A | SETTLED/withdrawn/CLOSED | Calculated once; no actor/model-supplied destination | sponsor credit/pool/accounting |
| Partial/no-ratification or unresolved reserve | Actual sponsor deposit | Pending until expiry | N/A: no unverified payee release | Whole unallocated reserve to sponsor credit | N/A | REFUNDED/withdrawn/CLOSED | Sponsor/time guard; duplicate refund rejects | pool/sponsor credit/accounting |
| Emitted withdrawal | Debited terminal credit | Finalized child message | Sender's own EOA only | No automatic failed-child refund assumed | N/A | Successful child plus zero close | Never resend ambiguous transfer; read status/balance first | native balances, child receipt, credit |

## Reusable interface

Writes: create_pool(pool_id,charter,claims_json,ratify_deadline,review_deadline)
payable; ratify_claim(pool_id,definition_digest); review_pool(pool_id);
expire_pool(pool_id); withdraw_credit(pool_id); close_pool(pool_id).
Views: get_pool(pool_id), get_claim(pool_id,index), get_attempt(pool_id,attempt),
get_credit(pool_id,address), get_accounting(), get_pool_ids(). Views return JSON
with GEN-denominated human amounts; storage/SDK exact values remain internal.
No consumer callback: single necessary state owner. Consumers wait finalized,
reload canonical views and call through their own named authority.
Proposed consumers (not adoption): Safe treasury reserve adapter, DAOhaus
grant-budget distributor, LangGraph multi-agent compensation coordinator.

## Threat model and test plan

Tests cover input/type/role/entity isolation; immutable terms and exact ratification;
correct-digest wrong-signer/entity/version and fabricated external artifacts;
prompt injection attempting to redefine authority or payout; all class mappings;
leader schema/semantic mismatch and independent validator replay; missing/duplicate/
extra classes; no mutation on invalid output; integer waterfall/face cap/remainder;
every safety-matrix negative; temporal -1/equality/+1 with deliberately stale phase;
global/pool invariants and zero closure; payable metadata and nonpayable value;
raw/normalized receipt parser. Direct mode is not GenVM consensus; exact-source
target smoke and finalized lifecycle required. No critical test skip permitted.

## Claim-to-code matrix

| Claim | Contract method/state | View/read | Test | Network evidence |
| --- | --- | --- | --- | --- |
| Co-ratified immutable promises | create_pool/ratify_claim, digest/readiness | pool/claim | roles/digest/replay/immutability | Planned creation and each ratification receipt+reads; PENDING_EXECUTION |
| Meaning controls seniority | review_pool/full classes/attempts | attempt/claim/pool | independent replay, disagreement/prose invariance | Planned finalized judgment and canonical vector; PENDING_EXECUTION |
| Capped proportional waterfall | review_pool/private allocation/credit | credit/accounting | senior/equal, face cap, residual, no double settlement | Planned 2 GEN senior and equal cases; PENDING_EXECUTION |
| Safe expiry/refund | expire_pool | pool/sponsor credit | wrong role/state/time -1/0/+1, partial assent | Planned expiry recovery receipt/read; PENDING_EXECUTION |
| Real withdrawal and zero closure | withdraw_credit/close_pool | credit/pool/accounting | wrong role/state/double/open-liability, EVM boundary | Planned exact native decrease, recipient/fee/child proof; PENDING_EXECUTION |

## Analogue and differentiation matrix

| Analogue | Material overlaps | Structural difference | Decision |
| --- | --- | --- | --- |
| SemanticSetoff | Ratified promises and multiparty actors (2) | Priority reserve waterfall rather than debt cancellation/netting | Distinct |
| TenderSeal | Funded allocation and meaning (2) | No bids/prices/winner; all ratified payees have face-capped tier claims | Distinct |
| IncidentScope | Pool/classification (2) | Constitutive priority, no incident applicability claim | Distinct |
| GrantLattice/PolicyQuorum | Transaction authority (1) | No access delegation or execution authorization | Distinct |
| ConcordBatch/CycleWarrant | Bounded semantic vector (1) | No action scheduling or ownership permutation | Distinct |
| Internet Court/Intelligent Oracle | Consensus (1) | Full tier vector plus capped waterfall, not generic dispute or prediction | Distinct |

## Deployment/evidence plan and Definition of Done

Use three existing authorized EOAs from ignored project .env first, then parent
.env. No new account or funding transaction without action-time authorization.
Python3.12 repository .venv, pinned dependencies, PYTHONUTF8=1. Lint exact source,
ASCII/header/metadata scan, direct tests, parser tests, gltest and npm run check.
Unsigned exact-source constructor/method smoke precedes value-bearing lifecycle.
Deploy on Studio Dev D1, verify SUCCESS/schema, bind source commit/hash/API/chain.
Run 2 GEN reserve senior allocation, equal-tier 1 GEN each, and expiry/refund.
Record only allowlisted receipts/views/public addresses/GEN/native deltas in
docs/evidence/studio-dev; separate local proof. Scripts resume by canonical state
and pending hashes, never replay confirmed deposit/withdrawal. Superseded identity
archived; broken revision abandoned, no further value per replacement rule.

Done only with one reusable contract; meaningful independent validator; direct
consequence/reuse interface; safety/adversarial/metadata/parser tests passing;
full finalized lifecycle/recovery and exact balance proof; public clean repo with
incremental history/green CI; complete verified Portal fields; unchanged grading
command -Category intelligent-contracts and active ExplorerUrl reports NO BLOCKER;
final master-prompt reread item-by-item. Do not click Portal Submit.

## Honest limits, adoption path and kill criteria

Constitutive escrow promises only. No external debtor ownership, delivery,
insurance, legal authority, cross-chain proof or adopter. Model ambiguity stays
unallocated/retryable. Global confidentiality and strategy-proofness unclaimed.
Next milestone: measured fee profiles and a real treasury consumer integration.
Stop/reject on missing authentication, single-party semantic verdict, incomplete
coverage, bypassed ratification/time guards, duplicate/orphan value, target-runtime
incompatibility, weak novelty, failed exact semantic spike or missing final evidence.
