import express from "express";
const app = express();
const PORT = process.env.PORT || 4004;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "ingest-service" }));
app.listen(PORT, () => console.log(`ingest-service running on port ${PORT}`));
