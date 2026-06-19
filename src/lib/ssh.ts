import { ServerConfig, ServerMetrics } from '../types';
import { Client } from 'ssh2';
import { promisify } from 'util';

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

      stream.on('close', (code) => {
        resolve({ stdout, stderr, code });
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

    if (config.password) {
      connOpts.password = config.password;
    }
    if (config.keyPath) {
      connOpts.privateKey = config.keyPath.replace('~', process.env.HOME || '');
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
          execSSH(conn, "df -BM --output=size,used,avail,pcent / 2>/dev/null | tail -1"),
          execSSH(conn, 'cat /proc/uptime | awk \'{printf "%.0f", $1}\''),
        ]);

        const [cpuLine, nproc, uptimeOut, memInfo, swapInfo, diskInfo, procUptime] = results;

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

        // Parse disk
        const diskParts = diskInfo.stdout.trim().split(/\s+/);
        const diskTotal = parseInt(diskParts[0], 10) || 0;
        const diskUsed = parseInt(diskParts[1], 10) || 0;
        const diskFree = parseInt(diskParts[2], 10) || 0;
        const diskUsage = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

        // Parse uptime
        const uptime = parseInt(procUptime.stdout.trim(), 10) || 0;

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
          disk: [
            {
              total: diskTotal,
              used: diskUsed,
              free: diskFree,
              usage: Math.max(0, Math.min(100, diskUsage)),
            },
          ],
          network: {
            rxBytes: 0,
            txBytes: 0,
          },
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
