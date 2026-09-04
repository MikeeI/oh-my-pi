import { expect, it } from "bun:test";
import { loadPage } from "../src/web/scrapers/types";

const CHROME_USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const GOOGLEBOT_USER_AGENT =
	"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.64 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CURL_USER_AGENT = "curl/8.21.0";

it("retries recognized bot blocks with Chrome, Googlebot, then curl", async () => {
	const userAgents: string[] = [];
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			userAgents.push(request.headers.get("user-agent") ?? "");
			if (userAgents.length < 3) {
				return new Response("Cloudflare access denied", { status: 503 });
			}
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		},
	});

	try {
		const result = await loadPage(`http://127.0.0.1:${server.port}`, { timeout: 5 });

		expect(result.ok).toBe(true);
		expect(result.content).toBe("ok");
		expect(userAgents).toEqual([CHROME_USER_AGENT, GOOGLEBOT_USER_AGENT, CURL_USER_AGENT]);
	} finally {
		server.stop(true);
	}
});
