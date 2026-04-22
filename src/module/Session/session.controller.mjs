import { randomUUID } from "node:crypto";
import { sendSuccess } from "../../utils/globalResponse.mjs";
import { accessToken } from "../../utils/jwt.mjs";
import {
  getChatHistoryByClientId,
  getOrCreateDirectChat,
} from "../Chat/chat.service.mjs";

export const bootstrapSessionController = async (req, res, next) => {
  try {
    const requestedUserId = String(req.body?.userId || "").trim();
    const userId = requestedUserId || randomUUID();
    const profile = {
      displayName: String(req.body?.displayName || "").trim() || "Guest User",
      email: String(req.body?.email || "").trim() || undefined,
      avatarUrl: String(req.body?.avatarUrl || "").trim() || undefined,
    };

    const { chat } = await getOrCreateDirectChat({
      clientExternalId: userId,
      profile,
      sessionId: userId,
    });

    const chatHistory = await getChatHistoryByClientId(userId, { limit: 50 });
    const token = accessToken(userId, "client");

    return sendSuccess(res, 200, "Session bootstrapped successfully", {
      token,
      user: chat.clientUser,
      chat: chatHistory,
    });
  } catch (error) {
    next(error);
  }
};
