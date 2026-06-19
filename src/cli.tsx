#!/usr/bin/env bun
import { App } from 'ink';
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

  // Render with Ink
  const app = (
    <App exitOnExit={true}>
      <MonitorApp servers={servers} interval={5000} />
    </App>
  );

  app.render();
}

main();
