#!/usr/bin/env bun
import * as path from "node:path";

export function buildCompileArgs(versionOverride: string | undefined): string[] {
	const args = ["build", "--compile", "--define", "PI_COMPILED=true"];
	if (versionOverride && versionOverride.length > 0) {
		args.push("--define", `PI_VERSION_OVERRIDE=${JSON.stringify(versionOverride)}`);
	}
	args.push("--external", "mupdf", "--root", "../..", "./src/cli.ts", "--outfile", "dist/omp");
	return args;
}

async function main(): Promise<void> {
	const cwd = path.join(import.meta.dir, "..");
	const proc = Bun.spawn(["bun", ...buildCompileArgs(Bun.env.PI_VERSION_OVERRIDE)], {
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) process.exit(exitCode);
}

if (import.meta.main) {
	await main();
}
