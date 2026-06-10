<system-reminder>
Before substantive work, create a phased todo.

You MUST call `todo` first in this turn.
You MUST initialize the todo list with a single `init` op.
You MUST cover the entire request from investigation through implementation and verification — not just the next immediate step.
Task descriptions MUST be specific. A future turn MUST execute them without re-planning.
Task `content` MUST be a short, specific label (5-10 words), not a file path or implementation dump. If details are necessary, add them with a later `note` op after the `init`.
You MUST keep exactly one task `in_progress` and all later tasks `pending`.

After `todo` succeeds, continue the request in the same turn.
Do not call `todo` again unless task state materially changed.
</system-reminder>
