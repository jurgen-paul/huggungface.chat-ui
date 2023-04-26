import { PUBLIC_MAX_INPUT_TOKENS } from "$env/static/public";
import { buildPrompt } from "$lib/buildPrompt";
import { collections } from "$lib/server/database.js";
import { modelEndpoint } from "$lib/server/modelEndpoint.js";
import { textGeneration } from "@huggingface/inference";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export async function POST({ params, locals, fetch }) {
	const convId = new ObjectId(params.id);

	const conversation = await collections.conversations.findOne({
		_id: convId,
		sessionId: locals.sessionId,
	});

	if (!conversation) {
		throw error(404, "Conversation not found");
	}

	const firstMessage = conversation.messages.find((m) => m.from === "user");

	const userPrompt =
		`Please summarize the following message as a single sentence of less than 5 words:\n` +
		firstMessage?.content;

	const prompt = buildPrompt([{ from: "user", content: userPrompt }]);

	const parameters = {
		temperature: 0.9,
		top_p: 0.95,
		repetition_penalty: 1.2,
		top_k: 50,
		watermark: false,
		max_new_tokens: 1024,
		truncate: parseInt(PUBLIC_MAX_INPUT_TOKENS),
		stop: ["<|endoftext|>"],
		return_full_text: false,
	};

	const endpoint = modelEndpoint();
	const { generated_text } = await textGeneration(
		{
			model: endpoint.endpoint,
			inputs: prompt,
			parameters,
		},
		{
			fetch: (url, options) =>
				fetch(url, {
					...options,
					headers: { ...options?.headers, Authorization: endpoint.authorization },
				}),
		}
	);

	if (generated_text) {
		await collections.conversations.updateOne(
			{
				_id: convId,
				sessionId: locals.sessionId,
			},
			{
				$set: { title: generated_text },
			}
		);
	}

	return new Response(
		JSON.stringify(
			generated_text
				? {
						title: generated_text,
				  }
				: {}
		),
		{ headers: { "Content-Type": "application/json" } }
	);
}
