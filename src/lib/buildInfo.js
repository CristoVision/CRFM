export const buildInfo = {
  version: import.meta.env.VITE_APP_VERSION || '0.0.0',
  sha: import.meta.env.VITE_BUILD_SHA || 'dev',
  time: import.meta.env.VITE_BUILD_TIME || null
};

export function formatBuildLabel(info = buildInfo) {
  const versionPart = info.version ? `v${info.version}` : 'v0.0.0';
  const shaPart = info.sha ? ` (${info.sha})` : '';
  return `${versionPart}${shaPart}`;
}

