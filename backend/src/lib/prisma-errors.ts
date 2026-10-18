import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    (error instanceof PrismaClientKnownRequestError ||
      (typeof error === "object" && error !== null && "code" in error)) &&
    (error as { code?: string }).code === "P2002"
  );
}
