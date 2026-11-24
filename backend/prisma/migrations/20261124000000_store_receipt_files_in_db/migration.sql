-- CreateTable
CREATE TABLE "payment_receipt_files" (
    "receiptId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "payment_receipt_files_pkey" PRIMARY KEY ("receiptId")
);

-- AddForeignKey
ALTER TABLE "payment_receipt_files" ADD CONSTRAINT "payment_receipt_files_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "payment_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
