# RankReserve

A contract-only primitive for distributing a scarce native GEN reserve among
co-ratified future-payment promises. Validators interpret semantic seniority;
contract code applies the bounded proportional waterfall and owns withdrawal credits.

Status: admission selected; implementation, finalized lifecycle, public CI and
submission readiness are pending. No app, external debt proof or adoption claim.

The model cannot choose amounts or recipients. The exact promises, priority charter,
payees and deadlines are immutable, and every named payee must ratify the complete
definition before review. Read the [specification](docs/README.md).
