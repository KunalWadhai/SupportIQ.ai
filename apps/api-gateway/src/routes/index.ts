import { Router } from "express";
import authRouter from "../modules/auth/router";
import chatRouter from "../modules/chat/router";
import knowledgeRouter from "../modules/knowledge/router";
import widgetRouter from "../modules/widget/router";
import analyticsRouter from "../modules/analytics/router";

const router = Router();

router.use('/auth', authRouter);
router.use('/chat', chatRouter);
router.use('/knowledge', knowledgeRouter)
router.use('/widget', widgetRouter)
router.use('/analytics',analyticsRouter)

export default router;