import { defaultModel } from "$lib/server/models";
import { modelEndpoint } from "./modelEndpoint";
import { trimSuffix } from "$lib/utils/trimSuffix";
import { trimPrefix } from "$lib/utils/trimPrefix";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken";
import { AwsClient } from "aws4fetch";
import { openAIChatToTextGenerationStream } from "$lib/utils/openAIChatToTextGenerationStream";
import { openAICompletionToTextGenerationStream } from "$lib/utils/openAICompletionToTextGenerationStream";
import OpenAI from "openai";

interface Parameters {
	temperature: number;
	truncate: number;
	max_new_tokens: number;
	stop: string[];
}
export async function generateFromDefaultEndpoint(
	prompt: string,
	parameters?: Partial<Parameters>
) {
	const newParameters = {
		...defaultModel.parameters,
		...parameters,
		return_full_text: false,
	};

	const randomEndpoint = modelEndpoint(defaultModel);

	const abortController = new AbortController();

	let resp: Response;

	if (randomEndpoint.host === "sagemaker") {
		const requestParams = JSON.stringify({
			parameters: newParameters,
			inputs: prompt,
		});

		const aws = new AwsClient({
			accessKeyId: randomEndpoint.accessKey,
			secretAccessKey: randomEndpoint.secretKey,
			sessionToken: randomEndpoint.sessionToken,
			service: "sagemaker",
		});

		resp = await aws.fetch(randomEndpoint.url, {
			method: "POST",
			body: requestParams,
			signal: abortController.signal,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} else if (randomEndpoint.host === "openai-compatible") {
		// TODO: should not use stream:true
		const openai = new OpenAI({
			apiKey: randomEndpoint.apiKey,
			baseURL: randomEndpoint.baseURL,
		});
		const textGenerationStream =
			randomEndpoint.type === "completions"
				? openAICompletionToTextGenerationStream(
						await openai.completions.create(
							{
								model: defaultModel.id ?? defaultModel.name,
								prompt,
								stream: true,
								max_tokens: defaultModel.parameters?.max_new_tokens,
								stop: defaultModel.parameters?.stop,
								temperature: defaultModel.parameters?.temperature,
								top_p: defaultModel.parameters?.top_p,
								frequency_penalty: defaultModel.parameters?.repetition_penalty,
							},
							{ signal: abortController.signal }
						),
						abortController.signal
				  )
				: openAIChatToTextGenerationStream(
						await openai.chat.completions.create(
							{
								model: defaultModel.id ?? defaultModel.name,
								messages: [{ role: "user", content: prompt }],
								stream: true,
								max_tokens: defaultModel.parameters?.max_new_tokens,
								stop: defaultModel.parameters?.stop,
								temperature: defaultModel.parameters?.temperature,
								top_p: defaultModel.parameters?.top_p,
								frequency_penalty: defaultModel.parameters?.repetition_penalty,
							},
							{ signal: abortController.signal }
						),
						abortController.signal
				  );
		const readableStream = new ReadableStream({
			async start(controller) {
				for await (const chuck of textGenerationStream) {
					if (abortController.signal.aborted) {
						break;
					}
					controller.enqueue(chuck);
				}
				controller.close();
			},
			cancel() {
				abortController.abort();
			},
		});

		resp = new Response(readableStream, {
			headers: {
				"Content-Type": "text/event-stream",
			},
			status: 200,
			statusText: "OK",
		});
	} else {
		resp = await fetch(randomEndpoint.url, {
			headers: {
				"Content-Type": "application/json",
				Authorization: randomEndpoint.authorization,
			},
			method: "POST",
			body: JSON.stringify({
				parameters: newParameters,
				inputs: prompt,
			}),
			signal: abortController.signal,
		});
	}

	if (!resp.ok) {
		throw new Error(await resp.text());
	}

	if (!resp.body) {
		throw new Error("Response body is empty");
	}

	const decoder = new TextDecoder();
	const reader = resp.body.getReader();

	let isDone = false;
	let result = "";

	while (!isDone) {
		const { done, value } = await reader.read();

		isDone = done;
		result += decoder.decode(value, { stream: true }); // Convert current chunk to text
	}

	// Close the reader when done
	reader.releaseLock();

	const results = await JSON.parse(result);

	let generated_text = trimSuffix(
		trimPrefix(trimPrefix(results[0].generated_text, "<|startoftext|>"), prompt),
		PUBLIC_SEP_TOKEN
	).trimEnd();

	for (const stop of [...(newParameters?.stop ?? []), "<|endoftext|>"]) {
		if (generated_text.endsWith(stop)) {
			generated_text = generated_text.slice(0, -stop.length).trimEnd();
		}
	}

	return generated_text;
}
