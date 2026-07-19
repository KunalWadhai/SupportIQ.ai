import { Router } from "express";
import * as controllerMethods from './controller';
import { upload } from './utils'

const knowledgeRouter = Router();

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