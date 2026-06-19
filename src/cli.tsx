#!/usr/bin/env bun
import { render } from 'ink';
import React from 'react';
import { loadServers, addServer, createExampleConfig } from './lib/config';
import { MonitorApp } from './components/MonitorApp';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // 添加服务器
  if (command === '--add' || command === 'add') {
    await addServer();
    return;
  }

  // 创建示例配置
  if (command === '--init' || command === 'init') {
    createExampleConfig();
    return;
  }

  // 默认启动监控
  const servers = await loadServers();

  if (servers.length === 0) {
    console.error('No servers configured. Run "cli-performance --add" to add a server.');
    process.exit(1);
  }

  console.log('Starting Server Performance Monitor...');
  console.log(`Monitoring ${servers.length} server(s)`);
  console.log('Press Ctrl+C to exit\n');

  // Render with Ink v5 (uses render() instead of App component)
  render(<MonitorApp servers={servers} interval={5000} />);
}

main();
