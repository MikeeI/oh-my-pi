import { afterEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { Routine, RoutineProgress } from "@oh-my-pi/pi-coding-agent/extensibility/routines";
import { AgentSession, SessionBusyError } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

const routine: Routine = {
	name: "review-all",
	description: "Run reviews",
	path: "/tmp/review-all.yaml",
	steps: [{ message: "Routine step" }],
	level: "user",
	_source: { provider: "test", providerName: "Test", path: "/tmp/review-all.yaml", level: "user" },
};

describe("AgentSession routine lock", () => {
	let tempDir: TempDir | undefined;
	let authStorage: AuthStorage | undefined;
	let session: AgentSession | undefined;

	afterEach(async () => {
		vi.restoreAllMocks();
		await session?.dispose();
		authStorage?.close();
		tempDir?.removeSync();
		resetSettingsForTest();
	});

	it("rejects direct follow-up while a routine step is active", async () => {
		tempDir = TempDir.createSync("@pi-routine-lock-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected built-in anthropic model to exist");

		const agent = new Agent({
			initialState: {
				model,
				systemPrompt: ["Test"],
				tools: [],
				messages: [],
			},
		});
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry,
			routines: [routine],
		});
		const promptStarted = Promise.withResolvers<void>();
		const releasePrompt = Promise.withResolvers<void>();
		vi.spyOn(agent, "prompt").mockImplementation(async () => {
			promptStarted.resolve();
			await releasePrompt.promise;
		});

		const routineRun = session.runRoutineInvocation("/review-all");
		await promptStarted.promise;

		await expect(session.followUp("external follow-up")).rejects.toThrow("A routine is running");

		releasePrompt.resolve();
		await expect(routineRun).resolves.toBe(true);
	});

	it("rejects idle-only snapshot forks while a routine is paused between turns", async () => {
		tempDir = TempDir.createSync("@pi-routine-snapshot-lock-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected built-in anthropic model to exist");

		const sessionManager = SessionManager.create(tempDir.path(), path.join(tempDir.path(), "sessions"));
		sessionManager.appendMessage({ role: "user", content: "Existing transcript", timestamp: Date.now() });
		await sessionManager.flush();
		const agent = new Agent({
			initialState: {
				model,
				systemPrompt: ["Test"],
				tools: [],
				messages: sessionManager.buildSessionContext().messages,
			},
		});
		session = new AgentSession({
			agent,
			sessionManager,
			settings: Settings.isolated(),
			modelRegistry,
			routines: [routine],
		});
		vi.spyOn(agent, "prompt").mockResolvedValue(undefined);
		const progressStarted = Promise.withResolvers<void>();
		const releaseProgress = Promise.withResolvers<void>();
		const sourceFile = session.sessionFile;
		const routineRun = session.runRoutineInvocation("/review-all", {
			onProgress: async progress => {
				if (progress.status !== "running") return;
				progressStarted.resolve();
				await releaseProgress.promise;
			},
		});
		await progressStarted.promise;

		try {
			await expect(session.fork(undefined, { requireIdle: true })).rejects.toBeInstanceOf(SessionBusyError);
			expect(session.sessionFile).toBe(sourceFile);
		} finally {
			releaseProgress.resolve();
			await routineRun;
		}
	});

	it.each(["error", "cancelled"] as const)("does not complete after a terminal %s", async outcome => {
		tempDir = TempDir.createSync("@pi-routine-outcome-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		const lastStepStarted = Promise.withResolvers<void>();
		const releaseLastStep = Promise.withResolvers<void>();
		const mock = createMockModel({
			responses:
				outcome === "error"
					? [{ stopReason: "error", errorMessage: "Routine provider failure" }, { content: ["Must not run"] }]
					: [
							{ content: ["First step done"] },
							async () => {
								lastStepStarted.resolve();
								await releaseLastStep.promise;
								return { content: ["Interrupted final step"] };
							},
						],
		});
		authStorage.keys.setRuntime(mock.provider, "test-key");
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model: mock, systemPrompt: ["Test"], tools: [], messages: [] },
			streamFn: mock.stream,
		});
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated({
				"compaction.enabled": false,
				"retry.enabled": false,
				"retry.modelFallback": false,
				"todo.enabled": false,
				"todo.reminders": false,
			}),
			modelRegistry: new ModelRegistry(authStorage),
			routines: [{ ...routine, steps: [{ message: "First step" }, { message: "Last step" }] }],
		});
		const progress: RoutineProgress[] = [];
		const run = session.runRoutineInvocation("/review-all", {
			onProgress: update => {
				progress.push(update);
			},
		});
		// Observe rejection immediately without awaiting a test assertion before driving cancellation.
		const settled = run.then(
			() => undefined,
			(error: unknown) => error,
		);
		if (outcome === "cancelled") {
			await lastStepStarted.promise;
			const abort = session.abort();
			releaseLastStep.resolve();
			await abort;
		}
		expect(await settled).toBeInstanceOf(Error);
		expect(await settled).toMatchObject({
			message: outcome === "error" ? "Routine provider failure" : "Routine cancelled",
		});
		expect(progress.at(-1)).toMatchObject({
			status: outcome === "error" ? "failed" : "cancelled",
			index: outcome === "error" ? 1 : 2,
		});
		expect(progress.some(update => update.status === "complete")).toBe(false);
		expect(mock.calls).toHaveLength(outcome === "error" ? 1 : 2);
	});
});
