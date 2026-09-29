/**
 * RULE 1 (mandatory): No-screenshot policy.
 *
 * Runtime guard that makes it impossible for the application (or any script
 * running inside it) to capture the rendered frame:
 *  - HTMLCanvasElement.toDataURL / toBlob are blocked
 *  - navigator.mediaDevices.getDisplayMedia (screen capture) is blocked
 *
 * Tooling rule (enforced outside the app): agent/test loops must never call
 * screenshot actions (e.g. browser screenshot tools). Validation is done via
 * console output and JS evaluation only.
 */
export function installScreenshotGuard(): void {
  const warn = (what: string): void => {
    console.warn(`[ScreenshotGuard] Blocked ${what} — no-screenshot policy (Cats of Purfection Double Felix 3D)`);
  };

  const blockCanvasMethod = (name: 'toDataURL' | 'toBlob'): void => {
    Object.defineProperty(HTMLCanvasElement.prototype, name, {
      configurable: true,
      writable: true,
      value: function (this: HTMLCanvasElement): unknown {
        warn(`canvas.${name}()`);
        return name === 'toDataURL' ? 'data:,' : null;
      }
    });
  };

  blockCanvasMethod('toDataURL');
  blockCanvasMethod('toBlob');

  if (typeof navigator !== 'undefined' && navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
    const mediaDevices = navigator.mediaDevices as MediaDevices & { getDisplayMedia: unknown };
    mediaDevices.getDisplayMedia = (): Promise<MediaStream> => {
      warn('navigator.mediaDevices.getDisplayMedia()');
      return Promise.reject(new Error('No-screenshot policy: screen capture is disabled'));
    };
  }

  console.info('[ScreenshotGuard] Active — canvas capture and screen capture are disabled.');
}
