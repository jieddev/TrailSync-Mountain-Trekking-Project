import { fileURLToPath } from "node:url";
import path from "node:path";

// GCash details shown to hikers when they pay. Payments are in test mode: no
// money moves through TrailSync, and the coordinator checks the uploaded
// screenshot by eye. The defaults are placeholders until the tourism office
// provides its real account.
const PLACEHOLDER_ACCOUNT_NAME = "TrailSync Tourism Office (TEST)";
const PLACEHOLDER_ACCOUNT_NUMBER = "0917 000 0000";

// Served by the web app from frontend/public.
export const GCASH_QR_IMAGE_PATH = "/payments/gcash-qr-sample.png";

const DEFAULT_UPLOAD_DIR = fileURLToPath(new URL("../../uploads", import.meta.url));

export function paymentMethod() {
  return {
    provider: "GCASH" as const,
    accountName: process.env.GCASH_ACCOUNT_NAME?.trim() || PLACEHOLDER_ACCOUNT_NAME,
    accountNumber: process.env.GCASH_ACCOUNT_NUMBER?.trim() || PLACEHOLDER_ACCOUNT_NUMBER,
    qrImagePath: GCASH_QR_IMAGE_PATH,
    testMode: true,
  };
}

// Where receipt screenshots are stored. Relative paths resolve from backend/.
export function uploadDir() {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (!configured) return DEFAULT_UPLOAD_DIR;
  return path.isAbsolute(configured) ? configured : fileURLToPath(new URL(`../../${configured}`, import.meta.url));
}

export function receiptsDir() {
  return path.join(uploadDir(), "receipts");
}
