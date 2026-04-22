import { Router } from "express";
import {
  createChatMessageController,
  getChatHistoryController,
} from "./chat.controller.mjs";

const router = Router();

router.get("/:clientUserId", getChatHistoryController);
router.post("/:clientUserId/messages", createChatMessageController);

export default router;
