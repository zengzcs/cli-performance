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

export interface NetInterfaceStats {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
}

export interface NetConnectionCount {
  established: number;
  listen: number;
  timeWait: number;
  closeWait: number;
  total: number;
}

export interface TopProcess {
  pid: number;
  cpu: number;
  memPercent: number;
  command: string;
}

export interface DiskEntry {
  mountPoint: string;
  filesystem: string;
  total: number;
  used: number;
  free: number;
  usage: number;
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
  netInterfaces: NetInterfaceStats[];
  netConnections: NetConnectionCount;
  topProcesses: TopProcess[];
  diskAll: DiskEntry[];
  uptime: number;
}

export interface ServerStatus {
  config: ServerConfig;
  metrics: ServerMetrics | null;
  error: string | null;
  connected: boolean;
  lastUpdate: number | null;
}
