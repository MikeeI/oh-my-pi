import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { TempDir } from "@oh-my-pi/pi-utils";

const STATS_ENTRY = path.join(import.meta.dir, "../src/index.ts");
const STATS_PACKAGE = path.join(import.meta.dir, "..");

function isolatedEnv(home: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		HOME: home,
		OMP_PROFILE: "",
		PI_CODING_AGENT_DIR: path.join(home, "agent"),
		PI_CONFIG_DIR: ".omp",
	};
	delete env.PI_PROFILE;
	delete env.XDG_DATA_HOME;
	delete env.XDG_STATE_HOME;
	delete env.XDG_CACHE_HOME;
	return env;
}

describe("omp-stats CLI output", () => {
	it("keeps sync diagnostics on stderr so JSON is the only stdout payload", async () => {
		using tempDir = TempDir.createSync("@omp-stats-cli-output-");
		const child = Bun.spawn([process.execPath, STATS_ENTRY, "--json"], {
			cwd: STATS_PACKAGE,
			env: isolatedEnv(tempDir.path()),
			stdout: "pipe",
			stderr: "pipe",
		});
		const [exitCode, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);

		expect(exitCode, stderr).toBe(0);
		expect(stderr).toContain("Syncing session files...");
		expect(stderr).toContain("Synced 0 new entries from 0 files (0 total)");
		const payload: unknown = JSON.parse(stdout);
		expect(payload).toMatchObject({
			overall: { totalRequests: 0 },
			byModel: [],
			byFolder: [],
		});
	}, 60_000);
});
