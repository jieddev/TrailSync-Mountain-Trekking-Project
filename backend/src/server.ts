import "dotenv/config";

import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

// 0.0.0.0 so hosts such as Render can reach the API from outside the container.
app.listen(port, "0.0.0.0", () => {
  console.log(`TrailSync API listening on port ${port}`);
});
