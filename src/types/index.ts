export interface ServerConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  /** SSH 公钥路径，默认 ~/.ssh/id_rsa（免密登录） */
  keyPath?: string;
  /** SSH 密码（可选，默认使用公钥认证） */
  password?: string;
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
