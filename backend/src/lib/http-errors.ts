import type { Request, Response } from "express";

export type ErrorDetail = { field: string; code: string; message: string };

export function fail(response: Response, status: number, code: string, message: string, details?: ErrorDetail[]) {
  const request = response.req as Request & { id?: string };
  return response.status(status).json({
    error: { code, message, ...(details?.length ? { details } : {}) },
    requestId: request.id,
  });
}
