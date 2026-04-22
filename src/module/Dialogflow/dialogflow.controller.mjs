import {
  appendChatMessage,
  extractDialogflowIdentity,
  formatDialogflowWebhookReply,
} from "../Chat/chat.service.mjs";
import { webhookSchema } from "../Chat/chat.validation.mjs";
import { emitChatMessageToUser } from "../../middleware/socketMiddleware/chatHandler.mjs";

export const dialogflowWebhookController = async (req, res, next) => {
  try {
    const payload = webhookSchema.parse(req.body);
    const identity = extractDialogflowIdentity(payload);
    const reply = formatDialogflowWebhookReply(payload);

    const result = await appendChatMessage({
      clientExternalId: identity.clientExternalId,
      senderRole: "server",
      text: reply.text,
      source: "webhook",
      sessionId: identity.sessionId,
      dialogflow: {
        intent: reply.intent,
        action: reply.action,
        confidence: reply.confidence,
        responseId: reply.responseId,
        session: identity.session,
      },
      metadata: {
        parameters: reply.parameters,
      },
    });

    emitChatMessageToUser(req.app.get("io"), result.clientExternalId, {
      chatId: result.chat.id,
      sessionId: result.sessionId,
      message: result.message,
    });

    return res.status(200).json({
      fulfillmentText: reply.text,
      fulfillmentMessages: [
        {
          text: {
            text: [reply.text],
          },
        },
      ],
      payload: {
        chatId: result.chat.id,
        message: result.message,
      },
    });
  } catch (error) {
    next(error);
  }
};
