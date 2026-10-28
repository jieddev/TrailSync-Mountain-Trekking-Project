import { Router, type Response } from "express";
import type { IncidentStatus } from "@prisma/client";

import { fail } from "../lib/http-errors.js";
import { changeIncident, incidentResponse, incidentSelect, MAX_NOTE_LENGTH, transitions } from "../lib/incidents.js";
import { prisma } from "../lib/prisma.js";
import { asObject, nonblank } from "../lib/validation.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole, type RoleRequest } from "../middleware/require-role.js";

const STATUSES: IncidentStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];
const LIST_LIMIT = 100;

// Incident refusals (API_CONTRACT_V1.md §10), keyed by error code.
const refusals = {
  INCIDENT_NOT_FOUND: [404, "Incident was not found."],
  INCIDENT_ALREADY_ACKNOWLEDGED: [409, "This incident has already been acknowledged."],
  INCIDENT_ALREADY_RESOLVED: [409, "This incident has already been resolved."],
} as const;

function refuse(response: Response, code: keyof typeof refusals) {
  const [status, message] = refusals[code];
  return fail(response, status, code, message);
}

export const coordinatorIncidentsRouter = Router();
coordinatorIncidentsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

// Unresolved incidents first (OPEN, then ACKNOWLEDGED), newest first within each.
coordinatorIncidentsRouter.get("/", async (request, response) => {
  const { status } = request.query;
  if (status !== undefined && !STATUSES.includes(status as IncidentStatus)) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the filter and try again.", [
      { field: "status", code: "INVALID_STATUS", message: "Use OPEN, ACKNOWLEDGED or RESOLVED." },
    ]);
  }
  try {
    const incidents = await prisma.incident.findMany({
      where: status ? { status: status as IncidentStatus } : {},
      select: incidentSelect,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: LIST_LIMIT,
    });
    return response.status(200).json({ items: incidents.map(incidentResponse) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator incident list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve incidents.");
  }
});

coordinatorIncidentsRouter.post("/:incidentId/acknowledge", async (request, response) => {
  try {
    const result = await changeIncident(request.params.incidentId, transitions.acknowledge, (request as RoleRequest).profile!.id);
    if ("refusal" in result) return refuse(response, result.refusal);
    request.log?.info({ requestId: request.id, incidentId: result.incident.id }, "Incident acknowledged");
    return response.status(200).json(incidentResponse(result.incident));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Incident acknowledge failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not acknowledge the incident.");
  }
});

// Resolving records what happened, so a note is required.
coordinatorIncidentsRouter.post("/:incidentId/resolve", async (request, response) => {
  const { note } = asObject(request.body);
  if (!nonblank(note)) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the resolution and try again.", [
      { field: "note", code: "REQUIRED", message: "Describe how the incident was resolved." },
    ]);
  }
  if (note.trim().length > MAX_NOTE_LENGTH) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the resolution and try again.", [
      { field: "note", code: "TOO_LONG", message: `Use at most ${MAX_NOTE_LENGTH} characters.` },
    ]);
  }
  try {
    const result = await changeIncident(request.params.incidentId, transitions.resolve, (request as RoleRequest).profile!.id, note.trim());
    if ("refusal" in result) return refuse(response, result.refusal);
    request.log?.info({ requestId: request.id, incidentId: result.incident.id }, "Incident resolved");
    return response.status(200).json(incidentResponse(result.incident));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Incident resolve failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not resolve the incident.");
  }
});
