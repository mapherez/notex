import { create } from 'zustand';
import {
  DEFAULT_LOCAL_MCP_PORT,
  getLocalMcpState,
  initializeLocalMcpServer,
  isValidLocalMcpPort,
  localMcpUrl,
  startLocalMcpServer,
  stopLocalMcpServer,
  type LocalMcpPublicState,
} from '../core/services/mcpLocalServer';
import { useAppStore } from './useAppStore';

type LocalMcpAction = 'start' | 'stop' | null;

type LocalMcpStore = {
  connection: LocalMcpPublicState;
  initialized: boolean;
  action: LocalMcpAction;
  port: number;
  initialize: () => Promise<void>;
  setPort: (port: number) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const initialConnection: LocalMcpPublicState = {
  state: 'stopped',
  rendererReady: false,
  port: DEFAULT_LOCAL_MCP_PORT,
  url: localMcpUrl(DEFAULT_LOCAL_MCP_PORT),
};

let initialization: Promise<void> | null = null;

export const useLocalMcpStore = create<LocalMcpStore>((set, get) => ({
  connection: initialConnection,
  initialized: false,
  action: null,
  port: DEFAULT_LOCAL_MCP_PORT,
  initialize: async () => {
    const configuredPort = useAppStore.getState().settings.mcpPort;
    set({
      port: configuredPort,
      connection: {
        ...get().connection,
        port: configuredPort,
        url: localMcpUrl(configuredPort),
      },
    });
    if (!initialization) {
      initialization = initializeLocalMcpServer((connection) => {
        set({ connection: withConfiguredPort(connection, get().port) });
      })
        .then((connection) => {
          set({
            connection: withConfiguredPort(connection, get().port),
            initialized: true,
          });
        })
        .catch(async () => {
          const connection = await getLocalMcpState().catch(() => ({
            state: 'error' as const,
            rendererReady: false,
            errorCode: 'INITIALIZATION_FAILED',
            errorMessage: 'The local MCP server could not be initialized.',
          }));
          set({
            connection: withConfiguredPort(connection, get().port),
            initialized: true,
          });
          initialization = null;
        });
    }
    await initialization;
  },
  setPort: async (port) => {
    if (!isValidLocalMcpPort(port)) {
      throw new Error('The MCP port must be between 1024 and 65535.');
    }
    if (!['stopped', 'error'].includes(get().connection.state)) {
      throw new Error('The MCP server must be stopped before changing its port.');
    }

    await useAppStore.getState().setMcpPort(port);
    set((state) => ({
      port,
      connection: {
        ...state.connection,
        port,
        url: localMcpUrl(port),
      },
    }));
  },
  start: async () => {
    set({ action: 'start' });
    try {
      const connection = await startLocalMcpServer(get().port);
      set({ connection: withConfiguredPort(connection, get().port) });
    } catch (error) {
      const connection = await getLocalMcpState();
      set({ connection: withConfiguredPort(connection, get().port) });
      throw error;
    } finally {
      set({ action: null });
    }
  },
  stop: async () => {
    set({ action: 'stop' });
    try {
      const connection = await stopLocalMcpServer();
      set({ connection: withConfiguredPort(connection, get().port) });
    } finally {
      set({ action: null });
    }
  },
}));

function withConfiguredPort(
  connection: LocalMcpPublicState,
  configuredPort: number,
): LocalMcpPublicState {
  const port = connection.port ?? configuredPort;
  return {
    ...connection,
    port,
    url: connection.url ?? localMcpUrl(port),
  };
}
