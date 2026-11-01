import { randomUUID } from "node:crypto";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { fail, type ErrorDetail } from "./http-errors.js";
import { receiptsDir } from "./payment-config.js";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const REFERENCE_NUMBER = /^\d{13}$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 5, fieldSize: 64 * 1024 },
}).single("receipt");

function receiptError(response: Response, code: string, message: string) {
  return fail(response, 422, "VALIDATION_ERROR", "Review the payment receipt and try again.", [{ field: "receipt", code, message }]);
}

// Parses a multipart body with one optional "receipt" image. JSON requests pass
// through untouched, so routes can report a missing receipt themselves.
export function receiptUpload(request: Request, response: Response, next: NextFunction) {
  upload(request, response, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") return receiptError(response, "RECEIPT_TOO_LARGE", "The screenshot must be 5 MB or smaller.");
      if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") return receiptError(response, "UNEXPECTED_FILE", "Attach one screenshot in the receipt field.");
      return fail(response, 422, "VALIDATION_ERROR", "The upload could not be read.", [{ field: "receipt", code: error.code, message: "The upload could not be read." }]);
    }
    return next(error);
  });
}

type ImageType = { mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

// The type comes from the file's first bytes, not its name or the browser's claim.
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg" };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png", extension: "png" };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  return null;
}

export type ReceiptSubmission = { buffer: Buffer; mimeType: string; extension: string; sizeBytes: number; referenceNumber: string | null };

// Checks the uploaded screenshot and the optional GCash reference number.
export function parseReceiptSubmission(file: Express.Multer.File | undefined, referenceNumber: unknown): { details: ErrorDetail[] } | { receipt: ReceiptSubmission } {
  const details: ErrorDetail[] = [];
  const type = file ? detectImageType(file.buffer) : null;
  if (!file || file.size === 0) details.push({ field: "receipt", code: "RECEIPT_REQUIRED", message: "Upload a screenshot of your GCash receipt." });
  else if (!type) details.push({ field: "receipt", code: "UNSUPPORTED_FILE_TYPE", message: "Upload a JPG, PNG or WebP image." });
  const reference = typeof referenceNumber === "string" ? referenceNumber.replace(/\s+/g, "") : "";
  if (referenceNumber !== undefined && referenceNumber !== null && typeof referenceNumber !== "string") {
    details.push({ field: "referenceNumber", code: "INVALID_REFERENCE_NUMBER", message: "The GCash reference number has 13 digits." });
  } else if (reference && !REFERENCE_NUMBER.test(reference)) {
    details.push({ field: "referenceNumber", code: "INVALID_REFERENCE_NUMBER", message: "The GCash reference number has 13 digits." });
  }
  if (details.length || !file || !type) return { details };
  return { receipt: { buffer: file.buffer, mimeType: type.mimeType, extension: type.extension, sizeBytes: file.size, referenceNumber: reference || null } };
}

export async function saveReceiptFile(receipt: ReceiptSubmission) {
  const directory = receiptsDir();
  await mkdir(directory, { recursive: true });
  const storedFileName = `${randomUUID()}.${receipt.extension}`;
  await writeFile(path.join(directory, storedFileName), receipt.buffer, { flag: "wx" });
  return storedFileName;
}

export async function deleteReceiptFile(storedFileName: string) {
  await unlink(receiptFilePath(storedFileName)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function deleteAllReceiptFiles() {
  await rm(receiptsDir(), { recursive: true, force: true });
}

export function receiptFilePath(storedFileName: string) {
  return path.join(receiptsDir(), path.basename(storedFileName));
}

// Streams a stored screenshot. It is never cached and never sniffed as another type.
export function sendReceiptFile(response: Response, receipt: { storedFileName: string; mimeType: string }) {
  response.setHeader("Content-Type", receipt.mimeType);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Disposition", "inline");
  return response.sendFile(receiptFilePath(receipt.storedFileName), (error) => {
    if (!error || response.headersSent) return;
    response.removeHeader("Content-Type");
    response.removeHeader("Content-Disposition");
    fail(response, 404, "RECEIPT_FILE_MISSING", "The receipt image was not found.");
  });
}
