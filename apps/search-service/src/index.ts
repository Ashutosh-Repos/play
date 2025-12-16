import express from "express";
const app = express();
const PORT = process.env.PORT || 4009;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "search-service" }));
app.listen(PORT, () => console.log(`search-service running on port ${PORT}`));
