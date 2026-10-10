/**
 * SignFlow WebSocket Client
 * Manages streaming connection with the FastAPI Python CV inference service
 */

import { FramePayload, PredictionEvent } from '@/types/contract';
import { CONFIG } from './config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export class SignFlowWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private onPredictionCallback?: (event: PredictionEvent) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;

  constructor(url: string = CONFIG.WS_URL) {
    this.url = url;
  }

  public connect(
    onPrediction: (event: PredictionEvent) => void,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.onPredictionCallback = onPrediction;
    this.onStatusChangeCallback = onStatusChange;
    this.shouldReconnect = true;

    this.initSocket();
  }

  private initSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.onStatusChangeCallback?.('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to SignFlow CV inference service at', this.url);
        this.onStatusChangeCallback?.('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const prediction: PredictionEvent = JSON.parse(event.data);
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

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect to CV service...');
      this.initSocket();
    }, 2000);
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

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChangeCallback?.('disconnected');
  }
}
