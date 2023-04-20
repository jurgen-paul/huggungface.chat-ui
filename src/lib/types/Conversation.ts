import type { ObjectId } from 'mongodb';
import type { Message } from './Message';

export interface Conversation {
	_id: ObjectId;

	// Can be undefined for shared convo then deleted
	sessionId?: string;

	title: string;
	messages: Message[];

	shares?: Array<{ id: string; msgCount: number }>;

	createdAt: Date;
	updatedAt: Date;
}
