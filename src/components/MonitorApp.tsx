import React, { useState, useEffect } from 'react';
import { Box, Text, Static } from 'ink';
import { ServerConfig, ServerMetrics } from '../types';
import { getMetrics } from '../lib/ssh';
import { ServerCard } from './ServerCard';
import TextInput from 'ink-text-input';

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
  const [command, setCommand] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [messages, setMessages] = useState<{ type: 'info' | 'error' | 'success'; text: string }[]>([]);

  // Tab 键切换输入模式
  useEffect(() => {
    const handler = (data: Buffer) => {
      const input = data.toString();
      if (input === '\t') {
        setShowInput((prev) => !prev);
        if (!showInput) {
          setCommand('');
        }
      }
    };
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.addListener('data', handler);
    return () => {
      process.stdin.removeListener('data', handler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
  }, [showInput]);

  const addMessage = (type: 'info' | 'error' | 'success', text: string) => {
    setMessages((prev) => [...prev, { type, text }]);
    // 3秒后自动清除消息
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.text !== text));
    }, 3000);
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    
    if (trimmed === 'help' || trimmed === '--help' || trimmed === '/help') {
      addMessage('info', 'Commands: help, add, clear');
    } else if (trimmed === 'add' || trimmed === '--add') {
      addMessage('info', 'Run "bun start --add" to add a server');
    } else if (trimmed === 'clear') {
      setMessages([]);
    } else if (trimmed) {
      addMessage('error', `Unknown command: ${cmd}. Type "help" for available commands.`);
    }
    
    setCommand('');
    setShowInput(false);
  };

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
        {'  '}Refresh every {interval / 1000}s | Ctrl+C to exit | Tab for command
      </Text>
      
      {/* 显示消息 */}
      {messages.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {messages.map((msg, i) => (
            <Text key={i} color={msg.type === 'error' ? 'red' : msg.type === 'success' ? 'green' : 'white'}>
              {'  '}{msg.type === 'info' ? 'ℹ' : msg.type === 'error' ? '✖' : '✔'} {msg.text}
            </Text>
          ))}
        </Box>
      )}
      
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
      
      {/* 命令输入行 */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="green" bold>
            {'  › '}
          </Text>
          {showInput ? (
          <TextInput
               value={command}
               onChange={setCommand}
               onSubmit={handleCommand}
               onKeyDown={(key) => {
                 if (key.escape) {
                   setShowInput(false);
                   setCommand('');
                 }
               }}
               placeholder="Type help for commands..."
             />
          ) : (
            <Text dimText>
              Press Tab to enter command
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
