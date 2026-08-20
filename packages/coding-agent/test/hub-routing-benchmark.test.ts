import { describe, expect, it } from "bun:test";
import {
	HUB_ROUTING_SCENARIOS,
	parseHubRoutingAssistantEvent,
	parseHubRoutingBenchmarkArgs,
	scoreHubRoutingCall,
} from "../scripts/bench-hub-routing";

function assistantEvent(calls: Array<{ name: string; arguments: Record<string, unknown> }>): unknown {
	return {
		type: "message_end",
		message: {
			role: "assistant",
			content: calls.map((call, index) => ({ type: "toolCall", id: `call-${index}`, ...call })),
			usage: {
				input: 100,
				output: 20,
				cacheRead: 10,
				cacheWrite: 0,
				totalTokens: 130,
				cost: { total: 0.01 },
			},
		},
	};
}

describe("Hub routing benchmark", () => {
	it("freezes the five requested Codex models and safe evaluator defaults", () => {
		const options = parseHubRoutingBenchmarkArgs([]);
		expect(options).toEqual({
			models: [
				"openai-codex/gpt-5.6-sol",
				"openai-codex/gpt-5.6-terra",
				"openai-codex/gpt-5.6-luna",
				"openai-codex/gpt-5.5",
				"openai-codex/gpt-5.4-mini",
			],
			scenarioIds: ["peer-message", "readiness-start", "cursor-logs", "process-input"],
			timeoutSeconds: 60,
			json: false,
		});
	});

	it("accepts the exact domain call while requiring provider-visible intent", () => {
		const scenario = HUB_ROUTING_SCENARIOS[0]!;
		const observation = parseHubRoutingAssistantEvent(
			assistantEvent([{ name: "hub", arguments: { i: "Ask the named peer", ...scenario.expected } }]),
		);
		expect(observation).toBeDefined();
		expect(scoreHubRoutingCall(scenario, observation!)).toEqual({ passed: true });
		expect(observation?.usage).toEqual({
			input: 100,
			output: 20,
			cacheRead: 10,
			cacheWrite: 0,
			totalTokens: 130,
			cost: 0.01,
		});
	});

	it("rejects extra domain arguments and multiple calls", () => {
		const scenario = HUB_ROUTING_SCENARIOS[3]!;
		const extraArgument = parseHubRoutingAssistantEvent(
			assistantEvent([{ name: "hub", arguments: { i: "Interrupt debugger", ...scenario.expected, enter: true } }]),
		);
		const multipleCalls = parseHubRoutingAssistantEvent(
			assistantEvent([
				{ name: "hub", arguments: { i: "Interrupt debugger", ...scenario.expected } },
				{ name: "hub", arguments: { i: "Inspect debugger", op: "describe", name: "debugger" } },
			]),
		);
		expect(scoreHubRoutingCall(scenario, extraArgument!)).toEqual({
			passed: false,
			reason: "Hub arguments differ from the frozen expected call",
		});
		expect(scoreHubRoutingCall(scenario, multipleCalls!)).toEqual({
			passed: false,
			reason: "expected one tool call, received 2",
		});
	});
});
