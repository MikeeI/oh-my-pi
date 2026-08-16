import { describe, expect, it } from "bun:test";
import { loadStatsSummary, renderStatsSummary, type StatsSummaryByRange, type StatsSummaryRange } from "../src/summary";
import type { AggregatedStats, DashboardStats, FolderStats, ModelStats } from "../src/types";

const SUMMARY_OPTIONS = { dashboardCommand: "omp stats" } as const;

function makeAggregated(overrides: Partial<AggregatedStats>): AggregatedStats {
	return {
		totalRequests: 0,
		successfulRequests: 0,
		failedRequests: 0,
		errorRate: 0,
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalCacheReadTokens: 0,
		totalCacheWriteTokens: 0,
		cacheRate: 0,
		cacheSavings: 0,
		totalCost: 0,
		totalPremiumRequests: 0,
		avgDuration: null,
		avgTtft: null,
		avgTokensPerSecond: null,
		firstTimestamp: 0,
		lastTimestamp: 0,
		...overrides,
	};
}

function makeDashboard(overall: AggregatedStats, overrides: Partial<Omit<DashboardStats, "overall">>): DashboardStats {
	return {
		overall,
		byModel: overrides.byModel ?? [],
		byFolder: overrides.byFolder ?? [],
		byAgentType: overrides.byAgentType ?? [],
		timeSeries: overrides.timeSeries ?? [],
		modelSeries: overrides.modelSeries ?? [],
		modelPerformanceSeries: overrides.modelPerformanceSeries ?? [],
		costSeries: overrides.costSeries ?? [],
	};
}

function makeModel(model: string, conversation: number, requests: number): ModelStats {
	return {
		provider: "openai-codex",
		model,
		...makeAggregated({
			totalRequests: requests,
			successfulRequests: requests,
			totalCacheReadTokens: conversation,
			cacheRate: 0.975,
			totalCost: requests / 10,
		}),
	};
}

function makeFolder(folder: string, conversation: number, requests: number): FolderStats {
	return {
		folder,
		...makeAggregated({
			totalRequests: requests,
			successfulRequests: requests,
			totalCacheReadTokens: conversation,
			totalCost: requests / 20,
		}),
	};
}

function repeatDashboard(stats: DashboardStats): StatsSummaryByRange {
	return { "24h": stats, "7d": stats, "30d": stats };
}

describe("stats summary", () => {
	it("loads every required rolling range exactly once", async () => {
		const calls: StatsSummaryRange[] = [];
		const dashboards: StatsSummaryByRange = {
			"24h": makeDashboard(makeAggregated({ totalRequests: 24 }), {}),
			"7d": makeDashboard(makeAggregated({ totalRequests: 7 }), {}),
			"30d": makeDashboard(makeAggregated({ totalRequests: 30 }), {}),
		};

		const loaded = await loadStatsSummary(async range => {
			calls.push(range);
			return dashboards[range];
		});

		expect(calls).toEqual(["24h", "7d", "30d"]);
		expect(loaded["24h"].overall.totalRequests).toBe(24);
		expect(loaded["7d"].overall.totalRequests).toBe(7);
		expect(loaded["30d"].overall.totalRequests).toBe(30);
	});

	it("renders complete rolling ranges in fixed order with aligned metrics and absolute errors", () => {
		const statsByRange: StatsSummaryByRange = {
			"24h": makeDashboard(
				makeAggregated({
					totalRequests: 6_200,
					successfulRequests: 6_198,
					failedRequests: 2,
					errorRate: 2 / 6_200,
					totalInputTokens: 20_000_000,
					totalOutputTokens: 2_000_000,
					totalCacheReadTokens: 799_000_000,
					totalCost: 482.22,
				}),
				{},
			),
			"7d": makeDashboard(
				makeAggregated({
					totalRequests: 61_000,
					successfulRequests: 60_993,
					failedRequests: 7,
					errorRate: 7 / 61_000,
					totalCacheReadTokens: 6_600_000_000,
					totalCost: 3_091.94,
				}),
				{},
			),
			"30d": makeDashboard(
				makeAggregated({
					totalRequests: 242_000,
					successfulRequests: 241_969,
					failedRequests: 31,
					errorRate: 31 / 242_000,
					totalCacheReadTokens: 25_000_000_000,
					totalCost: 13_948.14,
				}),
				{},
			),
		};

		const output = renderStatsSummary(statsByRange, SUMMARY_OPTIONS);
		const rangeSection = output.slice(0, output.indexOf("\nDETAILS"));
		expect(rangeSection.indexOf("24h")).toBeLessThan(rangeSection.indexOf("7d"));
		expect(rangeSection.indexOf("7d")).toBeLessThan(rangeSection.indexOf("30d"));
		expect(rangeSection).toContain("2 (0.0%)");
		expect(rangeSection).toContain("7 (0.0%)");
		expect(rangeSection).toContain("31 (0.0%)");
		expect(rangeSection).toContain("$3,091.94");
		expect(rangeSection).toContain("$13,948.14");

		const metricLines = rangeSection
			.split("\n")
			.filter(line => /^ {2}(Requests|Conversation tokens|Cost|Errors)/.test(line));
		expect(metricLines).toHaveLength(12);
		for (const line of metricLines) expect(Bun.stringWidth(line)).toBe(34);
	});

	it("distinguishes an empty rolling range from measured zero-valued usage", () => {
		const empty = makeDashboard(makeAggregated({}), {});
		const output = renderStatsSummary(repeatDashboard(empty), SUMMARY_OPTIONS);
		const rangeSection = output.slice(0, output.indexOf("\nDETAILS"));

		expect(rangeSection.match(/No recorded requests\./g)).toHaveLength(3);
		expect(rangeSection).not.toContain("Cost");
		expect(output).toContain("No recorded agent usage.");
		expect(output).toContain("No recorded model usage.");
		expect(output).toContain("No recorded folder usage.");
	});

	it("renders explicit agent, model, and full sanitized folder metrics ordered by conversation tokens", () => {
		const overall = makeAggregated({
			totalRequests: 100,
			successfulRequests: 99,
			failedRequests: 1,
			errorRate: 0.01,
			totalInputTokens: 100,
			totalOutputTokens: 100,
			totalCacheReadTokens: 800,
			cacheRate: 0.8,
			cacheSavings: 0.7,
			totalCost: 12.34,
		});
		const longFolder =
			"\u001b[31mhome-project-settings-omp-1447addc5fe9f75f57461942c9190e04f2ecf7b7b5d2661979a6ef2e0ff1d17d\tsegment\nsuffix";
		const dashboard = makeDashboard(overall, {
			byAgentType: [
				{
					agentType: "subagent",
					totalRequests: 20,
					totalInputTokens: 0,
					totalOutputTokens: 0,
					totalCacheReadTokens: 200,
					totalCacheWriteTokens: 0,
					totalCost: 2,
				},
				{
					agentType: "main",
					totalRequests: 80,
					totalInputTokens: 100,
					totalOutputTokens: 100,
					totalCacheReadTokens: 600,
					totalCacheWriteTokens: 0,
					totalCost: 10.34,
				},
			],
			byModel: [
				makeModel("smallest", 100, 1),
				makeModel("zeta", 500, 5),
				makeModel("fourth", 300, 3),
				makeModel("fifth", 200, 2),
				makeModel("alpha", 500, 5),
				makeModel("largest", 600, 6),
			],
			byFolder: [
				makeFolder("omitted", 100, 1),
				makeFolder("zeta", 500, 5),
				makeFolder("fourth", 300, 3),
				makeFolder("fifth", 200, 2),
				makeFolder("alpha", 500, 5),
				makeFolder(longFolder, 900, 9),
			],
		});

		const output = renderStatsSummary(repeatDashboard(dashboard), SUMMARY_OPTIONS);
		expect(output.indexOf("\nMain\n")).toBeLessThan(output.indexOf("\nSubagent\n"));
		expect(output).toContain("Conversation tokens");
		expect(output).toContain("Conversation share");
		expect(output).toContain("Cache rate");
		expect(output.indexOf("openai-codex/largest")).toBeLessThan(output.indexOf("openai-codex/alpha"));
		expect(output.indexOf("openai-codex/alpha")).toBeLessThan(output.indexOf("openai-codex/zeta"));
		expect(output).not.toContain("openai-codex/smallest");
		expect(output).toContain("1 more model; use omp stats for the dashboard.");
		expect(output.indexOf("\n2. alpha\n")).toBeLessThan(output.indexOf("\n3. zeta\n"));
		expect(output).not.toContain("omitted");
		expect(output).toContain("1 more folder; use omp stats for the dashboard.");
		expect(output).toContain(
			"home-project-settings-omp-1447addc5fe9f75f57461942c9190e04f2ecf7b7b5d2661979a6ef2e0ff1d17d",
		);
		expect(output).toContain("segment suffix");
		expect(output).not.toContain("\u001b");
		expect(output).not.toContain("\t");
	});

	it("moves overlong numeric values below their labels without truncating them", () => {
		const dashboard = makeDashboard(
			makeAggregated({
				totalRequests: 1_200_000,
				failedRequests: 1_200_000,
				errorRate: 1,
				totalCacheReadTokens: 1,
				totalCost: 12_345_678.9,
			}),
			{},
		);
		const output = renderStatsSummary(repeatDashboard(dashboard), SUMMARY_OPTIONS);
		const rangeSection = output.slice(0, output.indexOf("\nDETAILS"));

		expect(rangeSection).toContain("  Cost\n  $12,345,678.90");
		expect(rangeSection).toContain("  Errors\n  1.2M (100.0%)");
		for (const line of rangeSection.split("\n")) expect(Bun.stringWidth(line)).toBeLessThanOrEqual(34);
	});
});
