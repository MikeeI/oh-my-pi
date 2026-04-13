# Illegal instruction in native fuzzyFind / @-mention autocomplete

## Scope

This document captures the current understanding of the `Illegal instruction` crash seen when using non-empty `@` file mentions in OMP.

This work was prepared in:

- repo: `/root/projects/project-oh-my-pi-fork`
- branch: `research/native-illegal-instruction`
- base: `upstream/main` at `d350ea60ef2f006945a9da3ce510fbe23093a779`

The goal is to preserve what is already known, what is only suspected, and the shortest path to a maintainer-grade fix.

## Executive summary

The strongest current hypothesis is:

- the published x64 native addon artifacts for `@oh-my-pi/pi-natives` `14.0.3` are not ISA-safe
- at least the installed `linux-x64-modern` and `linux-x64-baseline` artifacts on this machine contain AVX-512 markers
- calling `fuzzyFind()` from those installed artifacts crashes with `Illegal instruction`
- the TUI `@<char>` autocomplete path calls `fuzzyFind()`, so the crash appears as an `@`-mention bug
- this is not Bun-only; direct Node loading of the installed `.node` file also exits `132`

The most likely fix is not in the TUI autocomplete logic. The likely fix is in native artifact production and/or release packaging.

## What is confirmed

### 1. The crash path from the UI is real and narrow

Relevant source path on current upstream source:

- `packages/tui/src/autocomplete.ts:228-239`
- `packages/tui/src/autocomplete.ts:680-705`

The relevant control flow is:

- non-empty `@` mention enters `CombinedAutocompleteProvider.getSuggestions()`
- that calls `#getFuzzyFileSuggestions()`
- that calls native `fuzzyFind()` from `@oh-my-pi/pi-natives`

Source evidence:

```ts
// packages/tui/src/autocomplete.ts:228-235
const atPrefix = this.#extractAtPrefix(textBeforeCursor);
if (atPrefix) {
	const { rawPrefix, isQuotedPrefix } = parsePathPrefix(atPrefix);
	const suggestions =
		rawPrefix.length > 0
			? await this.#getFuzzyFileSuggestions(rawPrefix, { isQuotedPrefix })
			: await this.#getFileSuggestions("@");
```

```ts
// packages/tui/src/autocomplete.ts:680-686
const scopedQuery = await this.#resolveScopedFuzzyQuery(query);
const searchPath = scopedQuery?.baseDir ?? this.#basePath;
const fuzzyQuery = scopedQuery?.query ?? query;
const result = await fuzzyFind(buildAutocompleteFuzzyDiscoveryProfile(fuzzyQuery, searchPath), this.#searchDb);
```

Conclusion:

- bare `@` is not enough to trigger the crash
- `@<char>` is enough, because that reaches native `fuzzyFind()`

### 2. This is not Bun-only

Direct Node loading of the installed native addon also crashes.

Command:

```bash
node -e 'const mod = require("/root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-modern.node"); mod.fuzzyFind({ query: "a", path: "/tmp", maxResults: 5, hidden: true, gitignore: true, cache: true }).then(res => console.log(JSON.stringify(res))).catch(err => { console.error(err); process.exit(1); });'
```

Observed result:

- process exits with code `132`
- no JavaScript exception is raised first

Implication:

- the root problem is below Bun/TUI application logic
- Bun may expose the crash more clearly, but the native artifact itself is sufficient to reproduce the failure

### 3. A local repo binary works where the installed published one crashes

Direct Node loading of the repo-local binary succeeds.

Command:

```bash
node -e 'const mod = require("/root/projects/project-oh-my-pi-fork/packages/natives/native/pi_natives.linux-x64-modern.node"); mod.fuzzyFind({ query: "a", path: "/tmp", maxResults: 5, hidden: true, gitignore: true, cache: true }).then(res => console.log(JSON.stringify({ ok: true, count: res.matches.length, first: res.matches[0] ?? null }))).catch(err => { console.error(err); process.exit(1); });'
```

Observed result:

```json
{"ok":true,"count":5,"first":{"path":"a0629736a5db3561c8b46bdc4b3ce835/","isDirectory":true,"score":110}}
```

Important caveat:

- this repo-local binary is an already-present local artifact, not a clean rebuild from the latest branch during this session
- still, it is a strong contrast against the installed published artifact on the same machine

### 4. Installed published binaries contain AVX-512 markers; local repo binary does not

Command used:

```bash
python3 - <<'PY'
import subprocess, re
files = {
    'local_repo_modern': '/root/projects/project-oh-my-pi-fork/packages/natives/native/pi_natives.linux-x64-modern.node',
    'global_installed_modern': '/root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-modern.node',
    'global_installed_baseline': '/root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-baseline.node',
}
for name, path in files.items():
    proc = subprocess.run(['objdump','-d',path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    text = proc.stdout
    zmm = len(re.findall(r'\bzmm\d+\b', text))
    mask = len(re.findall(r'\bk[0-7]\b', text))
    print(f'{name}: zmm={zmm} mask={mask}')
PY
```

Observed result:

```text
local_repo_modern: zmm=0 mask=0
global_installed_modern: zmm=5298 mask=1203
global_installed_baseline: zmm=5298 mask=1203
```

A representative disassembly snippet from the installed published binary:

```text
60ba1df:	c4 c1 78 92 c9        kmovw  %r9d,%k1
```

Implication:

- the installed published x64 artifacts contain AVX-512-class markers
- the local repo artifact does not
- the published `baseline` artifact also showing AVX-512 markers is especially suspicious

That last point is the strongest signal that this is not just “modern is too aggressive”. It suggests either:

- the wrong binary got published under more than one filename
- the release build itself emitted too-new instructions for both variants
- a post-build packaging/normalization step copied the wrong file into multiple output names

### 5. Upstream source currently intends safer x64 variant selection

Current source relevant to build-time intent:

- `packages/natives/scripts/build-native.ts:84-93`

```ts
if (!isCrossCompile && !Bun.env.RUSTFLAGS) {
	if (effectiveVariant === "modern") {
		Bun.env.RUSTFLAGS = "-C target-cpu=x86-64-v3";
	} else if (effectiveVariant === "baseline") {
		Bun.env.RUSTFLAGS = "-C target-cpu=x86-64-v2";
	} else {
		Bun.env.RUSTFLAGS = "-C target-cpu=native";
	}
}
```

Current source relevant to runtime selection:

- `packages/natives/native/index.js:89-109`

```js
function resolveCpuVariant(override) {
	if (process.arch !== "x64") return null;
	if (override) return override;
	return detectAvx2Support() ? "modern" : "baseline";
}

function getAddonFilenames(tag, variant) {
	const defaultFilename = `pi_natives.${tag}.node`;
	if (process.arch !== "x64" || !variant) return [defaultFilename];
	const baselineFilename = `pi_natives.${tag}-baseline.node`;
	const modernFilename = `pi_natives.${tag}-modern.node`;
	if (variant === "modern") {
		return [modernFilename, baselineFilename, defaultFilename];
	}
	return [baselineFilename, defaultFilename];
}
```

Source-level conclusion:

- current source intent is reasonable: `baseline` should be `x86-64-v2`, `modern` should be `x86-64-v3`
- the installed published artifacts do not appear to match that intent

## What is likely, but not yet fully proven

### Strongest hypothesis

The published npm/bun package for `@oh-my-pi/pi-natives` `14.0.3` shipped x64 native artifacts with instructions beyond the intended ISA floor.

Most likely sub-variants:

1. build environment produced AVX-512 code in release artifacts
2. both `baseline` and `modern` filenames ended up containing the wrong binary
3. a release normalization step copied a too-new binary to both output names

### Why this hypothesis is stronger than the alternatives

#### Weaker hypothesis: Bun is the real bug

Why weaker:

- direct Node loading of the installed `.node` file also exits `132`
- the failure is below the TUI layer

#### Weaker hypothesis: autocomplete logic itself is broken

Why weaker:

- direct native `fuzzyFind()` invocation reproduces the crash without the TUI
- the JS control flow is ordinary and unchanged in the relevant area

#### Weaker hypothesis: only the `modern` binary is bad

Why weaker:

- installed `baseline` also contains AVX-512 markers
- if true, runtime fallback would still be unsafe on older x64 machines

#### Weaker hypothesis: current upstream source already fixed the issue

Why weaker:

- the crash still reproduces through the installed `14.0.3` package on this machine
- the current source expresses the right intent, but published artifacts appear inconsistent with that intent

## Xray / blindspot view

### Blindspot 1

We have stronger evidence about the published artifact than about the exact release job that produced it.

Meaning:

- we know the installed assets are bad
- we do not yet know whether the bug is in CI flags, local release machine ISA, `napi build`, artifact rename logic, or publish-time file selection

### Blindspot 2

The local working repo artifact is older than the current branch tip.

Meaning:

- it is useful proof that “an x64 modern addon can exist on this machine without AVX-512 markers”
- it is not yet a proof that `upstream/main` produces safe artifacts today from a clean build

### Blindspot 3

The latest-branch local rebuild was blocked in this environment.

Observed blocker while trying `bun --cwd=packages/natives run build` on latest source:

- `zlob` bindgen step failed with `fatal error: 'stddef.h' file not found`

Meaning:

- we still need a clean modern/baseline rebuild from current source on a fully working release-like environment
- that rebuild is still worth doing, because it can separate “bad source” from “bad published artifact” conclusively

## Why this may not have surfaced broadly before

Three filters hide the bug:

1. feature trigger
   - only non-empty `@` mention autocomplete reaches `fuzzyFind()`
   - users who do not use `@<char>` never hit it

2. hardware filter
   - only machines lacking AVX-512 will trap on those instructions
   - newer CPUs may run the bad artifact and hide the issue

3. distribution filter
   - locally built dev binaries may be fine
   - only the published/released x64 artifacts may be bad

This means a maintainer with a newer workstation, using a source checkout or a locally built addon, can easily miss the issue.

## Useful supporting background

These URLs are background context, not the primary proof. Primary proof is the local reproduction and binary inspection above.

- x86-64 microarchitecture levels, including that x86-64-v4 adds AVX-512:
  - https://en.opensuse.org/X86-64_microarchitecture_levels
- example of illegal-instruction failures caused by AVX-512 capability mismatch:
  - https://github.com/jax-ml/jax/issues/2906
- a recent Node issue showing AVX-512-related runtime hazards exist outside this project too:
  - https://github.com/nodejs/node/issues/53426

## Current working theory about the real release bug

Most plausible chain:

1. source intends `baseline = x86-64-v2`, `modern = x86-64-v3`
2. release build or packaging step emitted or selected a binary containing AVX-512 instructions
3. that binary was published at least as `linux-x64-modern.node`
4. very likely the same or similarly wrong binary was also published as `linux-x64-baseline.node`
5. runtime loader selects one of those files based on AVX2 support
6. on machines without AVX-512, the first real execution of `fuzzyFind()` traps with `Illegal instruction`

## Most actionable maintainer fixes

### Fix path A: repair release artifacts first

- rebuild x64 native release assets from a clean release environment
- inspect final `.node` files before publish
- republish or cut `14.0.4`

Minimum acceptance checks for final assets:

```bash
objdump -d pi_natives.linux-x64-baseline.node | grep -E '\bzmm[0-9]+\b|\bk[0-7]\b'
objdump -d pi_natives.linux-x64-modern.node   | grep -E '\bzmm[0-9]+\b|\bk[0-7]\b'
```

Expected:

- baseline: no AVX-512 markers
- modern: no AVX-512 markers if the intended target is only `x86-64-v3`

### Fix path B: add a release guard

Add a CI or release script check that inspects published x64 artifacts and fails if:

- `baseline` contains AVX-512 markers
- `modern` contains ISA beyond the intended contract

This is much better than trusting build flags indirectly.

### Fix path C: verify the packaging step, not just the compiler flags

Because both installed `baseline` and `modern` show AVX-512 markers, do not stop after reviewing `RUSTFLAGS`.

Also inspect:

- which exact `.node` files are emitted by `napi build`
- which file gets renamed into which final artifact name
- whether previous build outputs remain in `native/` and get reused incorrectly
- whether publish packaging includes stale local files from prior runs

### Fix path D: temporary user-facing mitigation

Until repaired artifacts are out:

- keep the settings-side JS workaround for `@` mention autocomplete
- optionally add a runtime fallback so `fuzzyFind()` failures degrade to simple directory-prefix completion instead of crashing the whole TUI

## Concrete next steps

### Highest value

1. inspect the release workflow that produced npm/bun release assets for `14.0.3`
2. reproduce artifact generation in a clean release-like environment
3. compare emitted `baseline` and `modern` binaries before publish
4. add a hard artifact-level ISA check to CI/release
5. publish fixed x64 assets

### Good follow-up experiments

1. fresh clean rebuild of current `upstream/main` on a fully working release host
2. direct disassembly diff between newly built artifacts and published npm artifacts
3. test both artifacts on an AVX2-no-AVX512 host and on an AVX-512 host
4. verify whether the baseline and modern published files are partially or fully wrong copies of the same build lineage

## Commands already shown useful

### Show crash from installed published artifact

```bash
node -e 'const mod = require("/root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-modern.node"); mod.fuzzyFind({ query: "a", path: "/tmp", maxResults: 5, hidden: true, gitignore: true, cache: true }).then(res => console.log(res));'
```

Expected on affected machines:

- exit `132`

### Show local repo artifact works

```bash
node -e 'const mod = require("/root/projects/project-oh-my-pi-fork/packages/natives/native/pi_natives.linux-x64-modern.node"); mod.fuzzyFind({ query: "a", path: "/tmp", maxResults: 5, hidden: true, gitignore: true, cache: true }).then(res => console.log(JSON.stringify({ ok: true, count: res.matches.length })));'
```

### Show suspicious instructions in published binaries

```bash
objdump -d /root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-modern.node | grep -E '\bzmm[0-9]+\b|\bk[0-7]\b' | head
objdump -d /root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-baseline.node | grep -E '\bzmm[0-9]+\b|\bk[0-7]\b' | head
```

### Compare hashes

```bash
sha256sum \
  /root/projects/project-oh-my-pi-fork/packages/natives/native/pi_natives.linux-x64-modern.node \
  /root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-modern.node \
  /root/.bun/install/global/node_modules/@oh-my-pi/pi-natives/native/pi_natives.linux-x64-baseline.node
```

## Open questions

- which exact release job produced the broken x64 npm assets?
- are the published `baseline` and `modern` assets both wrong, or only partially wrong in different ways?
- is the bad ISA coming from Rust codegen, a native dependency, link-time optimization, or stale artifact reuse?
- does the current source still produce bad x64 artifacts in a clean release environment, or is this only a published-package regression?
- should `modern` really mean `x86-64-v3` forever, or can the project support a third x64 tier later without breaking the current contract?

## Bottom line

The highest-confidence statement we can defend right now is:

- the `@`-mention crash is a symptom
- the real defect is almost certainly in the published x64 native addon artifacts for `@oh-my-pi/pi-natives` `14.0.3`
- the best next step is release-pipeline and artifact inspection, not TUI surgery
