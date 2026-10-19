/**
 * Check for and install updates.
 */

import { Command, Flags } from "@oh-my-pi/pi-utils/cli";
import { updateHelp as commandHelp } from "../cli/command-help";
import { APP_DISPLAY_NAME, APP_PACKAGE_NAME, isMompPackageName } from "../app-version";
import * as pluginCli from "../cli/plugin-cli";
import * as updateCli from "../cli/update-cli";
import { CliUsageError } from "../cli/usage-error";
import { initTheme } from "@oh-my-pi/pi-tui/theme";

// The personal fork never self-installs, so its help describes what each flag actually does there.
const MOMP_PACKAGE = isMompPackageName(APP_PACKAGE_NAME);
const MOMP_DISABLED_FLAG = "Disabled for momp; prints the manual install command";

export default class Update extends Command {
	static description = commandHelp.description;
	static flags = {
		force: Flags.boolean({
			char: "f",
			description: MOMP_PACKAGE ? MOMP_DISABLED_FLAG : "Force update",
			default: false,
		}),
		check: Flags.boolean({
			char: "c",
			description: MOMP_PACKAGE
				? "Print the installed version and the manual install command"
				: "Check for updates without installing",
			default: false,
		}),
		plugins: Flags.boolean({ char: "l", description: "Update installed plugins", default: false }),
		canary: Flags.boolean({
			description: MOMP_PACKAGE ? MOMP_DISABLED_FLAG : "Switch to the canary channel and update",
			default: false,
		}),
		stable: Flags.boolean({
			description: MOMP_PACKAGE ? MOMP_DISABLED_FLAG : "Switch back to the stable channel",
			default: false,
		}),
	};

	static examples = MOMP_PACKAGE
		? [`${APP_DISPLAY_NAME} update --check`, `${APP_DISPLAY_NAME} update --plugins`]
		: [`${APP_DISPLAY_NAME} update`, `${APP_DISPLAY_NAME} update --check`, `${APP_DISPLAY_NAME} update --canary`];

	async run(): Promise<void> {
		const { flags } = await this.parse(Update);
		await initTheme();
		if (flags.canary && flags.stable) throw new CliUsageError("--canary and --stable are mutually exclusive");
		if (flags.plugins) {
			await pluginCli.runPluginCommand({ action: "upgrade", args: [], flags: {} });
		} else {
			await updateCli.runUpdateCommand({
				force: flags.force,
				check: flags.check,
				channel: flags.canary ? "canary" : flags.stable ? "stable" : undefined,
			});
		}
	}
}
