/**
 * SignFlow WebSocket Client
 * Manages streaming connection with the FastAPI Python CV inference service
 * with strict session-level isolation, stale message filtering, and clean disconnection.
 */

import { FramePayload, PredictionEvent } from '@/types/contract';
import { CONFIG } from './config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export class SignFlowWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private retryCount = 0;
  private maxRetries = 2;
  private onPredictionCallback?: (event: PredictionEvent) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;
  private activeSessionId: string | null = null;

  constructor(url?: string) {
    this.url = url || '';
  }

  public setUrl(newUrl: string) {
    this.url = newUrl;
    this.retryCount = 0;
    if (this.ws) {
      this.disconnect();
      this.shouldReconnect = true;
      this.initSocket();
    }
  }

  public getUrl(): string {
    return this.url || CONFIG.WS_URL;
  }

  public setActiveSessionId(sessionId: string | null) {
    this.activeSessionId = sessionId;
  }

  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  public connect(
    onPrediction: (event: PredictionEvent) => void,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.onPredictionCallback = onPrediction;
    this.onStatusChangeCallback = onStatusChange;
    this.shouldReconnect = true;
    this.retryCount = 0;

    this.initSocket();
  }

  private initSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const targetUrl = this.url || CONFIG.WS_URL;
    // Only notify "connecting" on the first attempt so fallback UI doesn't flicker
    if (this.retryCount === 0) {
      this.onStatusChangeCallback?.('connecting');
    }

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        console.log('Connected to SignFlow CV inference service at', targetUrl);
        this.retryCount = 0;
        this.onStatusChangeCallback?.('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const prediction: PredictionEvent = JSON.parse(event.data);

          // Stale event filtering: reject predictions belonging to mismatched/ended sessions
          if (
            this.activeSessionId &&
            prediction.session_id &&
            prediction.session_id !== this.activeSessionId
          ) {
            console.warn(
              `[SignFlowWebSocketClient] Discarded stale prediction for session "${prediction.session_id}" (active: "${this.activeSessionId}")`
            );
            return;
          }

          this.onPredictionCallback?.(prediction);
        } catch (err) {
          console.error('Failed to parse prediction message:', err);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChangeCallback?.('disconnected');
        this.cleanupAndReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        this.onStatusChangeCallback?.('disconnected');
      };
    } catch (err) {
      console.warn('Failed to construct WebSocket:', err);
      this.onStatusChangeCallback?.('disconnected');
      this.cleanupAndReconnect();
    }
  }

  private cleanupAndReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.shouldReconnect) return;

    if (this.retryCount >= this.maxRetries) {
      this.shouldReconnect = false;
      console.info(
        '[SignFlow] Remote CV service not reachable after retry attempts. Remaining smoothly on in-browser AI engine.'
      );
      return;
    }

    this.retryCount++;
    this.reconnectTimer = setTimeout(() => {
      this.initSocket();
    }, 2500);
  }

  public sendFrame(payload: FramePayload): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.error('Failed to send frame payload:', err);
      }
    }
    return false;
  }

  public sendReset(sessionId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'reset',
            session_id: sessionId,
            timestamp: Date.now(),
          })
        );
        return true;
      } catch (err) {
        console.error('Failed to send reset payload:', err);
      }
    }
    return false;
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.activeSessionId = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Detach all event listeners immediately to prevent queued messages from invoking callbacks
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      try {
        this.ws.close();
      } catch (e) {
        // Safe to ignore if already closing
      }
      this.ws = null;
    }

    this.onStatusChangeCallback?.('disconnected');
  }
}
