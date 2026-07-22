import { Router } from "express";
import * as controllerMethods from './controller';
import { upload } from './utils'
import { requireAuth } from "../../middleware/auth";

const knowledgeRouter = Router();

knowledgeRouter.use(requireAuth);

knowledgeRouter
.get(
    '/',
    controllerMethods.listDocuments
)
.post(
    '/upload',
    upload.single("file"),
    controllerMethods.uploadDocument
)
.post(
    '/url',
    controllerMethods.ingestUrl
)
.delete(
    "/:id",
    controllerMethods.deleteDocument
)
.get(
    '/:id/status',
    controllerMethods.getDocumentStatus
)

export default knowledgeRouter;
