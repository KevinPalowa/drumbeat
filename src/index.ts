import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import authRoutes from "./routes/auth";
import patternRoutes from "./routes/patterns";
import { initDb } from "./lib/db";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

initDb();

app.use("/auth", authRoutes);
app.use("/patterns", patternRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
