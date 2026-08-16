# ISSUE-008 — Read prompt: raw is not a universal converter or byte bypass

State: Hold
Mode: Undecided
Target: Undecided
Location: Not published.
Priority: Medium
Confidence: High
Type: correctness
Created: 2026-08-14
Updated: 2026-08-14
Source: `upstream/main@ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472`

## Root

Root [S]: `read.md` globally describes `:raw` as verbatim and says it bypasses converters across documents, notebooks, and images. Runtime semantics are source-specific: Notebook raw reaches storage JSON, but Markit documents are still converted, images keep the same metadata/ImageContent dispatch, internal URIs retain handler-owned representations, and archives remain extracted/UTF-8 decoded. Prompt compression widened an earlier notebook-only promise without implementation change.

## Reach and impact

Reach [S]: Every Read-enabled model can request `:raw` for local documents/images, URLs, archives, or internal resources under the global promise.
Impact [N]: Agents can mistake converted Markdown or handler output for original bytes, use unsuitable evidence for hashing/copying, or retry when image/internal representations do not change; no end-to-end misuse is measured.

## Evidence

- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/prompts/tools/read.md#L8-L20` — current universal verbatim/converter-bypass wording.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/read.ts#L1039-L1101` — images ignore raw for dispatch; notebooks bypass editable-cell conversion.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/read.ts#L1101-L1131` — Markit conversion still runs; raw applies to converted output formatting.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/fetch.ts#L1295-L1307` — HTML raw skips extraction but binary dispatch happens earlier.
- [S] `https://github.com/can1357/oh-my-pi/blob/ae2d3d6ea16a47aa5208bd123dcc4cfcc8756472/packages/coding-agent/src/tools/read-archive.ts#L139-L203` — raw archive members remain extracted and UTF-8 decoded.
- [S] `https://github.com/can1357/oh-my-pi/commit/b980dd24f29d53a5427cd4e58e82a9dbdbfdc4e2` and `https://github.com/can1357/oh-my-pi/commit/af1832af1bd36070a814c3bb175c3655ee44e29f` — compression broadened notebook-specific wording to the current global claim.

## Prior art

Coverage: issues(open+closed), PRs(open+closed+merged), source history; checked=2026-08-14.
Gaps: Discussions, real Markit/image truth-table execution, and invalid-UTF-8 behavior remain unchecked.

- `https://github.com/can1357/oh-my-pi/issues/1401` and `https://github.com/can1357/oh-my-pi/pull/1402` — Related fidelity boundary for CLI PDF arguments, different owner and no `:raw` contract.
- `https://github.com/can1357/oh-my-pi/pull/756` — Related prompt-compression process, not the later semantic widening.

Target fit: New prompt-contract candidate; no exact duplicate found. Mode and external target remain user-unselected.

## Direction

Define `:raw` as an unprefixed/unanchored source-specific representation, then state exact branches: Notebook→storage JSON; Markit document→converted output without Read formatting; image→no original-byte path; HTML URL→response-body text. Do not force byte semantics into a Text/Image tool.

## Bounds

- Preserve: Existing source-kind dispatch, Markit conversion, image normalization, Notebook JSON access, HTML response-body mode, archive/internal URI ownership, and limits.
- Exclude: Binary-safe transfer API, invalid-UTF-8 policy, converter redesign, and global byte-exact implementation.
- Cost: Prompt correction plus source-kind behavior/description tests.

## Verification

- Stub Markit output different from PDF bytes; require default and raw both use converted content, with only formatting changed.
- Compare Notebook default editable cells with raw storage JSON.
- Compare local image default/raw representation types.
- Render both image-enabled prompt branches and require source-specific semantics.

## Missing

- [O] Focused PDF/Notebook/Image truth-table reproduction on the recorded revision.
- Maintainer-chosen exact terminology for source-specific raw representations.
- Invalid-UTF-8 byte-exactness requires separate triage and must not enter this record.
- Mode and external Target remain intentionally unselected.

## Resume

Index: Reproduce Read raw truth table
Next: Run the mock-based PDF/Notebook/Image truth-table probe against the recorded upstream revision.
Done when: Output proves PDF raw remains converted, Notebook raw returns storage JSON, and image raw keeps the same representation type.
