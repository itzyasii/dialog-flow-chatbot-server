import { sendSuccess } from "../../utils/globalResponse.mjs";
import {
  getChatHistoryByClientId,
  appendChatMessage,
} from "./chat.service.mjs";
import {
  getChatHistorySchema,
  sendMessageSchema,
} from "./chat.validation.mjs";

export const getChatHistoryController = async (req, res, next) => {
  try {
    const parsed = getChatHistorySchema.parse({
      clientUserId: req.params.clientUserId,
      limit: req.query.limit,
    });

    const chat = await getChatHistoryByClientId(parsed.clientUserId, {
      limit: parsed.limit,
    });

    return sendSuccess(res, 200, "Chat history fetched successfully", chat);
  } catch (error) {
    next(error);
  }
};

export const createChatMessageController = async (req, res, next) => {
  try {
    const { clientUserId } = req.params;
    const parsedBody = sendMessageSchema.parse(req.body);

    const result = await appendChatMessage({
      clientExternalId: clientUserId,
      senderRole: "client",
      text: parsedBody.text,
      source: "api",
      profile: parsedBody.profile,
      metadata: parsedBody.metadata,
    });

    return sendSuccess(res, 201, "Message stored successfully", result);
  } catch (error) {
    next(error);
  }
};
