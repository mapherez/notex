import { Cable, Loader2, Play, Settings2, Square } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useLocalMcpStore } from '../../store/useLocalMcpStore';
import { useToastStore } from '../../store/useToastStore';
import { McpConfigurationModal } from './McpConfigurationModal';

const localErrorTranslationKeys: Record<string, string> = {
  INITIALIZATION_FAILED: 'profile.mcp.localErrors.initializationFailed',
  INVALID_PORT: 'profile.mcp.localErrors.invalidPort',
  INVALID_STATE: 'profile.mcp.localErrors.invalidState',
  PORT_UNAVAILABLE: 'profile.mcp.localErrors.portUnavailable',
  RENDERER_NOT_READY: 'profile.mcp.localErrors.rendererNotReady',
  SERVER_STOPPED: 'profile.mcp.localErrors.serverStopped',
};

export function McpProfileSection() {
  const { t } = useI18n();
  const connection = useLocalMcpStore((state) => state.connection);
  const action = useLocalMcpStore((state) => state.action);
  const start = useLocalMcpStore((state) => state.start);
  const stop = useLocalMcpStore((state) => state.stop);
  const pushToast = useToastStore((state) => state.pushToast);
  const [configurationOpen, setConfigurationOpen] = useState(false);

  const serverRunning = connection.state === 'running';
  const online = serverRunning && connection.rendererReady;
  const transitioning =
    connection.state === 'starting' ||
    connection.state === 'stopping' ||
    action !== null;
  const displayedState =
    serverRunning && !connection.rendererReady ? 'stopped' : connection.state;
  const errorMessageKey = connection.errorCode
    ? localErrorTranslationKeys[connection.errorCode]
    : undefined;

  async function run(actionToRun: () => Promise<void>) {
    try {
      await actionToRun();
    } catch {
      pushToast(t('profile.mcp.localActionFailed'), 'warning');
    }
  }

  function actionLabel() {
    if (connection.state === 'starting' || action === 'start') {
      return t('profile.mcp.startingServer');
    }
    if (connection.state === 'stopping' || action === 'stop') {
      return t('profile.mcp.stoppingServer');
    }
    if (serverRunning) {
      return t('profile.mcp.stopServer');
    }
    if (connection.state === 'error') {
      return t('profile.mcp.retryServer');
    }
    return t('profile.mcp.startServer');
  }

  const ActionIcon = transitioning ? Loader2 : serverRunning ? Square : Play;

  return (
    <section className="profile-section mcp-profile-section">
      <div className="profile-section-header mcp-profile-section__header">
        <h2 className="profile-section-title">{t('profile.mcp.title')}</h2>
        <span className={online ? 'mcp-status mcp-status--online' : 'mcp-status'}>
          <span className="mcp-status__dot" aria-hidden="true" />
          {t(`profile.mcp.localStates.${displayedState}`)}
        </span>
      </div>

      <div className="mcp-account-row">
        <Cable className="mcp-account-row__icon" aria-hidden="true" />
        <span>
          <span className="profile-row-label">{t('profile.mcp.localServer')}</span>
          <span className="profile-row-description mcp-account-email">{connection.url}</span>
        </span>
      </div>

      {connection.state === 'error' ? (
        <p className="mcp-error" role="status">
          {t(errorMessageKey ?? 'profile.mcp.localServerError')}
        </p>
      ) : null}

      <div className="mcp-local-actions">
        <button
          className="mcp-command-button"
          type="button"
          disabled={transitioning}
          onClick={() => void run(serverRunning ? stop : start)}
        >
          <ActionIcon
            className={transitioning ? 'mcp-command-button__spinner' : undefined}
          />
          <span>{actionLabel()}</span>
        </button>
        <button
          className="mcp-command-button"
          type="button"
          onClick={() => setConfigurationOpen(true)}
        >
          <Settings2 />
          <span>{t('profile.mcp.configureServer')}</span>
        </button>
      </div>

      <McpConfigurationModal
        open={configurationOpen}
        onClose={() => setConfigurationOpen(false)}
      />
    </section>
  );
}
