import React, { useState, useEffect } from 'react';
import { Box, Text, Static } from 'ink';
import { ServerConfig, ServerMetrics } from '../types';
import { getMetrics } from '../lib/ssh';
import { ServerCard } from './ServerCard';

interface PollingServer {
  config: ServerConfig;
  metrics: ServerMetrics | null;
  error: string | null;
  connected: boolean;
  lastUpdate: number | null;
}

interface MonitorAppProps {
  servers: ServerConfig[];
  interval?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function loadAverageColor(load: number, cores: number): string {
  const loadPerCore = load / cores;
  if (loadPerCore < 0.5) return 'green';
  if (loadPerCore < 1) return 'yellow';
  return 'red';
}

export function MonitorApp({ servers, interval = 5000 }: MonitorAppProps) {
  const [pollingServers, setPollingServers] = useState<PollingServer[]>(
    servers.map((config) => ({
      config,
      metrics: null,
      error: null,
      connected: false,
      lastUpdate: null,
    }))
  );

  const pollServer = async (index: number, config: ServerConfig) => {
    try {
      const metrics = await getMetrics(config);
      setPollingServers((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, metrics, error: null, connected: true, lastUpdate: Date.now() }
            : s
        )
      );
    } catch (err: any) {
      setPollingServers((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, error: err.message, connected: false, lastUpdate: Date.now() }
            : s
        )
      );
    }
  };

  useEffect(() => {
    pollingServers.forEach((_, i) => pollServer(i, pollingServers[i].config));

    const timer = setInterval(() => {
      pollingServers.forEach((_, i) => pollServer(i, pollingServers[i].config));
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold underline color="cyan">
        ┌──────────────────────────────────────────────────────────────┐
      </Text>
      <Text bold color="cyan">
        {'  '}🖥️  Server Performance Monitor
      </Text>
      <Text bold underline color="cyan">
        └──────────────────────────────────────────────────────────────┘
      </Text>
      <Text dimText>
        {'  '}Refresh every {interval / 1000}s | Ctrl+C to exit
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {pollingServers.map((server, index) => (
          <ServerCard
            key={server.config.name}
            server={server}
            formatBytes={formatBytes}
            formatUptime={formatUptime}
            loadAverageColor={loadAverageColor}
          />
        ))}
      </Box>
    </Box>
  );
}
