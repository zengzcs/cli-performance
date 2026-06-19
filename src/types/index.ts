export interface ServerConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  keyPath?: string;
}

export interface ServerMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  }[];
  network: {
    rxBytes: number;
    txBytes: number;
  };
  uptime: number;
}

export interface ServerStatus {
  config: ServerConfig;
  metrics: ServerMetrics | null;
  error: string | null;
  connected: boolean;
  lastUpdate: number | null;
}
