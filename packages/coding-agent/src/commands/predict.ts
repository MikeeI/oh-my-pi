import { CliUsageError, Command } from "@oh-my-pi/pi-utils/cli";
import { predictHelp as commandHelp } from "../cli/command-help";
import { APP_DISPLAY_NAME } from "../app-version";
import { runPredictCompare } from "../cli/predict-cli";

export default class Predict extends Command {
	static description = commandHelp.description;

	static examples = [`${APP_DISPLAY_NAME} predict`];

	async run(): Promise<void> {
		await this.parse(Predict);
		if (!process.stdin.isTTY || !process.stdout.isTTY)
			throw new CliUsageError(`${APP_DISPLAY_NAME} predict needs an interactive terminal`);
		await runPredictCompare();
	}
}
