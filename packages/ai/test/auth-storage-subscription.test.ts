import { afterEach, beforeEach, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type AuthCredentialStore, AuthStorage, SqliteAuthCredentialStore } from "@oh-my-pi/pi-ai/auth-storage";
import { removeWithRetries } from "../../utils/src/temp";

let tempDir = "";
let store: AuthCredentialStore | null = null;
let auth: AuthStorage | null = null;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-ai-subscription-"));
	store = await SqliteAuthCredentialStore.open(path.join(tempDir, "agent.db"));
	auth = new AuthStorage(store);
});

afterEach(async () => {
	store?.close();
	store = null;
	auth = null;
	if (tempDir) {
		await removeWithRetries(tempDir);
		tempDir = "";
	}
});

// Regression: Mistral Vibe keys bill the plan quota, but billing displays only
// recognized OAuth, so the footer showed list-price spend or nothing at all.
test("only /login keys on a login-subscription provider bill a subscription", async () => {
	const credentials = auth!.credentials;
	await credentials.set("mistral", [{ type: "api_key", key: "vibe", source: "login" }]);
	await credentials.set("deepseek", [{ type: "api_key", key: "login-metered", source: "login" }]);
	await credentials.set("openai", [{ type: "oauth", access: "a", refresh: "r", expires: Date.now() + 60_000 }]);

	expect(credentials.hasSubscription("mistral")).toBe(true);
	expect(credentials.hasOAuth("mistral")).toBe(false);
	expect(credentials.hasSubscription("deepseek")).toBe(false);
	expect(credentials.hasSubscription("openai")).toBe(true);

	await credentials.set("mistral", [{ type: "api_key", key: "console" }]);
	expect(credentials.hasSubscription("mistral")).toBe(false);
});
