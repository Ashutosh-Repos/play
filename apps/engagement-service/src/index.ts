import express from "express";
const app = express();
const PORT = process.env.PORT || 4006;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "engagement-service" }));
app.listen(PORT, () => console.log(`engagement-service running on port ${PORT}`));
