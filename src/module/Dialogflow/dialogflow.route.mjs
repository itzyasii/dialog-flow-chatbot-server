import { Router } from "express";
import { dialogflowWebhookController } from "./dialogflow.controller.mjs";

const router = Router();

router.post("/webhook", dialogflowWebhookController);

export default router;
