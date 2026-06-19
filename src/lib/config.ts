import { ServerConfig } from '../types';

const DEFAULT_CONFIG_PATH = 'servers.json';



export async function loadServers(configPath?: string): Promise<ServerConfig[]> {
  const path = configPath || DEFAULT_CONFIG_PATH;
  const { join } = await import('path');
  try {
    const fullPath = join(process.cwd(), path);
    const content = await readFileSafe(fullPath);
    const config = JSON.parse(content);
    if (!config.servers || !Array.isArray(config.servers)) {
      console.error(`Invalid config format in ${path}: missing "servers" array`);
      process.exit(1);
    }
    return config.servers.map((s: Partial<ServerConfig>) => ({
      name: s.name || s.host,
      host: s.host,
      port: s.port || 22,
      user: s.user,
      password: s.password,
      keyPath: s.keyPath,
    }));
  } catch (err: any) {
    if (err.code === 'ENOENT' || err.message.includes('ENOENT')) {
      console.error(`Config file not found: ${path}`);
      console.error('Please create a servers.json file with your server details.');
      process.exit(1);
    }
    console.error(`Failed to load config: ${err.message}`);
    process.exit(1);
  }
}

async function readFileSafe(filepath: string): Promise<string> {
  // Use Bun.file() if available (Bun runtime)
  if (typeof Bun !== 'undefined' && Bun.file) {
    return await Bun.file(filepath).text();
  }
  // Node.js fallback
  const { readFileSync } = await import('fs');
  return readFileSync(filepath, 'utf-8');
}

export function createExampleConfig(): void {
  const example = {
    servers: [
      {
        name: 'My Server',
        host: '192.168.1.100',
        port: 22,
        user: 'root',
        password: 'your-password',
        // keyPath: '~/.ssh/id_rsa',
      },
    ],
  };
  writeFileSyncSafe(DEFAULT_CONFIG_PATH, JSON.stringify(example, null, 2));
  console.log(`Created ${DEFAULT_CONFIG_PATH}. Edit it with your server details.`);
}

function writeFileSyncSafe(path: string, data: string): void {
  if (typeof Bun !== 'undefined' && Bun.write) {
    Bun.write(path, data);
  } else {
    import('fs').then(({ writeFileSync }) => writeFileSync(path, data));
  }
}
