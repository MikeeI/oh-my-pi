# ISSUE-008 — Read prompt: raw is not a universal converter or byte bypass

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-20
Source: `upstream/main@74bc1f442e7bb6adcb5797ca8802ef6684281411`

## Root

Root [S]: `prompts/tools/read.md` describes `:raw` globally as verbatim and converter-bypassing, but runtime semantics remain source-specific.
Notebook raw reaches storage JSON, Markit documents still use conversion, images retain image-oriented dispatch, internal resources retain handler-owned representations, and archive members remain extracted and UTF-8 decoded.

## Reach and impact

Reach [S]: Every Read-enabled model can request `:raw` for local documents, images, URLs, archives, or internal resources under the global wording.
Impact [N]: Agents can mistake converted or handler-owned output for original bytes, use unsuitable evidence for hashing or copying, or retry when raw output does not change the representation.

## Evidence

- [S] Current upstream `prompts/tools/read.md:8-20` uses universal verbatim and converter-bypass wording for documents, notebooks, images, and URLs.
- [S] Current upstream `tools/read.ts` routes images through image-aware dispatch and notebooks through a raw storage representation rather than a universal byte path.
- [S] Current upstream `tools/read.ts` keeps Markit conversion in the source dispatch; raw changes formatting of converted output rather than disabling that conversion.
- [S] Current upstream `tools/fetch.ts:1294-1297` skips text shaping in raw mode only after binary-oriented branches have already run.
- [S] Current upstream `tools/read-archive.ts:170-188` reads archive members and UTF-8 decodes them before applying the raw selector.
- [S] `https://github.com/can1357/oh-my-pi/commit/b980dd24f29d53a5427cd4e58e82a9dbdbfdc4e2` and `https://github.com/can1357/oh-my-pi/commit/af1832af1bd36070a814c3bb175c3655ee44e29f` broadened and harmonized the prompt wording without a corresponding universal runtime conversion change.
- [O] The focused source-kind probe showed Notebook default editable markers versus raw storage JSON containing `"cells"`.
- [O] The same probe showed PDF/Markit default and raw both use converted content, with raw changing Read formatting rather than bypassing conversion.
- [O] Local image default and raw both returned text plus `image/png` content, while archive default and raw both returned extracted member text rather than archive bytes.
- [O] Focused URL tests showed raw response bodies and non-raw handler rendering for feed and JSON inputs.
- [O] Personal commit `ab8cd45f71` applies source-specific `:raw` guidance and adds `test/tools/read-guidance.test.ts`; focused Read tests pass with 160 passed, 1 skipped, and 0 failed.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-19.
Gaps [N]: Discussions, real external URL/PDF execution, and invalid-UTF-8 behavior remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/1401` and `https://github.com/can1357/oh-my-pi/pull/1402` — related fidelity boundary for CLI PDF arguments with a different owner and no `:raw` contract.
- `https://github.com/can1357/oh-my-pi/pull/756` — related prompt-compression process, not the later semantic widening.

Target fit: New prompt-contract candidate; no exact duplicate found.
Mode and external target remain user-unselected.

## Direction
Define `:raw` as a source-specific representation rather than a universal byte promise.
Document exact branches such as Notebook storage JSON, Markit converted output without Read formatting, image representation, and handler-owned URL response text.
Proposed prompt correction [A]: replace the universal `verbatim` and `converter bypass` wording with the following source-specific guidance.
- `:raw` suppresses Read anchors and prefixes where supported, but is not universal byte access or a universal converter bypass.
- Documents return extracted text, and source-specific converters may still run under `:raw` (for example, Markit/PDF).
- Notebooks return editable cells by default, while `:raw` returns storage JSON.
- Images return decoded inline content, and `:raw` does not return original image bytes.
- Archives read selected members, and `:raw` still returns decoded member text rather than archive bytes.
- URLs return reader-mode text by default, while `:raw` returns the response body without JSON, feed, or HTML text shaping after binary handling.
Do not force byte semantics into a Text/Image tool.

## Bounds

- Preserve: Existing source dispatch, Markit conversion, image normalization, Notebook JSON access, HTML response-body mode, archive and internal-URI ownership, and limits.
- Exclude: Binary-safe transfer API, invalid-UTF-8 policy, converter redesign, and global byte-exact implementation.
- Cost: Prompt correction plus source-kind behavior and description tests.

## Verification

- Compare default and raw PDF or Markit reads and require both to use converted content with only formatting differences.
- Compare default Notebook editable cells with raw storage JSON.
- Compare local image default and raw representation types.
- Compare URL and archive raw behavior with their handler-owned output contracts.

## Missing

- [N] Maintainer-chosen exact terminology for source-specific raw representations.
- [N] Real external URL/PDF execution and invalid-UTF-8 byte exactness require separate triage and must not enter this record.
- Mode and external target remain intentionally unselected.

## Resume

Index: Select Read raw delivery
Next: Choose local-only completion or an upstream pull request.
Done when: Mode and target are recorded for the implemented correction.

## Bug reproduction

Environment: Bun 1.3.14, Ubuntu 24.04.4 LTS x64, current personal checkout, controlled local fixtures, and focused Read handler tests.
Reproduction: Read an IPYNB fixture with and without `:raw`.
Read controlled PDF/Markit, PNG, URL, and ZIP-member fixtures with and without `:raw`.
Actual [O]: Notebook raw returns storage JSON, PDF/Markit raw remains converted, image raw remains image-oriented, URL raw is handler-owned response text, and archive raw remains extracted UTF-8 member text.
Expected: The prompt describes these source-specific representations instead of promising a universal verbatim or converter-bypassing mode.
