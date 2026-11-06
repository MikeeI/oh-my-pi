import { afterEach, describe, expect, it } from "bun:test";
import { resumeCommand } from "@oh-my-pi/pi-coding-agent/utils/resume-command";
import { APP_NAME, getActiveProfile, setProfile } from "@oh-my-pi/pi-utils/dirs";

describe("resumeCommand", () => {
	const originalProfile = getActiveProfile();

	afterEach(() => {
		setProfile(originalProfile);
	});

	it("omits the profile flag in the default profile", () => {
		setProfile(undefined);
		expect(resumeCommand("abc123")).toBe(`${APP_NAME} --resume abc123`);
	});

	it("carries the active profile so the emitted hint is runnable verbatim", () => {
		// Profile sessions live in ~/.omp/profiles/<name>/agent, so a resume hint
		// without --profile fails with "Session not found" (issue #9018).
		setProfile("personal");
		expect(resumeCommand("abc123")).toBe(`${APP_NAME} --profile personal --resume abc123`);
	});

	it("emits the published MOMP executable while preserving the active profile", async () => {
		const child = Bun.spawn(
			[
				"bun",
				"--eval",
				`import { resumeCommand } from ${JSON.stringify(`${import.meta.dir}/../../src/utils/resume-command.ts`)}; console.log(resumeCommand("01a1183f-2b7c-75a0-b077-b23e6d269051"));`,
			],
			{
				env: {
					...process.env,
					PI_BUNDLED: "true",
					PI_BUNDLED_PACKAGE_NAME: "@mikeei/momp",
					PI_BUNDLED_BINARY_NAME: "momp",
					OMP_PROFILE: "personal",
				},
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
		expect(stdout.trim()).toBe("momp --profile personal --resume 01a1183f-2b7c-75a0-b077-b23e6d269051");
	});
});
