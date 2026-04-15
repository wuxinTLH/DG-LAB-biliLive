require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { createDGLabWSServer } = require("./dglab/wsServer");
const { createApiRouter } = require("./api");
const logger = require("./utils/logger");

const API_PORT = parseInt(process.env.APP_API_PORT || "9998");
const WS_PORT = parseInt(process.env.DGLAB_WS_PORT || "9999");

// ── HTTP API 服务（供 Electron 渲染进程调用）──
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", createApiRouter());

const httpServer = http.createServer(app);
httpServer.listen(API_PORT, () => {
  logger.info(`[API] HTTP 服务启动 → http://localhost:${API_PORT}`);
});

// ── DG-LAB WebSocket 服务 ──
createDGLabWSServer(WS_PORT);
logger.info(`[DGLAB] WebSocket 服务启动 → ws://localhost:${WS_PORT}`);
