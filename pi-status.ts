/**
 * Pi Status Extension
 *
 * Shows a green checkmark (✅) in the **terminal title** when pi is idle
 * (session finished, waiting for user input). When the user submits
 * a prompt, the checkmark becomes a braille-dot spinner (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏).
 *
 * Context-usage percentage appears beside the checkmark (idle state) in the title:
 *   ≤ 50%  → not shown
 *   > 50%  → [N%]   (e.g. ✅ [63%] 🟢 project)
 *   ≥ 90%  → ![N%]!  (e.g. ✅ ![95%]! 🟢 project)
 * The percentage is captured once when the checkmark is shown; the spinner never displays it.
 *
 * Usage:
 *   pi -e ./pi-status.ts
 *   # Or place in ~/.pi/agent/extensions/pi-status.ts for auto-discovery
 */

import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** First grapheme of PI_AGENT_NAME, e.g. "🟢", falling back to "π" */
const AGENT = Array.from(process.env.PI_AGENT_NAME || "π")[0];

function getBaseTitle(pi: ExtensionAPI): string {
	const cwd = path.basename(process.cwd());
	const session = pi.getSessionName();
	return session ? `${AGENT} ${session} - ${cwd}` : `${AGENT} ${cwd}`;
}

function getContextIndicator(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const percent = usage?.percent ?? null;
	if (!(percent > 50)) return "";
	const pct = Math.round(percent);
	const formatted = `[${pct}%]`;
	return ` ${percent >= 90 ? `!${formatted}!` : formatted}`;
}

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;
	let frameIndex = 0;

	function stopSpinner() {
		if (timer) { clearInterval(timer); timer = null; }
		frameIndex = 0;
	}

	function restoreTitle(ctx: ExtensionContext) {
		ctx.ui.setTitle(`✅${getContextIndicator(ctx)} ${getBaseTitle(pi)}`);
	}

	function showSpinnerFrame(ctx: ExtensionContext) {
		const baseTitle = getBaseTitle(pi);
		ctx.ui.setTitle(`${SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]} ${baseTitle}`);
		frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
	}

	function startSpinner(ctx: ExtensionContext) {
		if (timer) { frameIndex = 0; return; }
		frameIndex = 0;
		showSpinnerFrame(ctx);
		timer = setInterval(() => showSpinnerFrame(ctx), 2000);
		(timer as any).unref?.();
	}

	pi.on("session_start", (_e, ctx) => setImmediate(() => restoreTitle(ctx)));
	pi.on("input", (_e, ctx) => startSpinner(ctx));
	pi.on("agent_start", (_e, ctx) => startSpinner(ctx));
	pi.on("turn_start", (_e, ctx) => startSpinner(ctx));
	pi.on("agent_end", (_e, ctx) => { stopSpinner(); restoreTitle(ctx); });
	pi.on("session_shutdown", (_e, ctx) => { stopSpinner(); ctx.ui.setTitle(getBaseTitle(pi)); });
}
