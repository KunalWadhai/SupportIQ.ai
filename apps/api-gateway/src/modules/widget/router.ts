import { Router } from "express";
import * as controllerMethods from './controller';
import { requireAuth } from "../../middleware/auth";
import * as Contract from './contract';
import { validate } from "../../middleware/validate";

const widgetRouter = Router();

widgetRouter
.get(
    '/:orgId/config',
    controllerMethods.widgetConfigByOrdId
)
.patch(
    '/settings',
    requireAuth,
    validate(Contract.WidgetSettingsSchema),
    controllerMethods.updateWidgetSettings
)
.post(
    '/regenerate-key',
    requireAuth,
    controllerMethods.regenerateWidgetKey
)
export default widgetRouter;