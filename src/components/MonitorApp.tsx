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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processFilter, setProcessFilter] = useState('');

  // 手动刷新所有服务器
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    addMessage('info', 'Refreshing...');
    for (let i = 0; i < pollingServers.length; i++) {
      await pollServer(i, pollingServers[i].config);
    }
    setIsRefreshing(false);
  };

  // 捕获鼠标点击和键盘事件
  useEffect(() => {
    const handler = (data: Buffer) => {
      const input = data.toString();
      
      // Tab 键切换输入模式
      if (input === '\t' && !showInput) {
        setShowInput(true);
        setCommand('');
        return;
      }
      
      // 捕获 ANSI 鼠标点击事件 (SGR 模式)
      // 格式: \x1b[<buttons>;<x>;<y>M (鼠标按下) 或 \x1b[<buttons>;<x>;<y>m (鼠标释放)
      const mouseMatch = input.match(/\x1b\[([0-9]+);([0-9]+);([0-9]+)[Mm]/);
      if (mouseMatch) {
        const buttons = parseInt(mouseMatch[1]);
        const x = parseInt(mouseMatch[2]) - 1; // 1-indexed
        const y = parseInt(mouseMatch[3]) - 1; // 1-indexed
        
        // 只有鼠标释放事件 (button 0, 1, 2, 3) 且非移动/滚动
        const isRelease = input.endsWith('m');
        const isLeftClick = buttons === 0 || buttons === 1; // 左键按下/释放
        
        if (isRelease && isLeftClick) {
          // 刷新按钮区域: 第 6 行 (0-indexed: 5)，列 3-19（带边框 padding）
          // "⟳ Refresh [R]" 的位置在边框内
          const buttonY = 5;
          const buttonX = 3;
          const buttonWidth = 17;
          
          if (y === buttonY && x >= buttonX && x < buttonX + buttonWidth) {
            handleRefresh();
          }
        }
        return;
      }
      
      // 键盘 'r' 键刷新 (不在输入模式下)
      if (input === 'r' && !showInput) {
        handleRefresh();
      }
    };
    
    process.stdin.resume();
    if (typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true);
    }
    process.stdin.addListener('data', handler);
    return () => {
      process.stdin.removeListener('data', handler);
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    };
  }, [showInput, isRefreshing, pollingServers]);

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

 // 聚合所有已连接服务器的 top processes
  const allTopProcesses = pollingServers
    .filter(s => s.connected && s.metrics && s.metrics.topProcesses.length > 0)
    .flatMap(s =>
      s.metrics!.topProcesses.map(p => ({
        ...p,
        serverName: s.config.name,
      }))
    );

  // 按过滤词筛选进程
  const filteredProcesses = processFilter
    ? allTopProcesses.filter(p =>
        p.command.toLowerCase().includes(processFilter.toLowerCase()) ||
        p.serverName.toLowerCase().includes(processFilter.toLowerCase())
      )
    : allTopProcesses;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1}>
      {/* 标题栏 */}
      <Box>
        <Text bold color="cyan">🖥️  Server Performance Monitor</Text>
      </Box>
      <Box>
        <Text color="dim">
          Refresh every {interval / 1000}s | Tab for command | Esc to clear filter
        </Text>
      </Box>

      {/* 刷新按钮 */}
      <Box marginTop={1}>
        <Box borderStyle="single" borderColor={isRefreshing ? 'yellow' : 'green'} paddingX={1}>
          <Text bold color={isRefreshing ? 'yellow' : 'green'}>
            ⟳ Refresh
          </Text>
          <Text color="dim"> [R]</Text>
        </Box>
      </Box>

      {/* 消息 */}
      {messages.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {messages.map((msg, i) => (
            <Text key={i} color={msg.type === 'error' ? 'red' : msg.type === 'success' ? 'green' : 'white'}>
              {msg.type === 'info' ? 'ℹ' : msg.type === 'error' ? '✖' : '✔'} {msg.text}
            </Text>
          ))}
        </Box>
      )}

      {/* 主内容：左侧服务器卡片 + 右侧 Top Processes */}
      <Box flexDirection="row" marginTop={1}>
        {/* 左侧：服务器卡片 */}
        <Box flexDirection="column" flexWrap="wrap" flexGrow={1}>
          {pollingServers.map((server) => (
            <ServerCard
              key={server.config.name}
              server={server}
              formatBytes={formatBytes}
              formatUptime={formatUptime}
              loadAverageColor={loadAverageColor}
            />
          ))}
        </Box>

        {/* 右侧：Top Processes 侧边栏 */}
        <Box flexDirection="column" width={40} borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">  Top Processes</Text>

          {/* 过滤输入框 */}
          <Box marginTop={1}>
            <Text color="cyan">  filter: </Text>
            <TextInput
              value={processFilter}
              onChange={setProcessFilter}
              placeholder="process name..."
            />
          </Box>

          {filteredProcesses.length === 0 ? (
            <Box marginTop={1}>
              <Text color="dim">
                {processFilter ? '  No matching processes' : '  No processes data'}
              </Text>
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              {filteredProcesses.slice(0, 20).map((p, i) => {
                const cpuColor = p.cpu > 50 ? 'red' : p.cpu > 20 ? 'yellow' : 'green';
                const memColor = p.memPercent > 20 ? 'red' : p.memPercent > 10 ? 'yellow' : 'green';
                const cmd = p.command.length > 35 ? p.command.slice(0, 32) + '...' : p.command;
                return (
                  <Box key={i} flexDirection="column">
                    <Box>
                      <Text color="cyan">  </Text>
                      <Text bold>{p.serverName} </Text>
                      <Text color="dim">PID:{p.pid} </Text>
                    </Box>
                    <Box>
                      <Text color={cpuColor}>CPU:{p.cpu.toFixed(1)}% </Text>
                      <Text color={memColor}>MEM:{p.memPercent.toFixed(1)}%</Text>
                    </Box>
                    <Box>
                      <Text color="dim">  </Text>
                      <Text>{cmd}</Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
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
              placeholder="Type help for commands..."
            />
          ) : (
            <Text color="dim">
              Press Tab to enter command
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
