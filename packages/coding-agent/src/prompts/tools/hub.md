Agent coordination: peer messaging, background-job control, and supervised long-running processes. Main agent is `Main`; subagents inherit task ID.
Use `op: "list"` to discover live peers. Default is running+idle plus running/idle/parked/shown/truncated counts — never an unbounded parked name dump. Pass `status: "parked"` for parked archaeology; optional `limit` bounds rows (default 32, max 100). Address peers by exact roster ID — NEVER invent names. `send` to a known parked id still revives it; `history://<id>` and `agent://<id>` stay readable.

# Messaging and jobs

- Results auto-deliver when they finish.
- Reading a settled job through `jobs` or `wait` consumes that delivery and suppresses duplicate `async-result`.
- The user is not a peer; `Main` answers the user only in a plain text block.
- A `send` to the user shows only a tool-card preview, and thinking is not user-visible output.
- Peer `send` returns an immediate receipt; omit `await` unless a reply was explicitly requested.
- Sending also wakes `idle` and `parked` peers; a failed delivery means the peer is gone, so do not retry.
- Reply with the answer first, set `replyTo`, and NEVER quote the prior message.
- Messages MUST be concise plain prose; NEVER send JSON status objects.
- Share large content through `local://` or `artifact://`.
- `wait` returns on the first message, watched completion, timeout, or steering interrupt.
- Use `wait` only when blocked; reissue it when another completion is still needed.
- Bare `wait` watches all jobs and messages; NEVER pass every running ID, and use `ids` or `from` only to narrow.
- Answer user steering in a text block before waiting again.
- Answer parent or peer steering with `send`; advisor and budget steering needs no reply.
- `inbox` drains queued messages without blocking.
- `jobs` returns a non-blocking snapshot and also names live agents without job rows.
- `cancel` stops hung, stalled, or obsolete background jobs and returns immediately.
- Job IDs are process-local and expire roughly five minutes after settlement.
- After expiry, use the agent ID with `hub send`, `agent://<id>`, or `history://<id>`.
- `completed` means successful exit, not accepted artifacts; verify claims.
- Ask peers about their work; NEVER inspect another session through shell, grep, or file reads.
- NEVER use Hub when a normal tool can answer directly.

# Processes
- Long-running services, watchers, debuggers, REPLs, and interactive processes MUST use `start`, not `bash`.
- Processes are project-scoped and addressed by stable `name`.
- `start` launches `application` plus `args`; `cwd` defaults to the session directory and `pty` defaults true.
- Every supplied readiness condition MUST pass; process creation alone is not readiness.
- `ready.log` is a JavaScript `RegExp` compiled with the `u` flag; PCRE inline modifiers such as `(?i)` are REJECTED.
- `ready.port` is a TCP port; `ready.timeout` is seconds; both supplied? BOTH MUST pass.
- Names are unique per project directory.
- A live name MUST be stopped or restarted before reuse; a completed name MAY be started again.
- Restart policy defaults to `no`; `on-failure` and `always` use bounded backoff.
- `persist` survives the last OMP client exit.
- `detached` survives all OMP exits and broker shutdown, implies `persist`, and disables PTY input.
- Omit `persist` and `detached` unless their survival guarantees are required.
- `ps`, `logs`, `wait`, `send`, `stop`, `restart`, and `describe` address a process by `name`.
- `logs` defaults to the last 100 lines; `head: true` reads the beginning.
- `logs.grep` and `wait.pattern` are JavaScript `RegExp` values compiled with the `u` flag.
- `follow: true` waits for output after `cursor`; reuse the returned cursor on the next call.
- `wait` with `name` blocks until readiness, exit, `pattern`, or `timeout`.
- `send` with `name` writes `text` to stdin, sends `keys`, or delivers a `signal` through one serialized stream.
- `stop` terminates the process tree gracefully before hard-kill; NEVER kill an unverified PID through Bash.
- `restart` reuses the retained launch specification.
