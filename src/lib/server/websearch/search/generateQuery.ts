import type { Message } from "$lib/types/Message";
import { format } from "date-fns";
import type { EndpointMessage } from "../../endpoints/endpoints";
import { generateFromDefaultEndpoint } from "../../generateFromDefaultEndpoint";

export async function generateQuery(messages: Message[], generatedQueries?: string[]) {
	const currentDate = format(new Date(), "MMMM d, yyyy");
	const userMessages = messages.filter(({ from }) => from === "user");
	const previousUserMessages = userMessages.slice(0, -1);

	const lastMessage = userMessages.slice(-1)[0];

	const convQuery: Array<EndpointMessage> = [
		{
			from: "user",
			content: `Previous Questions:
- Who is the president of France?

Current Question: What about Mexico?

Previously generated queries:
- President list of Mexico
`,
		},
		{
			from: "assistant",
			content: "President of Mexico",
		},
		{
			from: "user",
			content: `Previous questions: 
- When is the next formula 1 grand prix?

Current Question: Where is it being hosted?`,
		},
		{
			from: "assistant",
			content: "location of next formula 1 grand prix",
		},
		{
			from: "user",
			content: "Current Question: What type of printhead does the Epson F2270 DTG printer use?",
		},
		{
			from: "assistant",
			content: "Epson F2270 DTG printer printhead",
		},
		{ from: "user", content: "What were the news yesterday?" },
		{
			from: "assistant",
			content: `news ${format(new Date(Date.now() - 864e5), "MMMM d, yyyy")}`,
		},
		{
			from: "user",
			content: `Current Question: My dog has been bitten, what should the gums look like so that he is healthy and when does he need an infusion?

Previously generated queries:
- What healthy gums look like in dogs
- What unhealthy gums look like in dogs
`,
		},
		{ from: "assistant", content: `dog, gums, indications of necessary infusion` },
		{
			from: "user",
			content: `Current Question: Who is Elon Musk ?

Previously generated queries:
- Elon Musk biography
- Who is Elon Musk
`,
		},
		{ from: "assistant", content: `Elon Musk` },
		{
			from: "user",
			content:
				(previousUserMessages.length > 0
					? `Previous questions: \n${previousUserMessages
							.map(({ content }) => `- ${content}`)
							.join("\n")}`
					: "") +
				"\n\nCurrent Question: " +
				lastMessage.content +
				"\n" +
				(generatedQueries && generatedQueries.length > 0
					? `Previously generated queries:\n${generatedQueries.map((q) => `- ${q}`).join("\n")}`
					: ""),
		},
	];

	const preprompt = `You are tasked with generating precise and effective web search queries to answer the user's question. Provide a concise and specific query for Google search that will yield the most relevant and up-to-date results. Include key terms and related phrases, and avoid unnecessary words. Answer with only the query. Avoid duplicates, make the prompts as divers as you can. You are not allowed to repeat queries. Today is ${currentDate}`;

	const webQuery = await generateFromDefaultEndpoint({
		messages: convQuery,
		preprompt,
		generateSettings: {
			max_new_tokens: 30,
		},
	});

	return webQuery.trim();
}
