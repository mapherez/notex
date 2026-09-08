import { create } from 'zustand';
import {
  cancelMcpAuthorization,
  deleteMcpAccount,
  getMcpState,
  initializeMcpBridge,
  logoutMcp,
  revokeMcpAiAccess,
  startMcpAuthorization,
  type McpAuthorizationMode,
  type McpPublicState,
} from '../core/services/mcpBridge';

type McpAction = 'register' | 'login' | 'cancel' | 'logout' | 'revoke' | 'delete' | null;

type McpStore = {
  connection: McpPublicState;
  initialized: boolean;
  action: McpAction;
  initialize: () => Promise<void>;
  startAuthorization: (mode: McpAuthorizationMode) => Promise<void>;
  cancelAuthorization: () => Promise<void>;
  logout: () => Promise<void>;
  revokeAiAccess: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

let initialization: Promise<void> | null = null;

export const useMcpStore = create<McpStore>((set) => ({
  connection: { state: 'logged_out' },
  initialized: false,
  action: null,
  initialize: async () => {
    if (!initialization) {
      initialization = initializeMcpBridge((connection) => set({ connection }))
        .then((connection) => {
          set({ connection, initialized: true });
        })
        .catch(async () => {
          const connection = await getMcpState().catch(() => ({ state: 'error' as const }));
          set({ connection, initialized: true });
        });
    }
    await initialization;
  },
  startAuthorization: async (mode) => {
    set({ action: mode });
    try {
      const connection = await startMcpAuthorization(mode);
      set({ connection });
    } finally {
      set({ action: null });
    }
  },
  cancelAuthorization: async () => {
    set({ action: 'cancel' });
    try {
      const connection = await cancelMcpAuthorization();
      set({ connection });
    } finally {
      set({ action: null });
    }
  },
  logout: async () => {
    set({ action: 'logout' });
    try {
      const connection = await logoutMcp();
      set({ connection });
    } finally {
      set({ action: null });
    }
  },
  revokeAiAccess: async () => {
    set({ action: 'revoke' });
    try {
      await revokeMcpAiAccess();
    } finally {
      set({ action: null });
    }
  },
  deleteAccount: async () => {
    set({ action: 'delete' });
    try {
      const connection = await deleteMcpAccount();
      set({ connection });
    } finally {
      set({ action: null });
    }
  },
}));
