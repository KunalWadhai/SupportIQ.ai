import { Router } from "express";
import * as controllerMethods from './controller';

const analyticsRouter = Router();

analyticsRouter
.get('/overview',
  controllerMethods.getAnalytics
)
.get(
    '/knowledge',
    controllerMethods.getKnowledgeAnalytics
)

export default analyticsRouter;