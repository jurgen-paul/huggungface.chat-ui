import type { BackendModel } from "./server/models";
import { getQueryFromPrompt, searchWeb } from "./server/searchWeb";
import type { Message } from "./types/Message";

/**
 * Convert [{user: "assistant", content: "hi"}, {user: "user", content: "hello"}] to:
 *
 * <|assistant|>hi<|endoftext|><|prompter|>hello<|endoftext|><|assistant|>
 */
export async function buildPrompt(
	messages: Pick<Message, "from" | "content">[],
	model: BackendModel,
	webSearch?: true
): Promise<string> {
	const prompt =
		messages
			.map(
				(m) =>
					(m.from === "user"
						? model.userMessageToken + m.content
						: model.assistantMessageToken + m.content) +
					(model.messageEndToken
						? m.content.endsWith(model.messageEndToken)
							? ""
							: model.messageEndToken
						: "")
			)
			.join("") + model.assistantMessageToken;

	let webPrompt = "";

	if (webSearch) {
		const query = await getQueryFromPrompt(messages);
		console.log(query);
		const results = await searchWeb(query);

		webPrompt = "<|context|>";

		results.organic_results.forEach((element) => {
			webPrompt += `\n- ${element.snippet}`;
		});
		console.log(webPrompt);
	}

	// Not super precise, but it's truncated in the model's backend anyway
	return (
		model.preprompt +
		webPrompt +
		prompt
			.split(" ")
			.slice(-(model.parameters?.truncate ?? 0))
			.join(" ")
	);
}
