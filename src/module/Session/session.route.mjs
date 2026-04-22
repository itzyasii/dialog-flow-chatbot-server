import { Router } from "express";
import { bootstrapSessionController } from "./session.controller.mjs";

const router = Router();

router.post("/bootstrap", bootstrapSessionController);

export default router;
