import React from 'react';
import { Box, Text } from 'ink';
import { ServerStatus, ServerMetrics } from '../types';

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  formatValue: (bytes: number) => string;
  color?: 'green' | 'yellow' | 'red';
}

function ProgressBar({ value, max, label, formatValue, color = 'green' }: ProgressBarProps) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const barWidth = 30;
  const filledWidth = Math.round((percent / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const colorName = color || (percent > 90 ? 'red' : percent > 70 ? 'yellow' : 'green');

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="gray">{label}</Text>
        <Text>
          <Text color={colorName}>
            {' '}{formatValue(value)} / {formatValue(max)}
          </Text>
          {' '}
          <Text color={colorName}>
            ({percent.toFixed(1)}%)
          </Text>
        </Text>
      </Box>
      <Box>
        <Text color={colorName}>{'█'.repeat(Math.max(0, filledWidth))}</Text>
        <Text color="dim">{'░'.repeat(emptyWidth)}</Text>
        <Text color="dim"> {percent.toFixed(0)}%</Text>
      </Box>
    </Box>
  );
}

interface MiniBarProps {
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'red';
  suffix?: string;
}

function MiniBar({ label, value, color, suffix }: MiniBarProps) {
  const barWidth = 15;
  const filledWidth = Math.round((value / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  return (
    <Box>
      <Text color="dim">  {label}: </Text>
      <Box>
        <Text color={color}>{'█'.repeat(Math.max(0, filledWidth))}</Text>
        <Text color="dim">{'░'.repeat(emptyWidth)}</Text>
        <Text color={color}> {value.toFixed(1)}%</Text>
        {suffix && <Text color="dim"> {suffix}</Text>}
      </Box>
    </Box>
  );
}

function formatBytesCompact(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getNetColor(usage: number): 'green' | 'yellow' | 'red' {
  return usage > 90 ? 'red' : usage > 70 ? 'yellow' : 'green';
}

function formatBytesPerSecond(bytes: number): string {
  if (bytes === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface ServerCardProps {
  server: ServerStatus;
  formatBytes: (bytes: number) => string;
  formatUptime: (seconds: number) => string;
  loadAverageColor: (load: number, cores: number) => string;
}

export function ServerCard({ server, formatBytes, formatUptime, loadAverageColor }: ServerCardProps) {
  const { config, metrics, error, connected } = server;

  if (error || !connected) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor="red" marginLeft={1}>
        <Box>
          <Text bold color="red">
            {' '}✗ {config.name}
          </Text>
          <Text color="dim">
            {' '}({config.host}:{config.port})
          </Text>
        </Box>
        <Box>
          <Text color="red">  Connection failed: {error || 'Offline'}</Text>
        </Box>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor="yellow" marginLeft={1}>
        <Box>
          <Text bold color="yellow"> {' '}⏳ {config.name}</Text>
          <Text color="dim"> {' '}({config.host}:{config.port})</Text>
        </Box>
        <Box>
          <Text color="yellow">  Loading metrics...</Text>
        </Box>
      </Box>
    );
  }

  const { cpu, memory, disk, netInterfaces, netConnections, topProcesses, diskAll, uptime } = metrics;

  const cpuColor = cpu.usage > 90 ? 'red' : cpu.usage > 70 ? 'yellow' : 'green';
  const memColor = memory.usage > 90 ? 'red' : memory.usage > 70 ? 'yellow' : 'green';

  const renderDiskSection = () => {
    // Show all filesystems if multiple, otherwise show root disk with progress bar
    if (diskAll.length > 1) {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="gray">  Filesystems</Text>
          {diskAll.map((d, i) => {
            const color = d.usage > 90 ? 'red' : d.usage > 70 ? 'yellow' : 'green';
            return (
              <Box key={i}>
                <Text color="dim">  </Text>
                <Text color="dim">{d.mountPoint} </Text>
                <Text color={color}>
                  {formatBytesCompact(d.used)} / {formatBytesCompact(d.total)} ({d.usage.toFixed(1)}%)
                </Text>
              </Box>
            );
          })}
        </Box>
      );
    }
    // Single disk - show progress bar
    const diskColor = disk[0]?.usage > 90 ? 'red' : disk[0]?.usage > 70 ? 'yellow' : 'green';
    return (
      <Box marginTop={1}>
        <Text bold color="gray">  Disk</Text>
        <ProgressBar
          value={disk[0]?.used || 0}
          max={disk[0]?.total || 1}
          label=""
          formatValue={formatBytes}
          color={diskColor}
        />
      </Box>
    );
  };

  const renderNetSection = () => {
    if (netInterfaces.length === 0 && netConnections.total === 0) {
      return null;
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="gray">  Network</Text>

        {/* Network interfaces */}
        {netInterfaces.length > 0 && (
          <Box flexDirection="column">
            {netInterfaces.map((iface, i) => (
              <Box key={i}>
                <Text bold>{`  ${iface.name}`}</Text>
                <Text color="green">
                  {' '}↓ {formatBytesCompact(iface.rxBytes)}
                </Text>
                <Text color="blue">
                  {' '}↑ {formatBytesCompact(iface.txBytes)}
                </Text>
                {iface.rxErrors > 0 && (
                  <Text color="red">  rxErr:{iface.rxErrors} txErr:{iface.txErrors}</Text>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Connection states */}
        {netConnections.total > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>  Connections</Text>
            <Box>
              <Text color="green">  EST:{netConnections.established}</Text>
              <Text color="yellow">  LISTEN:{netConnections.listen}</Text>
              <Text color="red">  TIME_WAIT:{netConnections.timeWait}</Text>
              <Text color="orange">  CLOSE_WAIT:{netConnections.closeWait}</Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderProcessesSection = () => {
    if (topProcesses.length === 0) {
      return null;
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="gray">  Top Processes</Text>
        {topProcesses.slice(0, 5).map((p, i) => {
          const cpuColor = p.cpu > 50 ? 'red' : p.cpu > 20 ? 'yellow' : 'green';
          const memColor = p.memPercent > 20 ? 'red' : p.memPercent > 10 ? 'yellow' : 'green';
          const cmd = p.command.length > 45 ? p.command.slice(0, 42) + '...' : p.command;
          return (
            <Box key={i}>
              <Text color="dim">  </Text>
              <Text color="dim">#{i + 1}</Text>
              <Text color="dim"> PID:{p.pid} </Text>
              <Text color={cpuColor}>CPU:{p.cpu.toFixed(1)}%</Text>
              <Text color={memColor}> MEM:{p.memPercent.toFixed(1)}%</Text>
              <Text color="dim"> </Text>
              <Text>{cmd}</Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor="green" marginLeft={1}>
      {/* Header */}
      <Box>
        <Text bold color="green">{' '}✓ {config.name}</Text>
        <Text color="dim">{' '}({config.host}:{config.port})</Text>
      </Box>

      <Box flexDirection="column">
        {/* CPU */}
        <Box>
          <Text bold color="gray">  CPU ({cpu.cores} cores)</Text>
          <Text color={cpuColor}>
            {' '}{cpu.usage.toFixed(1)}%
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={cpuColor}>{'█'.repeat(Math.round(cpu.usage / 3.33))}</Text>
          <Text color="dim">{'░'.repeat(30 - Math.round(cpu.usage / 3.33))}</Text>
        </Box>

        <Box>
          <Text color="dim">  Load: </Text>
          <Text color={loadAverageColor(cpu.load1, cpu.cores)}>
            {cpu.load1.toFixed(2)}
          </Text>
          <Text color="dim">/</Text>
          <Text color={loadAverageColor(cpu.load5, cpu.cores)}>
            {cpu.load5.toFixed(2)}
          </Text>
          <Text color="dim">/</Text>
          <Text color={loadAverageColor(cpu.load15, cpu.cores)}>
            {cpu.load15.toFixed(2)}
          </Text>
          <Text color="dim">  </Text>
          <Text color="dim">Uptime: </Text>
          <Text color="green">{formatUptime(uptime)}</Text>
        </Box>

        {/* Memory */}
        <Box marginTop={1}>
          <Text bold color="gray">  Memory</Text>
          <ProgressBar
            value={memory.used}
            max={memory.total}
            label=""
            formatValue={formatBytes}
            color={memColor}
          />
        </Box>

        {/* Swap */}
        {memory.swapTotal > 0 && (
          <Box>
            <Text color="dim">  Swap: </Text>
            <Text color={memory.swapUsed > memory.swapTotal * 0.7 ? 'yellow' : 'green'}>
              {formatBytes(memory.swapUsed)} / {formatBytes(memory.swapTotal)}
              {' '}({(memory.swapUsed / memory.swapTotal * 100).toFixed(1)}%)
            </Text>
          </Box>
        )}

        {renderDiskSection()}
        {renderNetSection()}
        {renderProcessesSection()}
      </Box>

      <Box marginTop={1}>
        <Text color="dim">  Last update: {new Date(metrics.timestamp).toLocaleTimeString()}</Text>
      </Box>
    </Box>
  );
}
