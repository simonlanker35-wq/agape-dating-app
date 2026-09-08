import mongoose from "mongoose";
import config from "./config.js";

async function createIndexes() {
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  await db.collection("users").createIndex({ location: "2dsphere" });
  await db.collection("users").createIndex({ gender: 1, age: 1 });
  await db.collection("users").createIndex({ isActive: 1, lastActive: -1 });
  console.log("Indexes created");
  await mongoose.disconnect();
}

createIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});
