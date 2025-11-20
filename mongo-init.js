// mongo-init.js
// Runs only when the data directory is empty (first container startup).

db = db.getSiblingDB("admin");

rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
});
