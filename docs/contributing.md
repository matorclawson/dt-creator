# Contributing

ZEO Creator is strict about boundaries because a convenient shortcut in creator
code can become an authority or credential leak in production.

## Set up

```console
git clone https://github.com/zeroemployeeorg/zeocreator.git
cd zeocreator
uv sync --frozen
make verify
```

## Useful commands

| Command | Purpose |
|---|---|
| `make verify` | Lint, strict type-check, test, regenerate references, and build docs |
| `make examples` | Run every public example |
| `make docs-serve` | Serve the documentation with live reload |
| `make reference` | Regenerate JSON schemas and neutral reference artifacts |
| `make doctor` | Check Python, Zeocore, manifests, and projections |

## Architecture rules

- Capabilities, contracts, and services must not import provider SDKs or runtime
  products.
- Credentials must never enter a request, response, artifact, log, exception,
  manifest, proposal, or receipt.
- Read dependencies arrive through named `ToolContext.services` ports.
- Distribution construction performs no external write.
- Cross-publication identity mismatch is a blocking failure.
- Durable changes require new revisions and digests.
- Do not add a monolithic daily runner or scheduler.

## Change a contract

1. Update the Pydantic contract and capability models.
2. Update examples and error declarations.
3. Add failure-path and compatibility tests.
4. Run `make reference` to regenerate schemas.
5. Update the relevant guide and API reference.
6. Run `make verify` from a clean environment.

## Documentation standard

Examples must be executable and credential-free. Prefer one complete copy-paste
path before explaining every option. Keep conceptual rationale separate from
task-oriented how-to guides and generated API reference.

## Safety

Tests and examples must never contact a live provider or require a reusable
credential. PyPI publication and provider effects require separate operator
approval.

## Astro integration preparation

`integrations/astro/` is a private Node24 ESM package beside the pure publication core. Its named
core import projects caller-owned documents into canonical source/head expectations; caller-policy
OG and normalized-head audits check observations. No clock, layout, brand, asset-size default or
implicit build policy is supplied. The optional structural astro:build:done hook invokes explicit caller observation/report ports, admits only audited artifact URLs and wraps refusal/port errors without observed content. It never reads output files or infers SSR completeness. Core and Python distributions remain independent.

Run `make verify-astro-integration` with the admitted Node24 and npm executable. Its local candidate
gate packs both JS packages, installs the explicit tarballs offline with scripts disabled, checks
physical named-import resolution and runs behavior/refusal tests. Set TMPDIR to owned scratch on
ZeoWork on the operator host. This is candidate qualification, not publication or a consumer release.
Hand-authored declarations receive export-name checks only, not compiler qualification.

The complete `make verify` and `make doctor` still apply to the actual final merge result. The
implementation PR follows33/34 and one-ready-row sequencing; no JavaScript publishing job is added.
Future owner-issued integration tags use their own `astro-integration-v*` namespace.
