import { Copy, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  MAX_LOCAL_MCP_PORT,
  MIN_LOCAL_MCP_PORT,
  isValidLocalMcpPort,
  localMcpUrl,
} from '../../core/services/mcpLocalServer';
import { useI18n } from '../../i18n/I18nProvider';
import { useLocalMcpStore } from '../../store/useLocalMcpStore';
import { useToastStore } from '../../store/useToastStore';

export function McpConfigurationModal({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const connection = useLocalMcpStore((state) => state.connection);
  const configuredPort = useLocalMcpStore((state) => state.port);
  const setPort = useLocalMcpStore((state) => state.setPort);
  const pushToast = useToastStore((state) => state.pushToast);
  const [portInput, setPortInput] = useState(String(configuredPort));
  const [savingPort, setSavingPort] = useState(false);
  const port = connection.port ?? configuredPort;
  const url = connection.url ?? localMcpUrl(port);
  const online = connection.state === 'running' && connection.rendererReady;
  const portEditable = connection.state === 'stopped' || connection.state === 'error';
  const parsedPort = Number(portInput);
  const portValid = portInput.trim() !== '' && isValidLocalMcpPort(parsedPort);
  const portChanged = portInput !== String(configuredPort);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      setPortInput(String(configuredPort));
    }
  }, [configuredPort, open]);

  if (!open) {
    return null;
  }

  const configuration = [
    'Name: NoteX',
    'Transport: Streamable HTTP',
    `URL: ${url}`,
    'Authentication: None (local server)',
  ].join('\n');

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(successMessage, 'success');
    } catch {
      pushToast(t('profile.mcp.configuration.copyFailed'), 'warning');
    }
  }

  async function savePort() {
    if (!portValid) {
      pushToast(t('profile.mcp.configuration.invalidPort'), 'warning');
      return;
    }

    setSavingPort(true);
    try {
      await setPort(parsedPort);
      pushToast(t('profile.mcp.configuration.portSaved'), 'success');
    } catch {
      pushToast(t('profile.mcp.configuration.portSaveFailed'), 'warning');
    } finally {
      setSavingPort(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal mcp-configuration-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-configuration-title"
      >
        <header className="mcp-configuration-modal__header">
          <h2 id="mcp-configuration-title">{t('profile.mcp.configuration.title')}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <dl className="mcp-configuration-list">
          <ConfigurationRow label={t('profile.mcp.configuration.name')} value="NoteX" />
          <ConfigurationRow
            label={t('profile.mcp.configuration.transport')}
            value="Streamable HTTP"
          />
          <div className="mcp-configuration-list__row">
            <dt>{t('profile.mcp.configuration.url')}</dt>
            <dd className="mcp-configuration-url">
              <code title={url}>{url}</code>
              <button
                className="icon-button mcp-configuration-copy-url"
                type="button"
                aria-label={t('profile.mcp.configuration.copyUrl')}
                title={t('profile.mcp.configuration.copyUrl')}
                onClick={() =>
                  void copyToClipboard(url, t('profile.mcp.configuration.urlCopied'))
                }
              >
                <Copy />
              </button>
            </dd>
          </div>
          <div className="mcp-configuration-list__row">
            <dt>{t('profile.mcp.configuration.port')}</dt>
            <dd className="mcp-configuration-port">
              <input
                type="number"
                min={MIN_LOCAL_MCP_PORT}
                max={MAX_LOCAL_MCP_PORT}
                step="1"
                value={portInput}
                disabled={!portEditable || savingPort}
                aria-invalid={!portValid}
                aria-label={t('profile.mcp.configuration.port')}
                onChange={(event) => setPortInput(event.target.value)}
              />
              <button
                className="icon-button mcp-configuration-save-port"
                type="button"
                disabled={!portEditable || savingPort || !portChanged}
                aria-label={t('profile.mcp.configuration.savePort')}
                title={
                  portEditable
                    ? t('profile.mcp.configuration.savePort')
                    : t('profile.mcp.configuration.stopToEditPort')
                }
                onClick={() => void savePort()}
              >
                <Save />
              </button>
            </dd>
          </div>
          <ConfigurationRow
            label={t('profile.mcp.configuration.authentication')}
            value={t('profile.mcp.configuration.authenticationNone')}
          />
          <div className="mcp-configuration-list__row">
            <dt>{t('profile.mcp.configuration.status')}</dt>
            <dd>
              <span className={online ? 'mcp-status mcp-status--online' : 'mcp-status'}>
                <span className="mcp-status__dot" aria-hidden="true" />
                {t(online ? 'profile.mcp.online' : 'profile.mcp.offline')}
              </span>
            </dd>
          </div>
        </dl>

        <div className="choice-modal-actions">
          <button
            type="button"
            onClick={() =>
              void copyToClipboard(
                configuration,
                t('profile.mcp.configuration.configurationCopied'),
              )
            }
          >
            <Copy />
            <span>{t('profile.mcp.configuration.copyConfiguration')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfigurationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mcp-configuration-list__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
