import { Router } from "express";
import * as controllerMethods from './controller';
import { requireAuth } from "../../middleware/auth";

const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter
.get('/overview',
  controllerMethods.getAnalytics
)
.get(
    '/knowledge',
    controllerMethods.getKnowledgeAnalytics
)

export default analyticsRouter;
