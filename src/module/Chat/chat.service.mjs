import Chat from "./ChatSchema.mjs";
import User from "../User/UserSchema.mjs";
import errorResponse from "../../utils/errorResponse.mjs";
import env from "../../config/env.mjs";

const SERVER_USER_EXTERNAL_ID =
  env.SERVER_USER_EXTERNAL_ID || "00000000-0000-4000-8000-000000000001";

const sanitizeText = (value) => String(value ?? "").trim();

const formatMessage = (message) => ({
  id: String(message._id),
  senderRole: message.senderRole,
  text: message.text,
  source: message.source,
  dialogflow: message.dialogflow || {},
  metadata: message.metadata || {},
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const formatUser = (user) => ({
  id: String(user._id),
  externalId: user.externalId,
  role: user.role,
  displayName: user.displayName || null,
  email: user.email || null,
  avatarUrl: user.avatarUrl || null,
  lastSeenAt: user.lastSeenAt,
});

const formatChat = (chat) => ({
  id: String(chat._id),
  sessionId: chat.sessionId,
  status: chat.status,
  lastMessageAt: chat.lastMessageAt,
  clientUser: chat.clientUser
    ? formatUser(chat.clientUser)
    : String(chat.clientUser ?? ""),
  serverUser: chat.serverUser
    ? formatUser(chat.serverUser)
    : String(chat.serverUser ?? ""),
  messages: Array.isArray(chat.messages) ? chat.messages.map(formatMessage) : [],
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export const ensureServerUser = async () =>
  User.findOneAndUpdate(
    { externalId: SERVER_USER_EXTERNAL_ID },
    {
      $set: {
        role: "server",
        displayName: "Dialogflow Server",
        lastSeenAt: new Date(),
      },
      $setOnInsert: {
        metadata: {
          system: true,
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

export const ensureClientUser = async (clientExternalId, profile = {}) => {
  const externalId = sanitizeText(clientExternalId);

  if (!externalId) {
    throw new errorResponse("client user id is required", 400);
  }

  return User.findOneAndUpdate(
    { externalId },
    {
      $set: {
        role: "client",
        lastSeenAt: new Date(),
        ...(profile.displayName ? { displayName: profile.displayName } : {}),
        ...(profile.email ? { email: profile.email } : {}),
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
};

export const getOrCreateDirectChat = async ({
  clientExternalId,
  profile = {},
  sessionId,
}) => {
  const [clientUser, serverUser] = await Promise.all([
    ensureClientUser(clientExternalId, profile),
    ensureServerUser(),
  ]);

  const resolvedSessionId = sanitizeText(sessionId) || clientUser.externalId;

  const chat = await Chat.findOneAndUpdate(
    {
      clientUser: clientUser._id,
      serverUser: serverUser._id,
    },
    {
      $set: {
        clientUser: clientUser._id,
        serverUser: serverUser._id,
        sessionId: resolvedSessionId,
        status: "open",
      },
      $setOnInsert: {
        lastMessageAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("clientUser")
    .populate("serverUser");

  return { chat, clientUser, serverUser };
};

export const appendChatMessage = async ({
  clientExternalId,
  senderRole,
  text,
  source = "socket",
  profile = {},
  sessionId,
  dialogflow = {},
  metadata = {},
}) => {
  const messageText = sanitizeText(text);

  if (!messageText) {
    throw new errorResponse("message text is required", 400);
  }

  const { chat, clientUser, serverUser } = await getOrCreateDirectChat({
    clientExternalId,
    profile,
    sessionId,
  });

  const senderUser =
    senderRole === "client" ? clientUser._id : senderRole === "server"
      ? serverUser._id
      : null;

  chat.messages.push({
    senderRole,
    senderUser,
    text: messageText,
    source,
    dialogflow,
    metadata,
  });
  chat.lastMessageAt = new Date();

  await chat.save();
  await chat.populate("clientUser");
  await chat.populate("serverUser");

  const message = chat.messages[chat.messages.length - 1];

  return {
    chat: formatChat(chat),
    message: formatMessage(message),
    clientExternalId: clientUser.externalId,
    sessionId: chat.sessionId,
  };
};

export const getChatHistoryByClientId = async (
  clientExternalId,
  { limit = 50 } = {},
) => {
  const clientId = sanitizeText(clientExternalId);

  if (!clientId) {
    throw new errorResponse("client user id is required", 400);
  }

  const clientUser = await User.findOne({ externalId: clientId });
  if (!clientUser) {
    throw new errorResponse("chat not found for this user", 404);
  }

  const chat = await Chat.findOne({ clientUser: clientUser._id })
    .populate("clientUser")
    .populate("serverUser");

  if (!chat) {
    throw new errorResponse("chat not found for this user", 404);
  }

  const formatted = formatChat(chat);

  return {
    ...formatted,
    messages: formatted.messages.slice(-limit),
  };
};

const firstString = (...values) => {
  for (const value of values) {
    const clean = sanitizeText(value);
    if (clean) return clean;
  }
  return "";
};

export const extractDialogflowIdentity = (payload = {}) => {
  const session = sanitizeText(payload.session);
  const sessionId = session.split("/").filter(Boolean).pop() || "";
  const sourcePayload = payload.originalDetectIntentRequest?.payload || {};
  const userId = firstString(
    sourcePayload.userId,
    sourcePayload.user_id,
    sourcePayload.clientUserId,
    sourcePayload.client_user_id,
    sessionId,
  );

  return {
    session,
    sessionId: firstString(sourcePayload.sessionId, sessionId, userId),
    clientExternalId: userId,
  };
};

export const formatDialogflowWebhookReply = (payload = {}) => {
  const queryResult = payload.queryResult || {};
  const fulfillmentText = sanitizeText(queryResult.fulfillmentText);
  const intentName = sanitizeText(queryResult.intent?.displayName);
  const text = fulfillmentText || `Intent matched: ${intentName || "Default"}`;

  return {
    text,
    intent: intentName || null,
    action: sanitizeText(queryResult.action) || null,
    confidence:
      typeof queryResult.intentDetectionConfidence === "number"
        ? queryResult.intentDetectionConfidence
        : null,
    responseId: sanitizeText(payload.responseId) || null,
    parameters: queryResult.parameters || {},
  };
};
