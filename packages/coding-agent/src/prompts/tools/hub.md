Agent coordination covers peer messaging and background-job control{{#if hasLaunch}}, plus supervised long-running processes{{/if}}.
Main agent is `Main`.
Subagents inherit task ID.
Use `op: "list"` to discover peers.
Address peers by exact roster ID and NEVER invent names.

# Messaging & Jobs

Background jobs auto-deliver when they finish.
You NEVER need to poll.
If `jobs` or `wait` observes a settled job first, that snapshot is the delivery and suppresses duplicate `async-result`.

- **`send` with `to`:** Send fire-and-forget messages without blocking.
- Delivery receipts (`delivered` or `failed`) are immediate.
- A `failed` receipt means the peer is gone, so NEVER retry.
- Sending wakes `idle` and `parked` peers.
- Lead answers with the answer, NEVER quote the prior message, and set `replyTo`.
- **Format:** Send plain prose ONLY.
- NEVER send JSON status objects.
- Share paths through `local://` or `artifact://` URLs instead of pasted blobs.
- **`wait`:** Use ONLY when completely blocked with no other work.
- `wait` returns on the first message, watched job completion, wait-window expiry, or steering interrupt.
- `wait` does NOT wait for every job, so re-issue it when another completion is still needed.
- Bare `wait` watches every running job and incoming message.
- NEVER pass every running job ID; use `ids` to narrow jobs or `from` to narrow peers.
- Use `await: true` on `send` when a specific reply blocks progress.
- **`inbox`:** Drain queued messages without blocking.
- **`cancel`:** Kill hung, stalled, or obsolete background jobs by `ids` and return immediately.
- **`jobs`:** Snapshot every job without waiting.
- A settled job row consumes auto-delivery.
- `jobs` also names running subagents without job entries, which you coordinate through `send`.
- Job rows are process-local and expire roughly five minutes after settlement.
- After expiry, use the agent ID with `send`, `agent://<id>`, or `history://<id>`.
- `completed` means successful yield or job exit, not artifact acceptance.
- Verify claimed changes.
- NEVER inspect peers through shell tools, grep, or their session files; message them directly.
- NEVER use Hub messaging when a normal tool can answer.

{{#if hasLaunch}}
# Processes

Project-scoped long-running processes are shared by every omp instance in the same directory.
A long-running service, watcher, debugger, REPL, or process needing later input MUST use `op:"start"`, not `bash`.

- **`start`:** Launch `application` plus `args` directly.
- `cwd` defaults to the session directory, and `pty` defaults to true.
- `ready.log` is a regex, and `ready.port` is a TCP port.
- Both supplied readiness conditions MUST pass.
- `ready.timeout` is measured in seconds.
- Readiness MUST be observed because process creation alone is not readiness.
- Names are unique per project directory.
- A completed name MAY start again, while a live name MUST be stopped or restarted.
- `restart` policy defaults to `no`, while `on-failure` and `always` use bounded backoff.
- `persist: true` opts out of last-omp teardown.
- `detached: true` survives broker shutdown and all omp exits, implies persistence, and disables PTY input.
- Omit `persist` and `detached` unless their survival guarantees are required.
- **Process operations:** `ps`, `logs`, `wait`, `send`, `stop`, `restart`, and `describe` address the stable `name`.
- `logs` defaults to the last 100 lines, while `head: true` reads the beginning.
- `grep` is a regex, and `follow: true` waits for output after `cursor`.
- Reuse the returned cursor on the next `logs` call.
- `wait` with `name` blocks until readiness, exit, `pattern`, or `timeout` in seconds.
- `send` with `name` writes `text` to stdin, and `enter` defaults to true.
- `keys` supports ENTER, TAB, ESCAPE, CTRL_C, CTRL_D, UP, DOWN, LEFT, and RIGHT.
- `signal` supports SIGINT, SIGTERM, SIGHUP, SIGQUIT, and SIGKILL.
- PTY input is serialized, and writes share one input stream.
- `stop` gracefully terminates the process tree before hard-kill.
- NEVER kill an unverified PID through Bash.
- `restart` reuses the retained launch specification.
{{/if}}
