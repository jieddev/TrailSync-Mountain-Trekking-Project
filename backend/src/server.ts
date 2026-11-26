import "dotenv/config";

import { app } from "./app.js";
import { logger } from "./lib/logger.js";

// Brevo needs a verified sender; without one every sign-up code fails with a 500.
if (process.env.BREVO_API_KEY?.trim() && !process.env.MAIL_FROM?.trim()) {
  logger.warn("BREVO_API_KEY is set but MAIL_FROM is empty; emails will fail until MAIL_FROM is a Brevo-verified sender.");
}

const port = Number(process.env.PORT ?? 3000);

// 0.0.0.0 so hosts such as Render can reach the API from outside the container.
app.listen(port, "0.0.0.0", () => {
  console.log(`TrailSync API listening on port ${port}`);
});
