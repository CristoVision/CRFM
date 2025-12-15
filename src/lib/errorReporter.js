export function reportClientError(detail) {
  try {
    if (typeof window !== 'undefined') {
      const payload = {
        message: detail?.message || 'Unknown error',
        source: detail?.source || 'client',
        context: detail?.context,
        stack: detail?.stack,
        timestamp: Date.now(),
      };
      window.dispatchEvent(new CustomEvent('crfm-error', { detail: payload }));
    }
  } catch (err) {
    console.error('Failed to dispatch client error', err, detail);
  }
}
