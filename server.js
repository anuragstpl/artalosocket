const WebSocket = require("ws");

// Create a WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log("WebSocket server is running on ws://localhost:8080");

// Store all connected clients
const clients = new Map(); // Use a Map to store clients with their IDs

// Track admins by their adminId
const admins = new Map(); // Key: adminId, Value: WebSocket connection

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New client connected");

  // Listen for initial identification message
  ws.once("message", (rawMessage) => {
    const message = JSON.parse(rawMessage);

    // Extract isAdmin and adminId from the message
    const { isAdmin, adminId } = message;

    if (isAdmin) {
      // Handle admin connection
      if (!admins.has(adminId)) {
        // Register the admin if not already registered
        admins.set(adminId, ws);
        ws.isAdmin = true;
        ws.adminId = adminId; // Attach adminId to the WebSocket object
        console.log(`Admin connected with ID: ${adminId}`);
        ws.send(JSON.stringify({ type: "welcome", message: "Welcome, Admin!" }));
      } else {
        // Reject duplicate admin connection
        ws.send(
          JSON.stringify({
            type: "error",
            message: "An admin with this ID already exists.",
          })
        );
        ws.close();
      }
    } else {
      // Handle regular user connection
      if (!admins.has(adminId)) {
        // Reject connection if no admin exists with the given adminId
        ws.send(
          JSON.stringify({
            type: "error",
            message: "No admin found with the provided adminId.",
          })
        );
        ws.close();
        return;
      }

      // Register the user under the specified admin
      ws.isAdmin = false;
      ws.adminId = adminId; // Attach adminId to the WebSocket object
      clients.set(ws, adminId); // Map the user to their adminId
      console.log(`User connected under admin ID: ${adminId}`);
      ws.send(JSON.stringify({ type: "welcome", message: "Welcome, User!" }));
    }
  });

  // Listen for messages from the client
  ws.on("message", (rawMessage) => {
    console.log(`Received message: ${rawMessage}`);

    const message = JSON.parse(rawMessage);

    if (ws.isAdmin) {
      // If the sender is an admin, broadcast the message to all users in their group
      broadcastToGroup(
        ws.adminId,
        JSON.stringify({
          type: "message",
          sender: "Admin",
          text: message.text,
        })
      );
    } else {
      // If the sender is a regular user, forward the message to their admin
      const adminWs = admins.get(ws.adminId);
      if (adminWs && adminWs.readyState === WebSocket.OPEN) {
        adminWs.send(
          JSON.stringify({
            type: "message",
            sender: "User",
            text: message.text,
          })
        );
      }
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected");

    if (ws.isAdmin) {
      // Remove the admin from the admins map
      admins.delete(ws.adminId);
      console.log(`Admin with ID ${ws.adminId} disconnected`);
    } else {
      // Remove the user from the clients map
      clients.delete(ws);
      console.log(`User disconnected from admin ID ${ws.adminId}`);
    }
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`WebSocket error: ${error.message}`);
  });
});

// Function to broadcast a message to all users in a specific admin's group
function broadcastToGroup(adminId, message) {
  clients.forEach((clientAdminId, clientWs) => {
    if (clientAdminId === adminId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  });
}