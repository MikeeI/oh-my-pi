import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildSystemPrompt } from "@oh-my-pi/pi-coding-agent/system-prompt";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

const EMPTY_TREE = {
	rootPath: "",
	rendered: "",
	truncated: false,
	totalLines: 0,
	agentsMdFiles: [],
};

// Regression: Bun on macOS 15+ may report `os.version() === "unknown"`.
// The compact OS field deliberately uses uname-style type/release values so the
// workstation identity remains valid while avoiding the old verbose Kernel line.
describe("system prompt workstation identity", () => {
	let tempDir = "";
	let tempHomeDir = "";
	let osReleasePath = "";
	let originalHome: string | undefined;
	let originalPlatform = process.platform;
	const cleanup = cleanupTempHome(() => ({ tempDir, tempHomeDir, originalHome }));

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-prompt-workstation-"));
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-prompt-workstation-home-"));
		osReleasePath = path.join(tempDir, "os-release");
		fs.writeFileSync(osReleasePath, 'PRETTY_NAME="Synthetic Linux 24.04"\n');
		originalHome = process.env.HOME;
		originalPlatform = process.platform;
		process.env.HOME = tempHomeDir;

		const realFile = Bun.file.bind(Bun);
		vi.spyOn(Bun, "file").mockImplementation((source, options) => {
			if (source === "/etc/os-release") return realFile(osReleasePath, options);
			return realFile(source as string, options);
		});
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		vi.restoreAllMocks();
		cleanup();
	});

	async function renderWorkstation(): Promise<string> {
		const { systemPrompt } = await buildSystemPrompt({
			cwd: tempDir,
			contextFiles: [],
			skills: [],
			rules: [],
			toolNames: [],
			workspaceTree: { ...EMPTY_TREE, rootPath: tempDir },
		});
		const rendered = systemPrompt.join("\n\n");
		return /<workstation>\n(?<content>[\s\S]*?)\n<\/workstation>/u.exec(rendered)?.groups?.content ?? "";
	}

	it("renders user@host, compact Linux identity, and timezone", async () => {
		vi.spyOn(os, "hostname").mockReturnValue("AX101-1");
		vi.spyOn(os, "type").mockReturnValue("Linux");
		vi.spyOn(os, "release").mockReturnValue("6.8.0-test");
		vi.spyOn(os, "arch").mockReturnValue("x64");

		const workstation = await renderWorkstation();

		expect(workstation).toContain(`- Identity: ${os.userInfo().username}@AX101-1`);
		expect(workstation).toContain("- OS: Synthetic Linux 24.04 · Linux 6.8.0-test · x64");
		expect(workstation).toContain(`- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
		expect(workstation).not.toContain("- Distro:");
		expect(workstation).not.toContain("- Kernel:");
		expect(workstation).not.toContain("- Arch:");
	});

	it("keeps macOS identity valid when os.version returns unknown", async () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		vi.spyOn(os, "version").mockReturnValue("unknown");
		vi.spyOn(os, "type").mockReturnValue("Darwin");
		vi.spyOn(os, "release").mockReturnValue("25.5.0");
		vi.spyOn(os, "arch").mockReturnValue("arm64");

		const workstation = await renderWorkstation();

		expect(workstation).toContain("- OS: Darwin 25.5.0 · arm64");
		expect(workstation).not.toContain("unknown");
	});

	it("falls back to the OS type when os-release is unavailable", async () => {
		osReleasePath = path.join(tempDir, "missing-os-release");
		vi.spyOn(os, "type").mockReturnValue("Linux");
		vi.spyOn(os, "release").mockReturnValue("6.8.0-test");
		vi.spyOn(os, "arch").mockReturnValue("x64");

		const workstation = await renderWorkstation();

		expect(workstation).toContain("- OS: Linux 6.8.0-test · x64");
	});
});
