import dialogflow from "@google-cloud/dialogflow";
import env from "../../config/env.mjs";
import errorResponse from "../../utils/errorResponse.mjs";
import { logger } from "../../utils/logger.mjs";
import { getCtx } from "../../utils/context.mjs";

let sessionClientInstance = null;

const sanitizeText = (value) => String(value ?? "").trim();

const toStructValue = (value) => {
  if (value === null || value === undefined) {
    return { nullValue: "NULL_VALUE" };
  }

  if (Array.isArray(value)) {
    return {
      listValue: {
        values: value.map(toStructValue),
      },
    };
  }

  if (typeof value === "object") {
    return {
      structValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entryValue]) => [
            key,
            toStructValue(entryValue),
          ]),
        ),
      },
    };
  }

  if (typeof value === "number") {
    return { numberValue: value };
  }

  if (typeof value === "boolean") {
    return { boolValue: value };
  }

  return { stringValue: String(value) };
};

const toStruct = (value) => ({
  fields: Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, toStructValue(entryValue)]),
  ),
});

const getSessionClient = () => {
  if (sessionClientInstance) {
    return sessionClientInstance;
  }

  const clientOptions = env.DIALOGFLOW_CREDENTIALS_PATH
    ? {
        keyFilename: env.DIALOGFLOW_CREDENTIALS_PATH,
      }
    : undefined;

  sessionClientInstance = new dialogflow.SessionsClient(clientOptions);
  return sessionClientInstance;
};

export const isDialogflowConfigured = () => Boolean(env.DIALOGFLOW_PROJECT_ID);

export const detectDialogflowIntent = async ({
  clientUserId,
  sessionId,
  text,
  profile = {},
}) => {
  if (!isDialogflowConfigured()) {
    throw new errorResponse(
      "Dialogflow is not configured. Set DIALOGFLOW_PROJECT_ID and Google credentials before using detectIntent.",
      500,
    );
  }

  const queryText = sanitizeText(text);
  if (!queryText) {
    throw new errorResponse("Dialogflow query text is required", 400);
  }

  const sessionClient = getSessionClient();
  const resolvedSessionId = sanitizeText(sessionId) || sanitizeText(clientUserId);
  const sessionPath = sessionClient.projectAgentSessionPath(
    env.DIALOGFLOW_PROJECT_ID,
    resolvedSessionId,
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: queryText,
        languageCode: env.DIALOGFLOW_LANGUAGE_CODE,
      },
    },
    queryParams: {
      payload: toStruct({
        userId: clientUserId,
        sessionId: resolvedSessionId,
        profile,
      }),
    },
  };

  try {
    const [response] = await sessionClient.detectIntent(request);
    const queryResult = response.queryResult || {};
    const webhookSource = sanitizeText(queryResult.webhookSource);
    const fulfillmentText = sanitizeText(queryResult.fulfillmentText);
    const intentName = sanitizeText(queryResult.intent?.displayName);

    return {
      responseId: sanitizeText(response.responseId) || null,
      fulfillmentText,
      intent: intentName || null,
      action: sanitizeText(queryResult.action) || null,
      confidence:
        typeof queryResult.intentDetectionConfidence === "number"
          ? queryResult.intentDetectionConfidence
          : null,
      parameters: queryResult.parameters || {},
      webhookSource: webhookSource || null,
      webhookStatus: response.webhookStatus || null,
      fallbackText: fulfillmentText || `Intent matched: ${intentName || "Default"}`,
    };
  } catch (error) {
    logger.error({
      event: "dialogflow_detect_intent_failed",
      message: error.message,
      stack: error.stack,
      clientUserId,
      sessionId: resolvedSessionId,
      ...getCtx(),
    });

    throw new errorResponse(
      "Dialogflow detectIntent request failed",
      502,
      {
        reason: error.message,
      },
    );
  }
};
