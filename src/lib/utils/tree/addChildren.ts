import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";

export function addChildren(
	conv: Pick<Conversation, "messages" | "rootMessageId">,
	message: Omit<Message, "id">,
	parentId?: Message["id"]
): Message["id"] {
	// if this is the first message we just push it
	if (conv.messages.length === 0) {
		const messageId = crypto.randomUUID();
		conv.rootMessageId = messageId;
		conv.messages.push({
			...message,
			ancestors: [],
			id: messageId,
		});
		return messageId;
	}

	if (!parentId) {
		throw new Error("You need to specify a parentId if this is not the first message");
	}

	const messageId = crypto.randomUUID();
	if (!conv.rootMessageId) {
		// if there is no parentId we just push the message
		if (!!parentId && parentId !== conv.messages[conv.messages.length - 1].id) {
			throw new Error("This is a legacy conversation, you can only append to the last message");
		}
		conv.messages.push({ ...message, id: messageId });
		return messageId;
	}

	const ancestors = [...(conv.messages.find((m) => m.id === parentId)?.ancestors ?? []), parentId];
	conv.messages.push({
		...message,
		ancestors,
		id: messageId,
	});

	return messageId;
}
