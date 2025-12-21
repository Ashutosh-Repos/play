import { Router } from "express";
import { internalAuth } from "@repo/common";
import { requireActiveUser } from "../middleware/active.js";
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
router.post("/videos/:id/comments", internalAuth(), requireActiveUser(), createComment);
router.get("/videos/:id/comments", internalAuth({ required: false }), listComments);
router.get("/comments/:id/replies", internalAuth({ required: false }), listReplies);
router.delete("/comments/:id", internalAuth(), requireActiveUser(), deleteComment);

// Creator Tools
router.post("/comments/:id/pin", internalAuth(), requireActiveUser(), pinComment);
router.post("/comments/:id/unpin", internalAuth(), requireActiveUser(), unpinComment);
router.post("/comments/:id/heart", internalAuth(), requireActiveUser(), heartComment);

export default router;
