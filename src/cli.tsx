#!/usr/bin/env bun
import { render } from 'ink';
import React from 'react';
import { loadServers } from './lib/config';
import { MonitorApp } from './components/MonitorApp';

async function main() {
  const servers = await loadServers();

  if (servers.length === 0) {
    console.error('No servers configured. Edit servers.json with your server details.');
    process.exit(1);
  }

  console.log('Starting Server Performance Monitor...');
  console.log(`Monitoring ${servers.length} server(s)`);
  console.log('Press Ctrl+C to exit\n');

  // Render with Ink v5 (uses render() instead of App component)
  render(<MonitorApp servers={servers} interval={5000} />);
}

main();
