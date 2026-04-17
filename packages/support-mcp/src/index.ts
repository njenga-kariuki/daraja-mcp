#!/usr/bin/env node
import { startServer } from './server.js';

startServer().catch((err) => {
  console.error('Failed to start @daraja-mcp/support server:', err);
  process.exit(1);
});
