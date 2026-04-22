import "dotenv/config";

export default {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  REFRESH_TTL_DAYS: process.env.REFRESH_TTL_DAYS || 7,
  CLIENT_URL: process.env.CLIENT_URL,
  SERVER_USER_EXTERNAL_ID:
    process.env.SERVER_USER_EXTERNAL_ID ||
    "00000000-0000-4000-8000-000000000001",
  DIALOGFLOW_PROJECT_ID: process.env.DIALOGFLOW_PROJECT_ID,
  DIALOGFLOW_LANGUAGE_CODE: process.env.DIALOGFLOW_LANGUAGE_CODE || "en",
  DIALOGFLOW_CREDENTIALS_PATH: process.env.DIALOGFLOW_CREDENTIALS_PATH,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  COMMIT_SHA: process.env.COMMIT_SHA || "unknown",
  SLOW_QUERY_MS: process.env.SLOW_QUERY_MS,
};
