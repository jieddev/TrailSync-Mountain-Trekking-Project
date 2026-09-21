import { randomUUID } from "node:crypto";

import pino, { type Logger } from "pino";
import { pinoHttp } from "pino-http";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";

const level =
  process.env.LOG_LEVEL ?? (isTest ? "silent" : isProduction ? "info" : "debug");

const usePrettyLogs =
  !isProduction && !isTest && process.env.LOG_PRETTY !== "false";

const redact = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers.set-cookie",
    "*.password",
    "*.token",
    "*.accessToken",
    "*.refreshToken",
    "*.idToken",
    "*.authorization",
    "*.cookie",
  ],
  censor: "[redacted]",
};

export const logger = pino({
  level,
  base: {
    service: "trailsync-backend",
    env: nodeEnv,
  },
  redact,
  serializers: {
    err: pino.stdSerializers.err,
  },
  ...(usePrettyLogs
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            singleLine: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (request, response) => {
    const incomingRequestId = request.headers["x-request-id"];
    const requestId =
      typeof incomingRequestId === "string" && incomingRequestId.trim()
        ? incomingRequestId
        : randomUUID();

    response.setHeader("X-Request-Id", requestId);

    return requestId;
  },
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) {
      return "error";
    }

    if (response.statusCode >= 400) {
      return "warn";
    }

    return "info";
  },
  customSuccessMessage: (request, response) =>
    `${request.method} ${request.url} completed with ${response.statusCode}`,
  customErrorMessage: (request, response) =>
    `${request.method} ${request.url} failed with ${response.statusCode}`,
});

export type AppLogger = Logger;
