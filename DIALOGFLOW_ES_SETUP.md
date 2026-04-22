# Dialogflow ES Starter Setup

Use these starter intents in Dialogflow ES so they line up with the backend's
`detectIntent` and webhook flow.

## Fulfillment URL

Set fulfillment to:

`https://engraving-unwelcome-emergency.ngrok-free.dev/api/v1/dialogflow/webhook`

## Required Agent Settings

- Language: `en`
- Fulfillment webhook enabled
- Use the same Google Cloud project as `DIALOGFLOW_PROJECT_ID`

## Starter Intents

### 1. Default Welcome Intent

Training phrases:

- `hi`
- `hello`
- `hey`
- `good morning`
- `i need help`

Text response:

- `Hello, welcome to support. I can help with order tracking, refunds, store hours, or connecting you with a human agent.`

Webhook:

- Optional
- Keep webhook off unless you want custom server-side logic for welcome

### 2. Default Fallback Intent

Text response:

- `I'm sorry, I didn't fully understand that. You can ask about order status, refunds, store hours, or request a human agent.`

Webhook:

- Off

### 3. Track Order

Training phrases:

- `track my order`
- `where is my order`
- `order status`
- `check delivery status`
- `i want to track my parcel`

Text response:

- `I can help track your order. Please share your order number.`

Webhook:

- Off for now
- Turn on later if you want to look up real order data in your backend

### 4. Refund Policy

Training phrases:

- `refund policy`
- `how do refunds work`
- `can i get a refund`
- `return and refund policy`
- `refund for late delivery`

Text response:

- `Refunds are available for eligible orders. If you want, I can help you start a refund request.`

Webhook:

- Off for now

### 5. Store Hours

Training phrases:

- `what are your store hours`
- `support hours`
- `when are you open`
- `what time do you close`

Text response:

- `Support is available from 9 AM to 9 PM local time, every day.`

Webhook:

- Off

### 6. Escalate to Human

Training phrases:

- `talk to a human`
- `connect me to support`
- `live agent`
- `i need a real person`
- `customer service representative`

Text response:

- `I can help escalate this to a support specialist. Please briefly describe the issue you need help with.`

Webhook:

- On
- Use this when you want the backend webhook to run custom escalation logic

## How To Use Webhook Properly

- For intents with simple static replies, keep webhook off.
- For intents that need backend logic, database lookups, or custom actions,
  enable `Fulfillment -> Enable webhook call for this intent`.
- The backend now calls Dialogflow `detectIntent` automatically after each user
  message.
- If Dialogflow also calls your webhook for a matched intent, the backend avoids
  creating duplicate bot messages by treating the webhook response as the source
  of truth.

## Backend Environment Variables

Add these to `.env`:

```env
DIALOGFLOW_PROJECT_ID=your-google-cloud-project-id
DIALOGFLOW_LANGUAGE_CODE=en
# optional if you are not already using ADC
DIALOGFLOW_CREDENTIALS_PATH=C:\path\to\service-account.json
```

## Authentication

Dialogflow ES Node samples use Application Default Credentials. If you do not
set `DIALOGFLOW_CREDENTIALS_PATH`, make sure `GOOGLE_APPLICATION_CREDENTIALS`
is configured for the backend process.
