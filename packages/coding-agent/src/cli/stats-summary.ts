import type { AgentType, AggregatedStats, DashboardStats } from "@oh-my-pi/omp-stats/shared-types";
import { replaceTabs } from "@oh-my-pi/pi-tui";
import { formatDuration, formatNumber, formatPercent, sanitizeText } from "@oh-my-pi/pi-utils";

const STATS_SUMMARY_RANGES = ["24h", "7d", "30d"] as const;
const SUMMARY_LIST_LIMIT = 5;
const SUMMARY_LABEL_WIDTH = 20;
const SUMMARY_VALUE_WIDTH = 12;
const SUMMARY_INDENT = "  ";
const SUMMARY_ITEM_INDENT = "   ";
const AGENT_PRESENTATION = {
	main: { order: 0, label: "Main" },
	subagent: { order: 1, label: "Subagent" },
	advisor: { order: 2, label: "Advisor" },
} satisfies Record<AgentType, { order: number; label: string }>;

export type StatsSummaryRange = (typeof STATS_SUMMARY_RANGES)[number];
export type StatsSummaryByRange = Readonly<Record<StatsSummaryRange, DashboardStats>>;
export type StatsSummaryLoader = (range: StatsSummaryRange) => Promise<DashboardStats>;

export interface StatsSummaryRenderOptions {
	dashboardCommand: string;
}

interface ConversationTokenStats {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
}

type SummaryMetric = readonly [label: string, value: string];

function formatCost(n: number): string {
	const absolute = Math.abs(n);
	const digits = absolute < 0.01 ? 4 : absolute < 1 ? 3 : 2;
	return `$${n.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	})}`;
}

function normalizePremiumRequests(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

function conversationTokens(stats: ConversationTokenStats): number {
	return stats.totalInputTokens + stats.totalOutputTokens + stats.totalCacheReadTokens + stats.totalCacheWriteTokens;
}

function metricLines(label: string, value: string, indent: string): string[] {
	if (Bun.stringWidth(value) > SUMMARY_VALUE_WIDTH) return [`${indent}${label}`, `${indent}${value}`];
	return [`${indent}${label.padEnd(SUMMARY_LABEL_WIDTH)}${value.padStart(SUMMARY_VALUE_WIDTH)}`];
}

function renderMetrics(metrics: readonly SummaryMetric[], indent = SUMMARY_INDENT): string[] {
	return metrics.flatMap(([label, value]) => metricLines(label, value, indent));
}

function formatErrors(stats: AggregatedStats): string {
	return `${formatNumber(stats.failedRequests)} (${formatPercent(stats.errorRate)})`;
}

function sanitizeSummaryName(value: string): string {
	return replaceTabs(sanitizeText(value))
		.replace(/[\r\n]+/g, " ")
		.trim();
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function renderRangeBlock(range: StatsSummaryRange, stats: DashboardStats): string[] {
	const { overall } = stats;
	const lines: string[] = [range];
	if (overall.totalRequests === 0) {
		lines.push(`${SUMMARY_INDENT}No recorded requests.`);
		return lines;
	}
	lines.push(
		...renderMetrics([
			["Requests", formatNumber(overall.totalRequests)],
			["Conversation tokens", formatNumber(conversationTokens(overall))],
			["Cost", formatCost(overall.totalCost)],
			["Errors", formatErrors(overall)],
		]),
	);
	return lines;
}

function renderDetails(overall: AggregatedStats): string[] {
	if (overall.totalRequests === 0) return ["DETAILS (rolling 24h)", "", `${SUMMARY_INDENT}No recorded requests.`];
	return [
		"DETAILS (rolling 24h)",
		"",
		...renderMetrics([
			["Uncached input", formatNumber(overall.totalInputTokens)],
			["Cache read", formatNumber(overall.totalCacheReadTokens)],
			["Cache write", formatNumber(overall.totalCacheWriteTokens)],
			["Output", formatNumber(overall.totalOutputTokens)],
			["Cache rate", formatPercent(overall.cacheRate)],
			["Cache savings", formatPercent(overall.cacheSavings)],
			["Premium requests", formatNumber(normalizePremiumRequests(overall.totalPremiumRequests ?? 0))],
			["Avg duration", overall.avgDuration === null ? "—" : formatDuration(overall.avgDuration)],
			["Avg TTFT", overall.avgTtft === null ? "—" : formatDuration(overall.avgTtft)],
			["Avg tokens/s", overall.avgTokensPerSecond === null ? "—" : overall.avgTokensPerSecond.toFixed(1)],
		]),
	];
}

function renderAgents(stats: DashboardStats): string[] {
	const lines = ["AGENTS (rolling 24h)", ""];
	const overallTokens = conversationTokens(stats.overall);
	const agents = [...stats.byAgentType].sort(
		(left, right) => AGENT_PRESENTATION[left.agentType].order - AGENT_PRESENTATION[right.agentType].order,
	);
	for (const [index, agent] of agents.entries()) {
		if (index > 0) lines.push("");
		const tokens = conversationTokens(agent);
		lines.push(
			AGENT_PRESENTATION[agent.agentType].label,
			...renderMetrics([
				["Requests", formatNumber(agent.totalRequests)],
				["Conversation tokens", formatNumber(tokens)],
				["Conversation share", formatPercent(overallTokens > 0 ? tokens / overallTokens : 0)],
				["Cost", formatCost(agent.totalCost)],
			]),
		);
	}
	if (agents.length === 0) lines.push(`${SUMMARY_INDENT}No recorded agent usage.`);
	return lines;
}

function renderModels(stats: DashboardStats, dashboardCommand: string): string[] {
	const models = [...stats.byModel].sort((left, right) => {
		const tokenDelta = conversationTokens(right) - conversationTokens(left);
		if (tokenDelta !== 0) return tokenDelta;
		return compareText(`${left.provider}/${left.model}`, `${right.provider}/${right.model}`);
	});
	const shown = models.slice(0, SUMMARY_LIST_LIMIT);
	const lines = [`MODELS (rolling 24h, top ${SUMMARY_LIST_LIMIT} by conversation tokens)`, ""];
	for (const [index, model] of shown.entries()) {
		if (index > 0) lines.push("");
		lines.push(
			`${index + 1}. ${sanitizeSummaryName(`${model.provider}/${model.model}`)}`,
			...renderMetrics(
				[
					["Requests", formatNumber(model.totalRequests)],
					["Conversation tokens", formatNumber(conversationTokens(model))],
					["Cost", formatCost(model.totalCost)],
					["Errors", formatErrors(model)],
					["Cache rate", formatPercent(model.cacheRate)],
				],
				SUMMARY_ITEM_INDENT,
			),
		);
	}
	if (shown.length === 0) lines.push(`${SUMMARY_INDENT}No recorded model usage.`);
	const omitted = models.length - shown.length;
	if (omitted > 0) {
		lines.push(
			"",
			`${SUMMARY_INDENT}${omitted} more ${omitted === 1 ? "model" : "models"}; use ${dashboardCommand} for the dashboard.`,
		);
	}
	return lines;
}

function renderFolders(stats: DashboardStats, dashboardCommand: string): string[] {
	const folders = [...stats.byFolder].sort((left, right) => {
		const tokenDelta = conversationTokens(right) - conversationTokens(left);
		if (tokenDelta !== 0) return tokenDelta;
		return compareText(left.folder, right.folder);
	});
	const shown = folders.slice(0, SUMMARY_LIST_LIMIT);
	const lines = [`FOLDERS (rolling 24h, top ${SUMMARY_LIST_LIMIT} by conversation tokens)`, ""];
	for (const [index, folder] of shown.entries()) {
		if (index > 0) lines.push("");
		lines.push(
			`${index + 1}. ${sanitizeSummaryName(folder.folder)}`,
			...renderMetrics(
				[
					["Requests", formatNumber(folder.totalRequests)],
					["Conversation tokens", formatNumber(conversationTokens(folder))],
					["Cost", formatCost(folder.totalCost)],
				],
				SUMMARY_ITEM_INDENT,
			),
		);
	}
	if (shown.length === 0) lines.push(`${SUMMARY_INDENT}No recorded folder usage.`);
	const omitted = folders.length - shown.length;
	if (omitted > 0) {
		lines.push(
			"",
			`${SUMMARY_INDENT}${omitted} more ${omitted === 1 ? "folder" : "folders"}; use ${dashboardCommand} for the dashboard.`,
		);
	}
	return lines;
}

export async function loadStatsSummary(load: StatsSummaryLoader): Promise<StatsSummaryByRange> {
	const [lastDay, lastWeek, lastMonth] = await Promise.all([load("24h"), load("7d"), load("30d")]);
	return {
		"24h": lastDay,
		"7d": lastWeek,
		"30d": lastMonth,
	};
}

export function renderStatsSummary(statsByRange: StatsSummaryByRange, options: StatsSummaryRenderOptions): string {
	const lines = ["AI Usage Statistics", "", "RANGES (rolling)", ""];
	for (const [index, range] of STATS_SUMMARY_RANGES.entries()) {
		if (index > 0) lines.push("");
		lines.push(...renderRangeBlock(range, statsByRange[range]));
	}
	const details = statsByRange["24h"];
	lines.push(
		"",
		...renderDetails(details.overall),
		"",
		...renderAgents(details),
		"",
		...renderModels(details, options.dashboardCommand),
		"",
		...renderFolders(details, options.dashboardCommand),
	);
	return lines.join("\n");
}
