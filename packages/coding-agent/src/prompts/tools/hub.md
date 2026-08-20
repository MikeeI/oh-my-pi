Agent coordination: peer messaging, background-job control, and supervised long-running processes. Main agent is `Main`; subagents inherit task ID.
Use `op: "list"` to discover live peers. Default is running+idle plus running/idle/parked/shown/truncated counts — never an unbounded parked name dump. Pass `status: "parked"` for parked archaeology; optional `limit` bounds rows (default 32, max 100). Address peers by exact roster ID — NEVER invent names. `send` to a known parked id still revives it; `history://<id>` and `agent://<id>` stay readable.

# Messaging and jobs
- Results auto-deliver when they finish.
- Reading a settled job through `jobs` or `wait` consumes that delivery and suppresses duplicate `async-result`.
- Peer `send` is fire-and-forget unless `await: true` and returns an immediate delivery receipt.
- Sending also wakes `idle` and `parked` peers; a failed delivery means the peer is gone, so do not retry.
- Reply with the answer first, set `replyTo`, and NEVER quote the prior message.
- Messages MUST be concise plain prose; NEVER send JSON status objects.
- Share large content through `local://` or `artifact://`.
- `wait` returns on the first message, watched completion, timeout, or steering interrupt.
- Use `wait` only when blocked; reissue it when another completion is still needed.
- Bare `wait` watches all jobs and messages; NEVER pass every running ID, and use `ids` or `from` only to narrow.
- `inbox` drains queued messages without blocking.
- `jobs` returns a non-blocking snapshot and also names live agents without job rows.
- `cancel` stops hung, stalled, or obsolete background jobs and returns immediately.
- Job IDs are process-local and expire roughly five minutes after settlement.
- After expiry, use the agent ID with `hub send`, `agent://<id>`, or `history://<id>`.
- `completed` means successful exit, not accepted artifacts; verify claims.
- Ask peers about their work; NEVER inspect another session through shell, grep, or file reads.
- NEVER use Hub when a normal tool can answer directly.

# Processes

Project-scoped long-running processes shared by every omp instance in the same directory. A long-running service, watcher, debugger, REPL, or process needing later input MUST use `op:"start"`, not `bash`.

- **`start`** launches `application` + `args` directly. `cwd` defaults to the session directory; `pty` defaults true.
  - `ready.log` is a JavaScript `RegExp` compiled with the `u` flag; PCRE inline modifiers such as `(?i)` are REJECTED — use `[Rr]eady` instead. `ready.port` is a TCP port. Both supplied? BOTH MUST pass. `ready.timeout` is seconds. Readiness MUST be observed; process creation alone is not readiness.
  - Names are unique per project directory. A completed name MAY be started again; a live name MUST be stopped or restarted.
  - `restart` policy defaults `no`; `on-failure` and `always` use bounded backoff.
  - `persist: true` opts out of last-omp teardown; `detached: true` survives broker shutdown and all omp exits (implies persist, disables PTY input). Omit both unless their survival guarantees are required.
- **`ps`**, **`logs`**, **`wait`** (with `name`), **`send`** (with `name`), **`stop`**, **`restart`**, and **`describe`** address the stable `name`.
- **`logs`** defaults to the last 100 lines. `head: true` reads the beginning. `grep` is a JavaScript `RegExp` compiled with the `u` flag (no inline modifiers such as `(?i)`). `follow: true` waits for output after `cursor`; reuse the returned cursor on the next call.
- **`wait`** with `name` blocks until readiness/exit/`pattern` or `timeout` (seconds). `pattern` is a JavaScript `RegExp` compiled with the `u` flag (no inline modifiers such as `(?i)`).
- **`send`** with `name`: `text` writes stdin (`enter` defaults true); `keys` supports ENTER, TAB, ESCAPE, CTRL_C, CTRL_D, UP, DOWN, LEFT, RIGHT; `signal` supports SIGINT, SIGTERM, SIGHUP, SIGQUIT, SIGKILL. PTY input is serialized; writes share one input stream.
- **`stop`** performs graceful process-tree termination before hard-kill; NEVER kill an unverified PID through bash. **`restart`** reuses the retained launch spec.
