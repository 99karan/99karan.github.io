import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * WebGL can be unavailable (old GPUs, blocklisted drivers, hardened browsers).
 * The DOM layer already carries every word of the portfolio, so the honest
 * fallback is simply to drop the canvas and let the content stand on its own.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D scene disabled:', error.message, info.componentStack);
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
