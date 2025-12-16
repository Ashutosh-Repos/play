import express from "express";
const app = express();
const PORT = process.env.PORT || 4003;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "video-service" }));
app.listen(PORT, () => console.log(`video-service running on port ${PORT}`));
