#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import * as path from "node:path";
import { Agent, type AgentMessage } from "@oh-my-pi/pi-agent-core";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage, SqliteAuthCredentialStore } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

const ITERATIONS = 100;
const SAMPLE_INTERVAL = 10;
const TRANSCRIPT_BYTES = 256 * 1024;

interface MemorySample {
	readonly iteration: number;
	readonly arrayBuffers: number;
	readonly external: number;
	readonly heapTotal: number;
	readonly heapUsed: number;
	readonly rss: number;
}

function collectMemorySample(iteration: number): MemorySample {
	Bun.gc(true);
	return { iteration, ...process.memoryUsage() };
}

async function main(): Promise<void> {
	const tempDir = TempDir.createSync("@omp-runtime-heap-");
	const authStorage = new AuthStorage(new SqliteAuthCredentialStore(new Database(":memory:")));
	const model = getBundledModel("anthropic", "claude-sonnet-4-5");
	if (!model) throw new Error("Expected bundled Anthropic model for the heap scenario");
	const modelRegistry = new ModelRegistry(authStorage, path.join(tempDir.path(), "models.yml"));
	const samples: MemorySample[] = [collectMemorySample(0)];

	try {
		for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
			const bulk = `${iteration}:`.padEnd(TRANSCRIPT_BYTES, "x");
			const agent = new Agent({
				getApiKey: () => "test-key",
				initialState: { model, systemPrompt: ["heap lifecycle audit"], tools: [] },
				streamFn: createMockModel({ handler: () => ({ content: ["ok"] }) }).stream,
			});
			const session = new AgentSession({
				agent,
				sessionManager: SessionManager.inMemory(tempDir.path()),
				settings: Settings.isolated(),
				modelRegistry,
				agentId: "Main",
			});
			const messages: AgentMessage[] = [
				{ role: "user", content: [{ type: "text", text: bulk }], timestamp: Date.now() },
			];
			session.agent.replaceMessages(messages);
			session.sessionManager.appendMessage({ role: "user", content: bulk, timestamp: Date.now() });
			session.rawSseDebugBuffer.recordEvent(
				{
					event: "content_block_delta",
					data: `data: ${bulk}`,
					raw: ["event: content_block_delta", `data: ${bulk}`],
				},
				model,
			);
			await session.dispose();
			if (iteration % SAMPLE_INTERVAL === 0) samples.push(collectMemorySample(iteration));
		}
		process.stdout.write(
			`${JSON.stringify({ iterations: ITERATIONS, sampleInterval: SAMPLE_INTERVAL, transcriptBytes: TRANSCRIPT_BYTES, samples }, null, 2)}\n`,
		);
	} finally {
		authStorage.close();
		tempDir.removeSync();
	}
}

await main();
