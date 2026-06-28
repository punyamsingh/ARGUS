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
