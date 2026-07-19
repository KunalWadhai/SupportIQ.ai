import { Router } from "express";
import * as Contract from './contract'
import * as controllerMethods from './controller'
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";

const chatRouter = Router();

chatRouter
.post(
    "/widget",
    validate(Contract.ChatSchema), 
    controllerMethods.widgetChat
)
.post(
    "/test",
    controllerMethods.testChat
)
.get(
    '/conversations',
    controllerMethods.getConversations
)
.get(
    "/conversations/:sessionId",
    controllerMethods.conversationBySessionId
)
.patch(
    '/conversations/:id/resolve',
    controllerMethods.resolveConversation
);

export default chatRouter;