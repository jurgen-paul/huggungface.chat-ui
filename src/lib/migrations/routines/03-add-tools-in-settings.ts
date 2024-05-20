import type { Migration } from ".";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

const addToolsToSettings: Migration = {
	_id: new ObjectId("5c9c4c4c4c4c4c4c4c4c4c4c"),
	name: "Add empty 'tools' record in settings",
	up: async () => {
		const { settings } = collections;

		// Find all assistants whose modelId is not in modelIds, and update it to use defaultModelId
		await settings.updateMany(
			{
				tools: { $exists: false },
			},
			{ $set: { tools: {} } }
		);

		return true;
	},
	runEveryTime: false,
};

export default addToolsToSettings;
