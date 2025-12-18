import { Router } from "express";
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
router.post("/videos/:id/comments", createComment);
router.get("/videos/:id/comments", listComments);
router.get("/comments/:id/replies", listReplies);
router.delete("/comments/:id", deleteComment);

// Creator Tools
router.post("/comments/:id/pin", pinComment);
router.post("/comments/:id/unpin", unpinComment);
router.post("/comments/:id/heart", heartComment);

export default router;
