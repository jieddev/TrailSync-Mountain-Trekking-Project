import { Router } from "express";
import { fail } from "../lib/http-errors.js";
import { getWeather, WeatherUnavailableError } from "../lib/weather.js";

export const weatherRouter = Router();

// Advisory weather for the trail point. Public: it carries no personal data,
// and the provider key never leaves the server.
weatherRouter.get("/", async (request, response) => {
  try {
    const weather = await getWeather();
    if (weather.stale) request.log?.warn({ requestId: request.id, fetchedAt: weather.fetchedAt }, "Serving stale weather");
    return response.status(200).json(weather);
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      request.log?.warn({ requestId: request.id, reason: error.message, err: error.cause }, "Weather unavailable");
      return fail(response, 503, "WEATHER_UNAVAILABLE", "Weather is unavailable right now.");
    }
    request.log?.error({ requestId: request.id, err: error }, "Weather lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve weather.");
  }
});
