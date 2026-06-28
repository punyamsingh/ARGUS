## [2.0.0](https://github.com/punyamsingh/ARGUS/compare/v1.9.0...v2.0.0) (2026-06-28)

### ⚠ BREAKING CHANGES

* ARGUS moves to its 2.0 release line. Breaking changes are now
detected from the Conventional Commit "!" marker (e.g. feat!:, docs!:), matching
the documented release contract.
* overhaul README and add CONTRIBUTING; cut 2.0 release line (#90)

### Features

* honor Conventional Commit "!" for breaking-change releases ([#91](https://github.com/punyamsingh/ARGUS/issues/91)) ([602ff58](https://github.com/punyamsingh/ARGUS/commit/602ff58eeba9019789d22887f8042341483d7796))

### Documentation

* overhaul README and add CONTRIBUTING; cut 2.0 release line ([#90](https://github.com/punyamsingh/ARGUS/issues/90)) ([e80fd51](https://github.com/punyamsingh/ARGUS/commit/e80fd51b81f9c328af583288f2fddbd7ce140d66))

# [1.9.0](https://github.com/punyamsingh/ARGUS/compare/v1.8.0...v1.9.0) (2026-06-28)


### Features

* **ui:** dedicated focused page for a brief; recent briefs expand into it ([47793f5](https://github.com/punyamsingh/ARGUS/commit/47793f54bbdf4bd070b68afc1ccc807c9cf41306))

# [1.8.0](https://github.com/punyamsingh/ARGUS/compare/v1.7.0...v1.8.0) (2026-06-28)


### Features

* **ui:** conversational workspace — ask follow-ups beneath the brief ([abfc09b](https://github.com/punyamsingh/ARGUS/commit/abfc09b25a21e4b9a8c11fc593abb468817f9ea8)), closes [#74](https://github.com/punyamsingh/ARGUS/issues/74) [#75](https://github.com/punyamsingh/ARGUS/issues/75)

# [1.7.0](https://github.com/punyamsingh/ARGUS/compare/v1.6.0...v1.7.0) (2026-06-28)


### Features

* **agent:** grounded follow-up engine + /api/brief/ask ([2143398](https://github.com/punyamsingh/ARGUS/commit/2143398f976ae985ea04d76c5efdf2020bfee4f1)), closes [#74](https://github.com/punyamsingh/ARGUS/issues/74)

# [1.6.0](https://github.com/punyamsingh/ARGUS/compare/v1.5.0...v1.6.0) (2026-06-28)


### Features

* questions-to-ask + fit hypotheses as derived guidance ([2a69dca](https://github.com/punyamsingh/ARGUS/commit/2a69dcac8a0b9d088f52d5ef05c525b507662e16)), closes [#70](https://github.com/punyamsingh/ARGUS/issues/70) [#73](https://github.com/punyamsingh/ARGUS/issues/73)

# [1.5.0](https://github.com/punyamsingh/ARGUS/compare/v1.4.0...v1.5.0) (2026-06-28)


### Features

* **agent:** seller context as a grounded synthesis channel ([cde49cf](https://github.com/punyamsingh/ARGUS/commit/cde49cf0c8d9c6e312c89f4b2c007574c08e4feb)), closes [#71](https://github.com/punyamsingh/ARGUS/issues/71)
* **ui:** persistent, progressive seller profile + meeting-type picker ([cae0a8a](https://github.com/punyamsingh/ARGUS/commit/cae0a8afe49aee6930d895a63382cc6bb7113a82)), closes [#72](https://github.com/punyamsingh/ARGUS/issues/72)

# [1.4.0](https://github.com/punyamsingh/ARGUS/compare/v1.3.1...v1.4.0) (2026-06-28)


### Features

* **types:** two-truths content model — sourced claims vs. derived guidance ([0a9f297](https://github.com/punyamsingh/ARGUS/commit/0a9f2973348e57f0818efa532958459a2474e291)), closes [#73](https://github.com/punyamsingh/ARGUS/issues/73) [#74](https://github.com/punyamsingh/ARGUS/issues/74) [#70](https://github.com/punyamsingh/ARGUS/issues/70)

## [1.3.1](https://github.com/punyamsingh/ARGUS/compare/v1.3.0...v1.3.1) (2026-06-28)


### Bug Fixes

* capture LLM generations + session ids in Langfuse traces ([#15](https://github.com/punyamsingh/ARGUS/issues/15)) ([897ccfb](https://github.com/punyamsingh/ARGUS/commit/897ccfb032064427d7aa1033af31adc11e5947de))

# [1.3.0](https://github.com/punyamsingh/ARGUS/compare/v1.2.0...v1.3.0) (2026-06-28)


### Features

* instrument Langfuse tracing via the official Langfuse skill ([#15](https://github.com/punyamsingh/ARGUS/issues/15)) ([e8de082](https://github.com/punyamsingh/ARGUS/commit/e8de08279cbf5453dc58417c9125edb94837c21a))
* wire Langfuse observability via OpenTelemetry ([#15](https://github.com/punyamsingh/ARGUS/issues/15)) ([a992e2a](https://github.com/punyamsingh/ARGUS/commit/a992e2a263e913b08015558d9506fdd2310d1d2d))

# [1.2.0](https://github.com/punyamsingh/ARGUS/compare/v1.1.1...v1.2.0) (2026-06-28)


### Features

* add GitHub open-source footprint tool ([#31](https://github.com/punyamsingh/ARGUS/issues/31)) ([4e19e2b](https://github.com/punyamsingh/ARGUS/commit/4e19e2b85f2e1a0151fe460325e9b12c83811372))

## [1.1.1](https://github.com/punyamsingh/ARGUS/compare/v1.1.0...v1.1.1) (2026-06-28)

# [1.1.0](https://github.com/punyamsingh/ARGUS/compare/v1.0.1...v1.1.0) (2026-06-28)


### Bug Fixes

* address review — escaping, history validation, print, race; add skeleton + docstrings ([a3fe515](https://github.com/punyamsingh/ARGUS/commit/a3fe515ca11b731b1cf1d57afced903be9c48889)), closes [#61](https://github.com/punyamsingh/ARGUS/issues/61)


### Features

* brief export, recent-briefs history, and UI consistency ([#61](https://github.com/punyamsingh/ARGUS/issues/61)) ([7b95e17](https://github.com/punyamsingh/ARGUS/commit/7b95e17eeac96011aa49ad0585f1716884613b76)), closes [#10](https://github.com/punyamsingh/ARGUS/issues/10)

## [1.0.1](https://github.com/punyamsingh/ARGUS/compare/v1.0.0...v1.0.1) (2026-06-28)


### Bug Fixes

* GDELT rejects single-term parens in query ([#28](https://github.com/punyamsingh/ARGUS/issues/28)) ([61295b0](https://github.com/punyamsingh/ARGUS/commit/61295b0bffe2f45c1d9b3f49f9c944862567cf3c))

# [1.0.0](https://github.com/punyamsingh/ARGUS/compare/v0.18.3...v1.0.0) (2026-06-28)


### Bug Fixes

* release refactor commits + handle breaking changes in replay ([e26a4f0](https://github.com/punyamsingh/ARGUS/commit/e26a4f032755451e3102ffd66f10c60c96285bfc))


### Features

* add semantic versioning + automated release pipeline ([ca250f9](https://github.com/punyamsingh/ARGUS/commit/ca250f926985510939867ec1149adbd216ee3a52))
* adopt semantic-release for automated versioning ([150e761](https://github.com/punyamsingh/ARGUS/commit/150e76171ca8e9ef55ade0bd14e94303e23366e7))


### BREAKING CHANGES

* footer) and apply a major bump, keeping `npm run
  version:compute` aligned with semantic-release semantics.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ah5k4pFbzp6H6KMDCCrqnx
