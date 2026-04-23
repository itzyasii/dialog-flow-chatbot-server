# Dialogflow Chatbot Server

This project is a Node.js/Express backend for a chat application that stores conversations in MongoDB, exposes REST endpoints for bootstrapping and chat history, supports real-time messaging with Socket.IO, and can forward user messages to Dialogflow ES for automated replies.

## Features

- Express API for session bootstrap and chat operations
- MongoDB persistence with Mongoose
- Socket.IO support for real-time chat updates
- Dialogflow ES integration for `detectIntent` and webhook-based replies
- JWT-based socket authentication

## Project Structure

```text
.
|-- server.mjs
|-- src/
|   |-- app.mjs
|   |-- config/
|   |-- middleware/
|   |-- module/
|   |   |-- Chat/
|   |   |-- Dialogflow/
|   |   `-- Session/
|   `-- utils/
`-- DIALOGFLOW_ES_SETUP.md
```

## Requirements

- Node.js 18+
- npm
- MongoDB running locally or remotely
- A Dialogflow ES agent and Google service account credentials if you want bot replies enabled

## Environment Setup

Create a `.env` file in the project root. The repository already includes one for local development, but you should update the secrets and paths for your machine.

Example:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/chatbot
JWT_SECRET=replace_this_with_a_secure_secret
REFRESH_TOKEN_SECRET=replace_this_with_a_secure_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TTL_DAYS=7
CLIENT_URL=http://localhost:5173
SERVER_USER_EXTERNAL_ID=00000000-0000-4000-8000-000000000001
LOG_LEVEL=info
COMMIT_SHA=local

DIALOGFLOW_PROJECT_ID=your-google-cloud-project-id
DIALOGFLOW_LANGUAGE_CODE=en-US
DIALOGFLOW_CREDENTIALS_PATH=C:\path\to\service-account.json
```

Notes:

- `MONGO_URI` must point to a working MongoDB instance.
- `JWT_SECRET` is required for socket authentication.
- `CLIENT_URL` should match the frontend app URL.
- Dialogflow is optional for the server to start, but required for automated intent detection.

## Install Dependencies

```bash
npm install
```

## Run the Server

Development mode with auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

When the server starts successfully, it listens on:

```text
http://localhost:5000
```

Health check:

```text
GET /api/v1/health
```

## Run the Frontend

This repository contains the backend only. The frontend should be started from its own project directory.

The backend is already configured for a local frontend at:

```text
http://localhost:5173
```

Typical frontend startup flow:

```bash
npm install
npm run dev
```

Frontend integration expectations:

- Point the frontend API base URL to `http://localhost:5000/api/v1`
- Connect Socket.IO to `http://localhost:5000`
- Use the JWT token returned by `POST /api/v1/session/bootstrap` when opening the socket connection
- If your frontend runs on a different port or host, update `CLIENT_URL` and the backend CORS/security configuration accordingly

## API Overview

### Bootstrap a chat session

```http
POST /api/v1/session/bootstrap
Content-Type: application/json
```

Example body:

```json
{
  "displayName": "Guest User",
  "email": "guest@example.com"
}
```

This returns:

- a generated or reused user id
- a JWT token for socket authentication
- existing chat history for that user

### Get chat history

```http
GET /api/v1/chats/:clientUserId
```

### Send a message over REST

```http
POST /api/v1/chats/:clientUserId/messages
Content-Type: application/json
```

Example body:

```json
{
  "text": "Hello, I need help with my order."
}
```

### Dialogflow webhook

```http
POST /api/v1/dialogflow/webhook
```

For Dialogflow ES setup details, see [DIALOGFLOW_ES_SETUP.md](./DIALOGFLOW_ES_SETUP.md).

## Socket.IO Events

The server uses these socket events for chat:

- `chat:join`
- `chat:joined`
- `chat:message:send`
- `chat:message:created`
- `socket:error`

The client must send the JWT in the Socket.IO handshake, for example in `auth.token`.

## Dialogflow ES Setup

To enable chatbot replies:

1. Create or configure a Dialogflow ES agent.
2. Add the required Dialogflow environment variables.
3. Make sure Google credentials are available through `DIALOGFLOW_CREDENTIALS_PATH` or `GOOGLE_APPLICATION_CREDENTIALS`.
4. Configure the fulfillment webhook and starter intents described in [DIALOGFLOW_ES_SETUP.md](./DIALOGFLOW_ES_SETUP.md).

## Local Development Checklist

1. Start MongoDB.
2. Confirm `.env` values are correct.
3. Run `npm install`.
4. Start the backend with `npm run dev`.
5. Start the frontend from its own project on `http://localhost:5173`.
6. Bootstrap a session from the frontend or by calling `POST /api/v1/session/bootstrap`.

## Troubleshooting

- If the server fails on startup, verify `MONGO_URI`, `JWT_SECRET`, and the Dialogflow credentials path.
- If the frontend cannot connect, make sure it is using the same backend URL and allowed origin.
- If Socket.IO authentication fails, confirm the frontend is sending the token returned by the bootstrap endpoint.
- If Dialogflow responses do not appear, verify the project id, credentials, and webhook settings.
