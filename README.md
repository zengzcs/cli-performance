# cli-performance

A terminal-based remote server performance monitoring tool built with React + Ink + Bun.

## Features

- Monitor multiple servers simultaneously
- Real-time CPU, memory, disk, and network metrics
- SSH connection with config-based server management
- Color-coded performance indicators
- Responsive terminal UI

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- SSH access to target servers

## Installation

```bash
bun install
bun run build
```

## Usage

```bash
# Start the monitor
bun run start

# Or in development mode with hot reload
bun run dev
```

## Configuration

Create a `servers.json` file in the project root:

```json
{
  "servers": [
    {
      "name": "Production",
      "host": "your-server-ip",
      "port": 22,
      "user": "root",
      "password": "your-password",
      "keyPath": "~/.ssh/id_rsa"
    }
  ]
}
```

## Tech Stack

- **Bun** - Fast JavaScript runtime & package manager
- **React** - UI library
- **Ink** - React for CLI
- **Vite** - Build tool
- **SSH2** - SSH connections

## License

MIT
