## [3.18.0](https://github.com/punyamsingh/ARGUS/compare/v3.17.1...v3.18.0) (2026-08-05)

### Features

* **demo:** re-cast the demo and example data on an Indian D2C account ([#113](https://github.com/punyamsingh/ARGUS/issues/113)) ([4970766](https://github.com/punyamsingh/ARGUS/commit/49707663c16e0d754a02924fee4f5a56fc69fae4))

## [3.17.1](https://github.com/punyamsingh/ARGUS/compare/v3.17.0...v3.17.1) (2026-08-04)

### Bug Fixes

* **demo:** keep the header's nav on the demo surface inside a brief ([cf7d0f9](https://github.com/punyamsingh/ARGUS/commit/cf7d0f987c5222f8f72fb6612ea1c6d788799236))
* **ui:** centre the menu panel, lead with Home, and keep the chip a chip ([1c98989](https://github.com/punyamsingh/ARGUS/commit/1c9898901900dc9bdc1a83b3c1879610714449ab))
* **ui:** keep the header from overflowing once auth shares the bar ([59291ed](https://github.com/punyamsingh/ARGUS/commit/59291ed98cf8527b64e0f70bb820866d77a9a8ab))

## [3.17.0](https://github.com/punyamsingh/ARGUS/compare/v2.1.0...v3.17.0) (2026-08-04)

Version realignment. **No functional changes** — no code differs between v2.1.0
and v3.17.0.

Releases had been failing silently since v2.0.0 (28 June): `SEMANTIC_RELEASE_TOKEN`
had expired, so semantic-release authenticated, failed to push the tag, and exited
before writing a version. Thirty-seven commits — seventeen of them features — landed
on `main` over five weeks without ever being released. When the token was rotated,
that entire backlog collapsed into a single minor bump, because semantic-release
takes the highest bump since the last tag rather than one per commit. The result,
v2.1.0, undersold five weeks of work by a wide margin.

This release renumbers the line to 3.17.0 — the version `pnpm version:compute`
derives from the full commit history, i.e. what the version would have been had
every release fired on time. Normal numbering resumes from here; the next feature
lands as 3.18.0.

## [2.1.0](https://github.com/punyamsingh/ARGUS/compare/v2.0.0...v2.1.0) (2026-08-04)

### Features

* **api:** add the brief library routes ([5513871](https://github.com/punyamsingh/ARGUS/commit/551387127ecf67798fa38dbfe97cb4d0e5fe6a14))
* **auth:** sign in with Google ([9173eda](https://github.com/punyamsingh/ARGUS/commit/9173eda101d64a9574ca9c74f7f6deebfa0e94d1))
* **briefs:** add the row mapping and owner-scoped repo ([4ab8d13](https://github.com/punyamsingh/ARGUS/commit/4ab8d1397eea16af054e8811282a28423e6f077f))
* **briefs:** claim local history on first sign-in ([a92034d](https://github.com/punyamsingh/ARGUS/commit/a92034d7d89a309592a00845bae216fb203d04f8))
* **briefs:** serve the library from the account when signed in ([01d5f3e](https://github.com/punyamsingh/ARGUS/commit/01d5f3e9d133683cfeae3c91981c8797643d66a9))
* **db:** add Supabase Postgres access and the schema ([c52680e](https://github.com/punyamsingh/ARGUS/commit/c52680e354b6fa5f0407827594d32952cc93c987))
* **demo:** add demo mode with a scripted account and real synthesis ([67f44e9](https://github.com/punyamsingh/ARGUS/commit/67f44e9c5f27367fe4eb5c243ef4b72edeb571d3))
* **demo:** keep the demo control honest for the whole run ([2a4e5df](https://github.com/punyamsingh/ARGUS/commit/2a4e5df5fa687008ab8dcead1587ae198dc87f19))
* **demo:** label the demo control and let it be dismissed ([fddcd68](https://github.com/punyamsingh/ARGUS/commit/fddcd683a94432ed649f9085ddcafd66b80c9d93))
* **site:** production-grade footer, About/Contact and legal pages ([a990239](https://github.com/punyamsingh/ARGUS/commit/a99023982777e1f7dd9715b37c9ef9392cd8d049)), closes [#studio](https://github.com/punyamsingh/ARGUS/issues/studio) [#sources](https://github.com/punyamsingh/ARGUS/issues/sources) [#how-it-works](https://github.com/punyamsingh/ARGUS/issues/how-it-works)
* **site:** restore the footer brand block ([6468cbe](https://github.com/punyamsingh/ARGUS/commit/6468cbef845bf7b061dd2d997e4e6afa5f6940bc))
* **ui:** add light theme with a footer toggle ([f59696b](https://github.com/punyamsingh/ARGUS/commit/f59696bdbf4a4816faeb57137f74d6913817663a)), closes [#a8761f](https://github.com/punyamsingh/ARGUS/issues/a8761f)
* **ui:** default to dark on every device ([1ffbb1a](https://github.com/punyamsingh/ARGUS/commit/1ffbb1a6d40c4075de7e876f58e9f5bc658f376c))
* **ui:** ease the studio layout closed when the example goes ([fab703b](https://github.com/punyamsingh/ARGUS/commit/fab703b863a978646d730f12e327aaa7babcb869)), closes [#96](https://github.com/punyamsingh/ARGUS/issues/96)
* **ui:** give a real brief the example's chrome and its controls ([96a3b90](https://github.com/punyamsingh/ARGUS/commit/96a3b90823558e300d2625cd9f5db297c213594e))
* **ui:** let the example brief be dismissed ([0a2bdc9](https://github.com/punyamsingh/ARGUS/commit/0a2bdc9164a2e4d97bafe7c59bf1c20e2f811e3b)), closes [#96](https://github.com/punyamsingh/ARGUS/issues/96)
* **ui:** stop pinning the desktop layout to a narrow centre column ([40f2e8e](https://github.com/punyamsingh/ARGUS/commit/40f2e8e78dffd5de0b66da0a45b1acdbdcc1e1e4))

### Bug Fixes

* **a11y:** return focus to the menu button when Escape closes the nav ([7236d1a](https://github.com/punyamsingh/ARGUS/commit/7236d1a98701e19ab35bbc0d66752ba94489e7c2)), closes [#103](https://github.com/punyamsingh/ARGUS/issues/103)
* **ui:** give the chrome lights a 24px hit area ([e046844](https://github.com/punyamsingh/ARGUS/commit/e046844732b9a9d1ed5c26f12968afae7e48afb3))
* **ui:** raise light-theme contrast to WCAG AA ([2076311](https://github.com/punyamsingh/ARGUS/commit/2076311a058e64529e940236ce6c3802038e69d0)), closes [#a8761f](https://github.com/punyamsingh/ARGUS/issues/a8761f) [#868d97](https://github.com/punyamsingh/ARGUS/issues/868d97) [#656b73](https://github.com/punyamsingh/ARGUS/issues/656b73) [#a8761f](https://github.com/punyamsingh/ARGUS/issues/a8761f)
* **ui:** raise surface opacity so the backdrop stops crossing text ([#110](https://github.com/punyamsingh/ARGUS/issues/110)) ([d1cccd5](https://github.com/punyamsingh/ARGUS/commit/d1cccd50973037bca2e4c39eccb1f1fb1b67cf15))
* **ui:** repair citation alignment, mobile nav and disabled buttons ([aa1d116](https://github.com/punyamsingh/ARGUS/commit/aa1d11687f8eaee0833892ce9bd15b1cc3dca19a))
* **ui:** wear the same header and footer on the brief page ([a2adb91](https://github.com/punyamsingh/ARGUS/commit/a2adb9192e6552c9344ecd34ae2b9ada2f393594))

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
