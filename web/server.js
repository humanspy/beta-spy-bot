import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "./auth.js";
import { guildsRouter } from "./routes/guilds.js";
import { casesRouter } from "./routes/cases.js";
import { warningsRouter } from "./routes/warnings.js";
import { staffRouter } from "./routes/staff.js";
import { bansRouter } from "./routes/bans.js";
import { confirmRouter } from "./routes/confirms.js";
import { permissionsRouter } from "./routes/permissions.js";
import { logoutRouter } from "./routes/logout.js";
import { meRouter } from "./routes/me.js";
import { roleRouter } from "./routes/role.js";
import { modmailRouter } from "./routes/modmail.js";


const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

app.use("/auth", authRouter);
app.use("/api/guilds", guildsRouter);
app.use("/api/cases", casesRouter);
app.use("/api/warnings", warningsRouter);
app.use("/api/staff", staffRouter);
app.use("/api/bans", bansRouter);
app.use("/api/confirm", confirmRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api/logout", logoutRouter);
app.use("/api/me", meRouter);
app.use("/api/role", roleRouter);
app.use("/api/modmail", modmailRouter);




app.use(express.static("./web/public"));

app.listen(3000, () => {
  console.log("🌐 Case dashboard running securely on port 3000");
});

