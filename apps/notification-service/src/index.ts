import express from "express";
const app = express();
const PORT = process.env.PORT || 4008;
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification-service" }));
app.listen(PORT, () => console.log(`notification-service running on port ${PORT}`));
