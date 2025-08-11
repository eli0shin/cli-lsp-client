#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

// Configuration
const SOCKET_PATH = path.join(os.tmpdir(), 'my - cli - daemon.sock');
const PID_FILE = path.join(os.tmpdir(), 'my - cli - daemon.pid');

// Module state
let server = null;

// Check if daemon is already running
async function isDaemonRunning() {
  try {
    // Check if PID file exists
    if (!fs.existsSync(PID_FILE)) {
      return false;
    }


    // Read PID and check if process is still alive
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));

    try {
      // process.kill(pid, 0) throws if process doesn't exist
      process.kill(pid, 0);

      // Also verify the socket exists and is connectable
      return new Promise((resolve) => {
        const testSocket = net.createConnection(SOCKET_PATH);
        testSocket.on('connect', () => {
          testSocket.end();
          resolve(true);
        });
        testSocket.on('error', () => {
          resolve(false);
        });
      });
    } catch (e) {
      // Process doesn't exist, clean up stale files
      cleanup();
      return false;
    }


  } catch (e) {
    return false;
  }
}

// Handle requests from clients
function handleRequest(request) {
  const { command, args = [] } = request;

  switch (command) {
    case 'hello':
      return `Hello ${args[0] || 'World'}! Daemon PID: ${process.pid}`;


    case 'add':
      return args.reduce((sum, num) => sum + parseFloat(num), 0);

    case 'status':
      return {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

    case 'stop':
      // Allow clients to stop the daemon
      setTimeout(() => shutdown(), 100);
      return 'Daemon stopping...';

    default:
      throw new Error(`Unknown command: ${command} `);


  }
}

// Start the daemon process
function startDaemon() {
  console.log('Starting daemon…');

  // Clean up any existing socket file
  cleanup();

  // Create the server
  server = net.createServer((socket) => {
    console.log('Client connected');


    socket.on('data', (data) => {
      try {
        const request = JSON.parse(data.toString());
        console.log('Received request:', request);

        // Process the request
        const result = handleRequest(request);

        // Send response back to client
        socket.write(JSON.stringify({
          success: true,
          result: result,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        socket.write(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });

    socket.on('end', () => {
      console.log('Client disconnected');
    });


  });

  // Listen on Unix domain socket
  server.listen(SOCKET_PATH, () => {
    console.log(`Daemon listening on ${SOCKET_PATH}`);


    // Write PID file
    fs.writeFileSync(PID_FILE, process.pid.toString());

    // Set up graceful shutdown
    process.on('SIGINT', () => shutdown());
    process.on('SIGTERM', () => shutdown());


  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

// Send request to existing daemon
async function sendToExistingDaemon(command, args) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);


    client.on('connect', () => {
      const request = JSON.stringify({ command, args });
      client.write(request);
    });

    client.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        client.end();

        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.error));
        }
      } catch (error) {
        reject(error);
      }
    });

    client.on('error', (error) => {
      reject(error);
    });


  });
}

// Clean up files
function cleanup() {
  try {
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down daemon…');

  if (server) {
    server.close();
  }

  cleanup();
  process.exit(0);
}

// Main entry point
async function run() {
  const args = process.argv.slice(2);
  const command = args[0] || 'hello';
  const commandArgs = args.slice(1);

  try {
    const daemonRunning = await isDaemonRunning();


    if (daemonRunning) {
      // Send request to existing daemon
      const result = await sendToExistingDaemon(command, commandArgs);
      console.log('Result:', result);
    } else {
      // No daemon running, start one
      if (command === 'daemon') {
        // Explicit daemon mode - start and keep running
        startDaemon();
      } else {
        // Start daemon in background and send request
        startDaemon();

        // Wait a bit for daemon to start
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const result = await sendToExistingDaemon(command, commandArgs);
          console.log('Result:', result);
        } catch (error) {
          console.error('Error communicating with daemon:', error.message);
        }
      }
    }


  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export functions for testing or module usage
module.exports = {
  run,
  startDaemon,
  sendToExistingDaemon,
  isDaemonRunning,
  handleRequest,
  cleanup,
  shutdown
};

// Run the CLI if this is the main module
if (require.main === module) {
  run();
}
