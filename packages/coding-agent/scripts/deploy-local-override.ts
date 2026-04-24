#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { $ } from "bun";

const packageDir = path.join(import.meta.dir, "..");
const repoDir = path.join(packageDir, "..", "..");
const buildOutput = path.join(packageDir, "dist", "omp");
const targetDir = "/root/.local/bin";
const targetPath = path.join(targetDir, "omp");
const realTargetPath = path.join(targetDir, "omp.bin");
const fallbackDeployTargets = ["100.109.143.114", "100.107.158.94"];

type DeployOptions = {
	deployRemote: boolean;
	targets: string[];
};

function usage(): string {
	return `Build and install the local compiled OMP binary as the preferred override.

Usage:
  bun run deploy [-- --no-remote]
  bun run deploy [-- --target 100.109.143.114]

Options:
  --no-remote       Install only on this host
  --target <host>   Remote root@host target; can be repeated or comma-separated
  -h, --help        Show this help

Environment:
  OMP_DEPLOY_TARGETS   Comma-separated remote targets; defaults to the local Tailscale target

Behavior:
  - builds packages/coding-agent/dist/omp
  - installs /root/.local/bin/omp.bin
  - installs /root/.local/bin/omp wrapper that appends -local to --version
  - deploys omp.bin + wrapper to Tailscale targets unless --no-remote is set
`;
}

function parseArgs(args: string[]): DeployOptions {
	const targets: string[] = [];
	let deployRemote = true;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(usage());
			process.exit(0);
		}
		if (arg === "--no-remote") {
			deployRemote = false;
			continue;
		}
		if (arg === "--target") {
			const value = args[index + 1];
			if (!value) throw new Error("--target requires a host");
			targets.push(...splitTargets(value));
			index += 1;
			continue;
		}
		if (arg.startsWith("--target=")) {
			targets.push(...splitTargets(arg.slice("--target=".length)));
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return { deployRemote, targets: resolveTargets(targets) };
}

function resolveTargets(cliTargets: string[]): string[] {
	if (cliTargets.length > 0) return cliTargets;
	const envTargets = splitTargets(Bun.env.OMP_DEPLOY_TARGETS ?? "");
	return envTargets.length > 0 ? envTargets : fallbackDeployTargets;
}

function splitTargets(value: string): string[] {
	return value
		.split(",")
		.map(target => target.trim())
		.filter(Boolean);
}

function log(message: string): void {
	process.stdout.write(`INFO: ${message}\n`);
}

async function run(command: string[], cwd: string): Promise<void> {
	const proc = Bun.spawn(command, {
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) throw new Error(`Command failed with exit code ${exitCode}: ${command.join(" ")}`);
}

async function assertExecutable(filePath: string): Promise<void> {
	try {
		await fs.promises.access(filePath, fs.constants.X_OK);
	} catch {
		throw new Error(`Expected executable file missing: ${filePath}`);
	}
}

async function installFileAtomically(sourcePath: string, destinationPath: string, mode: number): Promise<void> {
	await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
	const tempPath = path.join(
		path.dirname(destinationPath),
		`${path.basename(destinationPath)}.new.${crypto.randomUUID()}`,
	);
	try {
		await Bun.write(tempPath, Bun.file(sourcePath));
		await fs.promises.chmod(tempPath, mode);
		await fs.promises.rename(tempPath, destinationPath);
	} catch (err) {
		await fs.promises.rm(tempPath, { force: true }).catch(() => {});
		throw err;
	}
}

async function writeFileAtomically(destinationPath: string, content: string, mode: number): Promise<void> {
	await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
	const tempPath = path.join(
		path.dirname(destinationPath),
		`${path.basename(destinationPath)}.new.${crypto.randomUUID()}`,
	);
	try {
		await Bun.write(tempPath, content);
		await fs.promises.chmod(tempPath, mode);
		await fs.promises.rename(tempPath, destinationPath);
	} catch (err) {
		await fs.promises.rm(tempPath, { force: true }).catch(() => {});
		throw err;
	}
}

async function backupExistingOverride(): Promise<void> {
	try {
		await fs.promises.access(targetPath);
	} catch {
		return;
	}

	const timestamp = new Date()
		.toISOString()
		.replaceAll(/[-:TZ.]/g, "")
		.slice(0, 14);
	const backupPath = path.join(targetDir, `omp.backup.${timestamp}`);
	await Bun.write(backupPath, Bun.file(targetPath));
	await fs.promises.chmod(backupPath, 0o755);
	log(`Backed up existing override to ${backupPath}`);
}

function wrapperContent(): string {
	return String.raw`#!/bin/bash
set -euo pipefail

REAL_BIN="/root/.local/bin/omp.bin"

if [[ ! -x "$REAL_BIN" ]]; then
    echo "error: missing local omp binary at $REAL_BIN" >&2
    exit 1
fi

if [[ "${"$"}{1:-}" == "--version" || "${"$"}{1:-}" == "-v" || "${"$"}{1:-}" == "version" ]]; then
    VERSION_OUTPUT=$("$REAL_BIN" "$@" 2>/dev/null || true)
    if [[ -n "$VERSION_OUTPUT" ]]; then
        printf '%s\n' "$VERSION_OUTPUT" | sed -E 's#^(omp[/ ]v?)([0-9]+\.[0-9]+\.[0-9]+)(\.[0-9]+)?([+-][A-Za-z0-9._-]+)?$#\1\2-local#'
        exit 0
    fi
fi

exec "$REAL_BIN" "$@"
`;
}

async function verifyLocalInstall(): Promise<void> {
	log("Verifying login-shell resolution...");
	const result = await $`bash -lc ${"hash -r; which omp; omp --version"}`.quiet().nothrow();
	const output = result.text().trim();
	if (output) log(output);
	if (result.exitCode !== 0) throw new Error(`Local verification failed with exit code ${result.exitCode}`);
	const lines = output.split("\n");
	if (lines[0] !== targetPath) throw new Error(`Active omp did not resolve to ${targetPath}`);
}

async function canReachTarget(target: string): Promise<boolean> {
	const result = await $`ssh -o ConnectTimeout=5 -o BatchMode=yes ${`root@${target}`} true`.quiet().nothrow();
	return result.exitCode === 0;
}

async function deployRemoteTargets(targets: string[]): Promise<void> {
	if (targets.length === 0) return;
	log(`Deploying to ${targets.length} remote target(s)...`);
	for (const target of targets) {
		if (!(await canReachTarget(target))) {
			log(`Skipping ${target} (offline or unreachable)`);
			continue;
		}
		await $`ssh ${`root@${target}`} mkdir -p ${targetDir}`;
		await $`scp -q ${realTargetPath} ${targetPath} ${`root@${target}:${targetDir}/`}`;
		const version = await $`ssh ${`root@${target}`} ${`${targetPath} --version`}`.quiet().text();
		log(`Deployed to ${target}: ${version.trim()}`);
	}
}

async function main(): Promise<void> {
	const options = parseArgs(Bun.argv.slice(2));
	log(`Using repo: ${repoDir}`);
	log("Building compiled omp binary...");
	await run(["bun", "run", "build"], packageDir);
	await assertExecutable(buildOutput);
	await backupExistingOverride();
	await installFileAtomically(buildOutput, realTargetPath, 0o755);
	log(`Installed real binary to ${realTargetPath}`);
	await writeFileAtomically(targetPath, wrapperContent(), 0o755);
	log(`Installed wrapper to ${targetPath}`);
	await verifyLocalInstall();
	log("Local omp override is active and will stay ahead of /root/.bun/bin/omp");
	if (options.deployRemote) await deployRemoteTargets(options.targets);
}

await main();
