import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { uploadFile, deleteFile } from "../../services/storage.service";
import { enqueueIngestion } from "../../services/queue.service";
import { deleteDocumentVectors } from "../../services/ai.service";
import { Request, Response } from "express";
import { UrlSchema } from "./contract";


export async function listDocuments(req: any, res: Response) {
     try {
        const docs = await prisma.knowledgeDocument.findMany({
          where: { orgId: req.orgId! },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, type: true, status: true,
            fileSize: true, chunkCount: true, errorMessage: true, createdAt: true,
          },
        });
    
        return res.json({ success: true, data: docs });
      } catch {
        return res.status(500).json({ success: false, error: "Failed to fetch documents" });
    }
}

export async function uploadDocument(req: any, res: Response) {
    try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: "No file provided" });
        }
    
        const { originalname, buffer, mimetype, size } = req.file;
    
        const mimeToType: Record<string, string> = {
          "application/pdf": "PDF",
          "text/plain": "TXT",
          "text/markdown": "MARKDOWN",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        };
    
        const docType = mimeToType[mimetype] || "TXT";
    
        const { storageKey } = await uploadFile({
          orgId: req.orgId!,
          fileName: originalname,
          buffer,
          mimeType: mimetype,
        });
    
        const doc = await prisma.knowledgeDocument.create({
          data: {
            orgId: req.orgId!,
            name: originalname,
            type: docType as any,
            status: "PENDING",
            storageKey,
            fileSize: size,
          },
        });
    
        await enqueueIngestion({
          orgId: req.orgId!,
          documentId: doc.id,
          storageKey,
          documentType: docType,
          documentName: originalname,
        });
    
        return res.status(201).json({ success: true, data: doc });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: "Upload failed" });
      }
}

export async function ingestUrl(req: any, res: Response) {
    try {
        const { url, name } = UrlSchema.parse(req.body);
    
        const doc = await prisma.knowledgeDocument.create({
          data: {
            orgId: req.orgId!,
            name: name || url,
            type: "URL",
            status: "PENDING",
            sourceUrl: url,
          },
        });
    
        await enqueueIngestion({
          orgId: req.orgId!,
          documentId: doc.id,
          storageKey: url, // reuse field for URL ingestion path
          documentType: "URL",
          documentName: name || url,
        });
    
        return res.status(201).json({ success: true, data: doc });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ success: false, error: err.errors[0].message });
        }
        return res.status(500).json({ success: false, error: "Failed to add URL" });
      }
}

export async function deleteDocument(req: any, res: Response) {
     try {
       const doc = await prisma.knowledgeDocument.findFirst({
         where: { id: req.params.id, orgId: req.orgId! },
       });
   
       if (!doc) return res.status(404).json({ success: false, error: "Document not found" });
   
       await deleteDocumentVectors({ orgId: req.orgId!, documentId: doc.id }).catch(console.error);
   
       // Delete file from MinIO (if applicable)
       if (doc.storageKey && doc.type !== "URL") {
         await deleteFile(doc.storageKey).catch(console.error);
       }
   
       await prisma.knowledgeDocument.delete({ where: { id: doc.id } });
   
       return res.json({ success: true, data: { id: doc.id } });
     } catch {
       return res.status(500).json({ success: false, error: "Delete failed" });
     }
}

export async function getDocumentStatus(req: any, res: Response) {
    try {
        const doc = await prisma.knowledgeDocument.findFirst({
          where: { id: req.params.id, orgId: req.orgId! },
          select: { id: true, status: true, chunkCount: true, errorMessage: true },
        });
    
        if (!doc) return res.status(404).json({ success: false, error: "Not found" });
    
        return res.json({ success: true, data: doc });
      } catch {
        return res.status(500).json({ success: false, error: "Status check failed" });
    }
}
