import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { getBridgeDefaults, routeApiRequest } from '../server/apiBridge.js';

function attachMiddleware(server: ViteDevServer | PreviewServer): void {
  const bridgeOptions = getBridgeDefaults();
  server.middlewares.use((req, res, next) => {
    void routeApiRequest(req, res, next, bridgeOptions);
  });
}

export function pythonSidecarBridge(): Plugin {
  return {
    name: 'python-sidecar-bridge',
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}
