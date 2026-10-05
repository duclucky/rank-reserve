# Independent contract review

Scope: one reusable reserve/judgment/accounting primitive; no application.
Review is based on the current exact contract, direct tests and target runtime
smoke. Final lifecycle and submission findings remain pending until verified.

| Criterion | Finding | Evidence |
| --- | --- | --- |
| Meaning, not JSON format | Independent classification and full normalized per-ID vector comparison; differing priority classes reject, rationale changes agree | review_pool validator_fn; test_actual_validator_replays_meaning_and_ignores_prose; malicious leader tests |
| Clear state | Keyed pools, claims, credits, append-only attempts and explicit transitions | storage classes and canonical views; isolation and terminal-state tests |
| Authentication | Sender-checked, exact-definition assent to constitutive terms; no external work proof is accepted | ratify_claim; digest/signer/entity tripwire tests; Evidence Authority Matrix |
| Settlement invariants | Exact ID coverage/enums before mutation; deterministic tier budget, face caps and residual destination | _normalize/_waterfall; malformed, duplicate, injection and proportional tests |
| Entry-local time guards | create/ratify/review/expire each checks transaction time independently of phase; equality is late for ratify/review | temporal boundary tests with stale phase; AST checks |
| Recovery and accounting | Pending expiry refunds sponsor; only own terminal credit can withdraw; close requires zero liabilities | safety matrix tests, refund-withdraw-close and invariant corruption tests |
| Transfer boundary | EVM proxy emits exact credit after debit; native proof is additionally required | test_withdraw_emits_exact_evm_recipient_after_ledger_debit; live proof pending |
| Reuse and novelty | Generic isolated pools and canonical views for three proposed coordinators; reserve priority differs from debt netting, bid selection and capability grants | API and analogue matrix in specification |
| Honest limits | Promises define future payment rights; no external delivery/debt/legal/adoption guarantee | README and scope policy |

Safe improvements applied: raw text JSON preserves duplicate-key detection;
noncritical reasons are discarded; receipt projection handles raw and normalized
SDK enums; negative coverage includes outsiders, terminal states, corrupt
accounting and the seven-day bound. No public contract behavior was changed during
the review criteria and no rule or grading implementation was weakened. During
live validation, an underspecified output instruction produced nested class
objects. The strict parser rejected them before mutation. The prompt now states
that every mapping value is a plain enum string and reason is top-level only;
public semantics, schema and payout rules are unchanged. Three additional
malformed-output cases preserve rejection. The old revision was fully recovered
and archived; the replacement must independently pass its full lifecycle.

Tooling issue diagnosed with a controlled unsigned comparison: the default Studio
write simulation returns invalid future deadlines; the identical call with explicit
simulation time succeeds, with canonical accounting/native balance unchanged.
The official Studio node/endpoints path omits transaction_datetime for default
write simulations, whereas submitted transactions provide created_at. Fee
profiling therefore uses timestamped unsigned sim_call and the official two-step
estimateTransactionFeesFromSimulation flow. Signed writes have no sim_config.

References: [GenLayer SDK migration](https://sdk.genlayer.com/main/executors/v0.3/python-sdk/migration-guide.html),
[two-step fee estimation](https://github.com/genlayerlabs/genlayer-js),
[Studio source](https://github.com/genlayerlabs/genlayer-studio),
[ODRL model](https://www.w3.org/TR/2018/REC-odrl-model-20180215/).
ODRL is design context, not a payment or performance authority.

Novelty is a bounded survey finding, not proof of universal originality. Prior
local primitives were compared across seven fingerprint dimensions; the closest
overlap is two broad dimensions with SemanticSetoff/TenderSeal/IncidentScope.
RankReserve was authored independently as a complete priority-reserve lifecycle;
it is not a lesson or a carved-out module of an already-submitted application.
