import { Router } from "express";

import { liveTreks } from "../lib/guide-locations.js";
import { fail } from "../lib/http-errors.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

export const coordinatorLiveTreksRouter = Router();
coordinatorLiveTreksRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

// Started treks with each guide's latest fix and the path walked so far
// (API_CONTRACT_V1.md §11). The live map polls this.
coordinatorLiveTreksRouter.get("/", async (request, response) => {
  try {
    return response.status(200).json({ items: await liveTreks() });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator live trek list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the live treks.");
  }
});
