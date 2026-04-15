import { createApp } from "./app.js";
import { getConfig } from "./config.js";

const config = getConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Minecraft stats API listening on :${config.port}`);
});

