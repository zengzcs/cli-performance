import { ServerConfig } from '../types';

const DEFAULT_CONFIG_PATH = 'servers.json';

export async function loadServers(configPath?: string): Promise<ServerConfig[]> {
  const path = configPath || DEFAULT_CONFIG_PATH;
  try {
    const content = await Bun.file(path).text();
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
    if (err.code === 'ENOENT') {
      console.error(`Config file not found: ${path}`);
      console.error('Please create a servers.json file. Run:');
      console.error('  cp servers.example.json servers.json');
      process.exit(1);
    }
    console.error(`Failed to load config: ${err.message}`);
    process.exit(1);
  }
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
  Bun.write(DEFAULT_CONFIG_PATH, JSON.stringify(example, null, 2));
  console.log(`Created ${DEFAULT_CONFIG_PATH}. Edit it with your server details.`);
}
