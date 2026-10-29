import * as path from "node:path";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { roleCandidatePool } from "@oh-my-pi/pi-coding-agent/config/model-roles";
import { resolveRoleSelection } from "@oh-my-pi/pi-coding-agent/config/model-resolver";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { discoverAuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-broker-config";
import { cfgTitleIcons } from "@oh-my-pi/pi-coding-agent/utils/title-settings";
import { getAgentDir } from "@oh-my-pi/pi-utils";

const cwd = path.resolve(import.meta.dir, "../../../..");
const agentDir = getAgentDir();
const settings = await Settings.loadReadOnly({ cwd, agentDir });
const auth = await discoverAuthStorage(agentDir);
try {
	const registry = new ModelRegistry(auth, path.join(agentDir, "models.yml"), { settings });
	await registry.hydrateCredentialScopedModelCaches();
	const available = roleCandidatePool("tiny", settings, registry);
	const tiny = resolveRoleSelection(["tiny"], settings, available);
	const judge = resolveRoleSelection(["expert"], settings, available);
	if (!tiny || !judge) throw new Error("Configured tiny and independent GPT-6.1 Sol judge must resolve");
	if (tiny.model.provider === judge.model.provider && tiny.model.id === judge.model.id)
		throw new Error("Judge must differ from title model");
	const config = {
		cwd,
		agentDir,
		titleModel: { provider: tiny.model.provider, id: tiny.model.id, api: tiny.model.api },
		judgeModel: { provider: judge.model.provider, id: judge.model.id, api: judge.model.api },
		titleSelector: settings.getModelRole("tiny"),
		judgeSelector: settings.getModelRole("expert"),
		titleIcons: cfgTitleIcons.get(settings),
		sourceHashes: Object.fromEntries(
			await Promise.all(
				[
					"packages/coding-agent/src/utils/title-generator.ts",
					"packages/coding-agent/src/session/agent-session.ts",
					"packages/coding-agent/src/utils/title-card.ts",
					"packages/coding-agent/src/tiny/message-preproc.ts",
					"packages/coding-agent/src/tiny/text.ts",
				].map(async file => [file, Bun.SHA256.hash(await Bun.file(path.join(cwd, file)).arrayBuffer(), "hex")]),
			),
		),
		configHashes: Object.fromEntries(
			await Promise.all(
				["config.yml", "models.yml"].map(async file => [
					file,
					Bun.SHA256.hash(await Bun.file(path.join(agentDir, file)).arrayBuffer(), "hex"),
				]),
			),
		),
	};
	await Bun.write(path.join(import.meta.dir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
	console.log(JSON.stringify(config, null, 2));
} finally {
	auth.close();
}
