import app from "./app.js";
import { dbConnection } from "./config/db.config.js";
import { envConfig } from "./config/env.config.js";

dbConnection()
  .then(() => {
    app.listen(envConfig.port, () => {
      console.log(`Server is running on port: ${envConfig.port} 🚀`);
    });
  })
  .catch((err) => {
    console.log(`‼️ connection failed: ${err}`);
  });
