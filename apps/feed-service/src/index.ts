import express from "express";
const app = express();
const PORT = process.env.PORT || 4007;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "feed-service" }));
app.listen(PORT, () => console.log(`feed-service running on port ${PORT}`));
