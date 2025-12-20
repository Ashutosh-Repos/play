import { Router } from "express";
import { internalAuth } from "@repo/common";
import { 
    createComment, 
    listComments, 
    listReplies,
    deleteComment,
    pinComment,
    unpinComment,
    heartComment
} from "../controllers/comment.js";

const router = Router();

// Standard CRUD
router.post("/videos/:id/comments", internalAuth(), createComment);
router.get("/videos/:id/comments", internalAuth({ required: false }), listComments);
router.get("/comments/:id/replies", internalAuth({ required: false }), listReplies);
router.delete("/comments/:id", internalAuth(), deleteComment);

// Creator Tools
router.post("/comments/:id/pin", internalAuth(), pinComment);
router.post("/comments/:id/unpin", internalAuth(), unpinComment);
router.post("/comments/:id/heart", internalAuth(), heartComment);

export default router;
