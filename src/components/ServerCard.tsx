import React from 'react';
import { Box, Text } from 'ink';
import { ServerStatus } from '../types';

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
          <Text dimText>
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
          <Text dimText> {' '}({config.host}:{config.port})</Text>
        </Box>
        <Box>
          <Text color="yellow">  Loading metrics...</Text>
        </Box>
      </Box>
    );
  }

  const { cpu, memory, disk, uptime } = metrics;

  const cpuColor = cpu.usage > 90 ? 'red' : cpu.usage > 70 ? 'yellow' : 'green';
  const memColor = memory.usage > 90 ? 'red' : memory.usage > 70 ? 'yellow' : 'green';
  const diskColor = disk[0]?.usage > 90 ? 'red' : disk[0]?.usage > 70 ? 'yellow' : 'green';

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor="green" marginLeft={1}>
      {/* Header */}
      <Box>
        <Text bold color="green">{' '}✓ {config.name}</Text>
        <Text dimText>{' '}({config.host}:{config.port})</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
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
          <Text dimText>  Load: </Text>
          <Text color={loadAverageColor(cpu.load1, cpu.cores)}>
            {cpu.load1.toFixed(2)}
          </Text>
          <Text dimText>/</Text>
          <Text color={loadAverageColor(cpu.load5, cpu.cores)}>
            {cpu.load5.toFixed(2)}
          </Text>
          <Text dimText>/</Text>
          <Text color={loadAverageColor(cpu.load15, cpu.cores)}>
            {cpu.load15.toFixed(2)}
          </Text>
          <Text dimText>  </Text>
          <Text dimText>Uptime: </Text>
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
            <Text dimText>  Swap: </Text>
            <Text color={memory.swapUsed > memory.swapTotal * 0.7 ? 'yellow' : 'green'}>
              {formatBytes(memory.swapUsed)} / {formatBytes(memory.swapTotal)}
              {' '}({(memory.swapUsed / memory.swapTotal * 100).toFixed(1)}%)
            </Text>
          </Box>
        )}

        {/* Disk */}
        {disk.map((d, i) => (
          <Box key={i} marginTop={1}>
            <Text bold color="gray">  Disk</Text>
            <ProgressBar
              value={d.used}
              max={d.total}
              label=""
              formatValue={formatBytes}
              color={diskColor}
            />
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimText>  Last update: {new Date(metrics.timestamp).toLocaleTimeString()}</Text>
      </Box>
    </Box>
  );
}
