import express from "express";
const app = express();
const PORT = process.env.PORT || 4005;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "transcoder-service" }));
app.listen(PORT, () => console.log(`transcoder-service running on port ${PORT}`));
