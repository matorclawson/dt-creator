# Astro-facing publication integration — private preparation

SOW: zeroemployee SOW-112. Home: integrations/astro under the Architect ruling. The package name/version are provisional, private and unreleased; future owner-issued tags use a separate astro-integration-v* namespace, never Python v*.*.* or publication-core-v*. No publication job or site adoption is implied.

The package named-imports publication-core and builds source-derived route/head expectations with createPublicationManifest. Supply site identity/slash convention, documents, core projection schema/clock/selection and describePage(entry) returning explicit title, description, HTTPS image and indexability. Canonical URLs come from the core result; only its selected public entries receive head expectations. Output is immutable. No evaluation clock, brand suffix, access classification or content threshold is supplied here.

The exported auditOgArtifacts and auditPageHead consume explicit caller policy and trusted normalized observations. The OG audit requires expected SHA-256 of file bytes, completed decode observations, format, decoded dimensions, bytes and pixel hashes; callers own size, origin, budget and uniqueness. Raw pixel hashes require consistent colour/channel representation before visual comparisons. The head audit compares independent expected source metadata with decoded HTML head tags, preserving missing/duplicate/empty/mismatch and indexability failures. It does not parse HTML. Every expected image URL must be qualified by the caller's artifact policy before admission to head policy. A URL list alone is not byte integrity evidence.

The optional createAstroPublicationIntegration export installs a structural astro:build:done hook when explicitly configured by the caller. It has no Astro dependency, HTML parser, image decoder, filesystem traversal or layout. Callers supply complete actual build observations and a report port; native adapters need their own agreed scope. Site identity, retained-default exceptions, asset sizes, editorial text, freshness rules and authoring choices stay in each site. Original full-site and installed-consumer acceptance remains separate.

The gate packs both private packages, installs the two explicit tarballs offline in an isolated consumer and runs behavior tests through named installed imports. It also checks package exports, Node24, runtime boundaries and Python archive exclusion. This is local candidate proof, not owner-issued versioned release. Hand-authored declarations are checked for runtime export names only; no compiler/type soundness claim.

The runtime forbidden-word/import scan is deliberately coarse: it rejects terms such as process and provider as well as direct effect imports, not just executable calls. It is not a semantic module/security parser. Keep it strict for this pure slice; the later separately reviewed native-hook slice must replace it with an appropriate boundary check, rather than weakening it ad hoc. The reverse-dependency guard recursively scans all non-test .mjs and .d.ts files in publication-core. The gate also checks the integration's exact dependency against the actual core manifest version.

The gate accepts an NPM executable through `make NPM=/path/to/npm verify-astro-integration` and records its actual version and major without pinning a major. A missing executable fails clearly before packaging.

Build-hook options are explicit: manifest from createPublicationManifest, observeBuild(context), headPolicy with pageOrigin/twitterCard, and onReport(report). The observer receives the exact hook context unchanged; no dir/logger access occurs here. Return {complete:true,heads:[{path,elements}],artifactGroups:[{id,expected,observed,policy}]}. An incomplete marker, missing/duplicate/extra route observation or any artifact/head failure refuses. Group IDs and expected URLs are unique across profiles. Only successful audited artifacts populate head image admission. All configured dimensions/budgets remain caller-owned.

The hook requires at least one source page: an empty public manifest refuses with invalid-config before either port runs. An intentionally empty site must omit this hook rather than produce an apparent passing publication check. Quality-refused reports carry finding codes plus source page paths, group indices and known head fields only; observed metadata, unknown paths and original port error content never enter the report.

PublicationBuildError fails the build with a stable code and generic message. Observation/report exceptions are wrapped without cause/message content; reports include counts and source public paths/known finding fields, never observed titles/bodies/unknown paths. Reports are frozen and the report port is awaited. No callback/metadata port is optional. Static pages do not establish SSR completeness: the observer must attest complete observations for the source manifest. Installed structural-hook tests do not prove a real Astro build; site-owned real-build evidence and final merge qualification remain separate.


The optional createStaticPublicationObserver({manifest,headPlan,artifactGroups,limits,attestCoverage,readHead,readArtifact}) returns an observer for the existing hook. All ports and positive integer maxPages/maxArtifacts limits are mandatory. The manifest and head plan must cover exactly the same nonempty public paths. Plans use opaque nonempty primitive string references; they are copied into a deep-frozen snapshot at construction. Artifact groups contain {id,policy,expected:[{url,sha256,reference}]}, with unique IDs/URLs and caller-owned policies. Count limits refuse before any port runs. Ports execute sequentially in head-plan then group/asset order, once per call, without retries or caching. Each receives the unchanged hook context.

attestCoverage(context, plannedPaths) must return exactly {complete:true,paths:[...]}, covering each source path exactly once and attesting the site adapter's complete output coverage. Static context.pages alone cannot attest SSR/hybrid coverage. readHead(context, reference) returns exactly {elements:[...]}; readArtifact(context, reference) returns only observed SHA256/byte/decode/pixel-hash/format/dimension fields, without url/path/reference. Plain records and dense arrays are required. Extra identity fields refuse even when equal to source values. The coordinator assigns output path/url from the independent source plan. Returned observations are frozen and contain no opaque references. Existing hook performs quality auditing and owns the report port.

Site ports retain file containment/symlink policy, pre-read byte and decoder allocation limits, HTML parsing and complete image decoding, trusted expected hashes, consistent pixel representation, and site-specific retained-default exceptions. Count limits bound scheduled calls; they do not limit allocations inside ports. This coordinator introduces no native effect or dependency. Port rejection wraps without original message/cause. No new runtime error details contain observed content or references.

When supplied, observed bytes, width and height must be positive safe integers: zero-byte artifacts and zero dimensions refuse as invalid-observer-output. Coverage is attested before reads; the observer trusts each port to read the file identified by its opaque reference. It does not prove that returned HTML belongs to that route. Keep the quality hook enabled: its independent expected canonical and metadata checks catch route/content mismatches. Site adapters remain responsible for correct reference-to-file binding.

| Error code | Meaning |
| --- | --- |
| invalid-config | Invalid hook options, including empty source pages. |
| incomplete-observations | Hook received no positive complete attestation or an incomplete marker. |
| invalid-observations | Hook received malformed or ambiguous observations. |
| observation-failed | Hook's observer threw or rejected. |
| report-failed | Hook's report port threw or rejected. |
| quality-refused | Completed quality audits found failures; bounded report attached. |
| invalid-observer-config | Observer ports, source plan, references or policy are malformed. |
| observer-limit | Configured page/artifact call budget exceeded before ports run. |
| observer-port-failed | Observer port threw or rejected; original content discarded. |
| observer-coverage | Coverage attestation incomplete, malformed or not exact. |
| invalid-observer-output | Head/artifact port returned malformed or extra identity fields. |

These codes share PublicationBuildError. The hook wraps observer errors as observation-failed; standalone observer consumers may distinguish its specific codes. Hand-authored declarations remain export-name checked only. Observer work is a separate stacked candidate and second PR after the first hook PR merges, following prerequisite #34/#33 and actual-main full gates. It is not covered by the earlier real-Astro fixture evidence.
