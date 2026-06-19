import { ServerConfig, ServerMetrics, NetInterfaceStats, NetConnectionCount, TopProcess, DiskEntry } from '../types';
import { Client } from 'ssh2';
import { promisify } from 'util';
import * as fs from 'fs';

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function execSSH(
  conn: Client,
  command: string
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';
      let code: number | null = null;

      stream.on('close', (code: number | undefined) => {
        resolve({ stdout, stderr, code: code ?? null });
      }).on('data', (data: Buffer) => {
        stdout += data.toString();
      }).stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

function parseUptime(uptimeStr: string): number {
  // uptime format: " 14:32:45 up 10 days,  3:21,  1 user,  load average: 0.50, 0.30, 0.15"
  const match = uptimeStr.match(/load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (!match) return 0;
  // Return seconds approximation
  const daysMatch = uptimeStr.match(/up\s+(\d+)\s+day/);
  const hoursMatch = uptimeStr.match(/up\s+\d+\s+day.*?(\d+):(\d+)/);
  let seconds = 0;
  if (daysMatch) seconds += parseInt(daysMatch[1], 10) * 86400;
  if (hoursMatch) {
    seconds += parseInt(hoursMatch[1], 10) * 3600;
    seconds += parseInt(hoursMatch[2], 10) * 60;
  }
  return seconds;
}

export async function getMetrics(config: ServerConfig): Promise<ServerMetrics> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    const connOpts: any = {
      host: config.host,
      port: config.port,
      username: config.user,
      readyTimeout: 10000,
    };

    // 默认使用 SSH 公钥认证（免密登录）
    // 如果配置了 keyPath，优先使用私钥认证
    // 如果没有 keyPath 但有 password，使用密码认证
    // 如果都没有，尝试使用系统默认 SSH 密钥（~/.ssh/id_rsa 等）
    const loadPrivateKey = (keyPath: string): string | null => {
      const resolvedPath = keyPath.replace('~', process.env.HOME || '');
      if (!fs.existsSync(resolvedPath)) return null;
      try {
        return fs.readFileSync(resolvedPath, 'utf8');
      } catch {
        return null;
      }
    };

    if (config.keyPath) {
      const keyContent = loadPrivateKey(config.keyPath);
      if (keyContent) {
        connOpts.privateKey = keyContent;
      }
    } else if (!config.password) {
      // 未配置 keyPath 且未配置 password，尝试使用默认 SSH 密钥
      const defaultKeys = ['~/.ssh/id_rsa', '~/.ssh/id_ed25519', '~/.ssh/id_ecdsa', '~/.ssh/rsa'];
      for (const key of defaultKeys) {
        const keyContent = loadPrivateKey(key);
        if (keyContent) {
          connOpts.privateKey = keyContent;
          break;
        }
      }
    }
    if (config.password) {
      connOpts.password = config.password;
    }

    conn.on('ready', async () => {
      try {
        // Run all commands in parallel for consistent snapshot
        const results = await Promise.all([
          execSSH(conn, 'top -bn1 | grep "Cpu(s)" || (echo "0.0" && echo "0.0")'),
          execSSH(conn, 'nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1'),
          execSSH(conn, 'uptime'),
          execSSH(conn, "free -b | awk '/Mem:/{printf \"%.0f %.0f %.0f\", $2, $3, $3/$2*100}'"),
          execSSH(conn, "free -b | awk '/Swap:/{printf \"%.0f %.0f %.0f\", $2, $3, $4}'"),
          execSSH(conn, "df -BM --output=size,used,avail,pcent,mounted 2>/dev/null | tail -n +2"),
          execSSH(conn, 'cat /proc/uptime | awk \'{printf "%.0f", $1}\''),
          execSSH(conn, 'cat /proc/net/dev 2>/dev/null'),
          execSSH(conn, 'ss -s 2>/dev/null || netstat -s 2>/dev/null | head -20'),
          execSSH(conn, 'ps aux --sort=-%cpu 2>/dev/null | head -11'),
        ]);

        const [cpuLine, nproc, uptimeOut, memInfo, swapInfo, diskInfo, procUptime, netDev, ssOut, psOut] = results;

        // Parse CPU usage
        let cpuUsage = 0;
        const cpuMatch = cpuLine.stdout.match(/user\s+(\d+\.?\d*)|id\s+(\d+\.?\d*)/g);
        if (cpuMatch) {
          const idMatch = cpuLine.stdout.match(/id\s+([\d.]+)/);
          if (idMatch) {
            cpuUsage = 100 - parseFloat(idMatch[1]);
          }
        }

        // Parse cores
        const cores = parseInt(nproc.stdout.trim(), 10) || 1;

        // Parse load averages
        const loadMatch = uptimeOut.stdout.match(/load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
        const load1 = loadMatch ? parseFloat(loadMatch[1]) : 0;
        const load5 = loadMatch ? parseFloat(loadMatch[2]) : 0;
        const load15 = loadMatch ? parseFloat(loadMatch[3]) : 0;

        // Parse memory
        const memParts = memInfo.stdout.trim().split(/\s+/);
        const memTotal = parseInt(memParts[0], 10) || 0;
        const memUsed = parseInt(memParts[1], 10) || 0;
        const memUsage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

        // Parse swap
        const swapParts = swapInfo.stdout.trim().split(/\s+/);
        const swapTotal = parseInt(swapParts[0], 10) || 0;
        const swapUsed = parseInt(swapParts[1], 10) || 0;
        const swapFree = parseInt(swapParts[2], 10) || 0;

        // Parse all disk mounts
        const diskAll: DiskEntry[] = [];
        const diskLines = diskInfo.stdout.trim().split('\n').filter(l => l.trim());
        for (const line of diskLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const total = parseInt(parts[0], 10) || 0;
            const used = parseInt(parts[1], 10) || 0;
            const free = parseInt(parts[2], 10) || 0;
            const usage = total > 0 ? (used / total) * 100 : 0;
            const mount = parts[4] || '/';
            const fs = parts[0]; // filesystem name
            diskAll.push({
              total: total * 1024 * 1024, // convert from MB to bytes
              used: used * 1024 * 1024,
              free: free * 1024 * 1024,
              usage: Math.max(0, Math.min(100, usage)),
              mountPoint: mount,
              filesystem: fs,
            });
          }
        }

        // Root disk for legacy display
        const rootDisk = diskAll.find(d => d.mountPoint === '/') || diskAll[0] || null;
        const disk = rootDisk ? [{
          total: rootDisk.total,
          used: rootDisk.used,
          free: rootDisk.free,
          usage: rootDisk.usage,
        }] : [];

        // Parse uptime
        const uptime = parseInt(procUptime.stdout.trim(), 10) || 0;

        // Parse network interfaces from /proc/net/dev
        const netInterfaces: NetInterfaceStats[] = [];
        const netDevLines = netDev.stdout.trim().split('\n').filter(l => l.includes(':'));
        for (const line of netDevLines) {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            // Skip loopback for clarity
            if (name === 'lo' || name.startsWith('lo:')) continue;
            const values = parts[1].trim().split(/\s+/);
            if (values.length >= 16) {
              netInterfaces.push({
                name,
                rxBytes: parseInt(values[1], 10) || 0,
                txBytes: parseInt(values[9], 10) || 0,
                rxPackets: parseInt(values[2], 10) || 0,
                txPackets: parseInt(values[10], 10) || 0,
                rxErrors: parseInt(values[3], 10) || 0,
                txErrors: parseInt(values[11], 10) || 0,
              });
            }
          }
        }

        // Compute total network bytes
        const totalRx = netInterfaces.reduce((sum, n) => sum + n.rxBytes, 0);
        const totalTx = netInterfaces.reduce((sum, n) => sum + n.txBytes, 0);

        // Parse network connection states from ss -s
        let connStats: NetConnectionCount = {
          established: 0,
          listen: 0,
          timeWait: 0,
          closeWait: 0,
          total: 0,
        };
        const ssLines = ssOut.stdout.trim().split('\n');
        for (const line of ssLines) {
          const estMatch = line.match(/(\d+)\s+established/);
          if (estMatch) connStats.established = parseInt(estMatch[1], 10) || 0;
          const twMatch = line.match(/(\d+)\s+time.wait/);
          if (twMatch) connStats.timeWait = parseInt(twMatch[1], 10) || 0;
          const cwMatch = line.match(/(\d+)\s+close.wait/);
          if (cwMatch) connStats.closeWait = parseInt(cwMatch[1], 10) || 0;
          const listenMatch = line.match(/(\d+)\s+listen/);
          if (listenMatch) connStats.listen = parseInt(listenMatch[1], 10) || 0;
          const totalMatch = line.match(/(\d+)\s+total/);
          if (totalMatch) connStats.total = parseInt(totalMatch[1], 10) || 0;
        }

        // Parse top processes
        const topProcesses: TopProcess[] = [];
        const psLines = psOut.stdout.trim().split('\n');
        // First line is header, skip it; remaining lines are processes
        for (let i = 1; i < psLines.length; i++) {
          const line = psLines[i].trim();
          if (!line) continue;
          const parts = line.split(/\s+/);
          // ps aux format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
          if (parts.length >= 11) {
            const pid = parseInt(parts[1], 10);
            const cpu = parseFloat(parts[2]) || 0;
            const memPercent = parseFloat(parts[3]) || 0;
            const command = parts.slice(10).join(' ');
            if (!isNaN(pid)) {
              topProcesses.push({ pid, cpu, memPercent, command });
            }
          }
        }

        resolve({
          timestamp: Date.now(),
          cpu: {
            usage: Math.max(0, Math.min(100, cpuUsage)),
            cores,
            load1,
            load5,
            load15,
          },
          memory: {
            total: memTotal,
            used: memUsed,
            free: memTotal - memUsed,
            usage: Math.max(0, Math.min(100, memUsage)),
            swapTotal,
            swapUsed,
            swapFree,
          },
          disk,
          network: {
            rxBytes: totalRx,
            txBytes: totalTx,
          },
          netInterfaces,
          netConnections: connStats,
          topProcesses,
          diskAll,
          uptime,
        });
      } catch (err: any) {
        reject(new Error(`Failed to get metrics: ${err.message}`));
      } finally {
        conn.end();
      }
    });

    conn.on('error', (err) => {
      reject(new Error(`Connection error: ${err.message}`));
    });

    conn.connect(connOpts);
  });
}
