const WebSocket = require("ws");

// Create a WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log("WebSocket server is running on ws://localhost:8080");

// Store all connected clients
const clients = new Set();

// Track the admin user
let admin = null;

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New client connected");

  // Add the new client to the set of connected clients
  clients.add(ws);
  // Check if this is the first client (admin)
  if (!admin) {
    admin = ws;
    console.log("Admin user connected");
    ws.isAdmin = true; // Mark this client as admin
    ws.send(JSON.stringify({ type: "welcome", message: "Welcome, Admin!" }));
  } else {
    console.log("Regular user connected");
    ws.isAdmin = false; // Mark this client as a regular user
    ws.send(JSON.stringify({ type: "welcome", message: "Welcome, User!" }));
  }

  // Listen for messages from the client
  ws.on("message", (rawMessage) => {
    console.log(`Received message: ${rawMessage}`);

    const message = JSON.parse(rawMessage);

    // If the sender is a regular user, forward the message to the admin
    if (!ws.isAdmin && admin && admin.readyState === WebSocket.OPEN) {
      admin.send(
        JSON.stringify({
          type: "message",
          sender: "User",
          text: message.text,
        })
      );
    } else if (ws.isAdmin) {
      // If the sender is the admin, broadcast the message to all regular users
      broadcastToRegularUsers(
        JSON.stringify({
          type: "message",
          sender: "Admin",
          text: message.text,
        })
      );
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected");

    // Remove the client from the set
    clients.delete(ws);

    // If the admin disconnects, reset the admin
    if (ws.isAdmin) {
      console.log("Admin user disconnected");
      admin = null;
    }
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`WebSocket error: ${error.message}`);
  });
});

// Function to broadcast a message to all regular users
function broadcastToRegularUsers(message) {
  clients.forEach((client) => {
    if (!client.isAdmin && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}