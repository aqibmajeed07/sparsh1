/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — CLIENT INTEGRATION LAYER            ║
 * ║        Multi-Transport Manager: Bluetooth BLE, Wi-Fi, USB Serial    ║
 * ║        + Full Hardware Simulator & Interactive Diagnostics          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export type GloveTransport = 'ble' | 'serial' | 'wifi' | 'simulator' | 'none';
export type GloveStatus = 'disconnected' | 'connecting' | 'connected' | 'simulated' | 'error';

export interface FingerTelemetry {
  raw: number;         // Raw ADC count (0..4095)
  normalized: number;  // 0.00 (straight) to 1.00 (curled/bent)
  percentage: number;  // 0% to 100%
  straightVal: number; // Calibration baseline
  bentVal: number;     // Calibration baseline
  inverted: boolean;   // True if bentVal < straightVal
  state: 'straight' | 'partial' | 'bent';
}

export interface GloveTelemetry {
  seq: number;
  timestamp: number;
  transport: GloveTransport;
  calibrated: boolean;
  sampleRateHz: number;
  fingers: {
    thumb: FingerTelemetry;
    index: FingerTelemetry;
    middle: FingerTelemetry;
    ring: FingerTelemetry;
    little: FingerTelemetry;
  };
  vector: [number, number, number, number, number]; // [thumb, index, middle, ring, little] normalized
}

export interface GloveCalibrationConfig {
  straight: [number, number, number, number, number];
  bent: [number, number, number, number, number];
  inverted: [boolean, boolean, boolean, boolean, boolean];
  calibrated: boolean;
  updatedAt: string;
}

// ─── Nordic UART Service UUIDs for Web Bluetooth ─────────────────────────────
const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify from ESP32
const BLE_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to ESP32

const STORAGE_CAL_KEY = 'sparsh_smart_glove_calibration_v1';

class SmartGlovesManager {
  public status: GloveStatus = 'disconnected';
  public transport: GloveTransport = 'none';

  // Bluetooth Objects
  private bleDevice: any = null;
  private bleServer: any = null;
  private bleTxChar: any = null;
  private bleRxChar: any = null;

  // Web Serial Objects
  private serialPort: any = null;
  private serialReader: ReadableStreamDefaultReader | null = null;
  private serialReading: boolean = false;

  // WebSocket Objects
  private ws: WebSocket | null = null;

  // Simulator State (calibrated for low-range sensors: <100 to 200)
  private simulatorTimer: any = null;
  private simRaw: [number, number, number, number, number] = [75, 70, 78, 72, 70];

  // Calibration Profile: default baseline <100 (70) to 200 for low-voltage flex sensors
  public calibration: GloveCalibrationConfig = {
    straight: [70, 70, 70, 70, 70],
    bent:     [200, 200, 200, 200, 200],
    inverted: [false, false, false, false, false],
    calibrated: false,
    updatedAt: new Date().toISOString()
  };

  // Telemetry Metrics
  private lastPacketTime = 0;
  private sampleCounter = 0;
  private sampleRateHz = 0;
  private sampleRateCalcTimer: any = null;

  // Event Listeners
  private telemetryListeners: Set<(t: GloveTelemetry) => void> = new Set();
  private statusListeners: Set<(s: GloveStatus, t: GloveTransport) => void> = new Set();
  private logListeners: Set<(msg: string) => void> = new Set();
  private scanListeners: Set<(mv: Record<number, number>) => void> = new Set();

  // Hardware pin definitions matching firmware v2 (ESP32 DevKit V1)
  public static readonly PINS = {
    thumb: 36,   // ADC1_CH0
    index: 39,   // ADC1_CH3
    middle: 34,  // ADC1_CH6
    ring: 35,    // ADC1_CH7
    little: 32,  // ADC1_CH4
  };
  public static readonly SCAN_PINS = [32, 33, 34, 35, 36, 39];

  constructor() {
    this.loadCalibration();
    // Start 1-second sample rate estimator
    if (typeof window !== 'undefined') {
      this.sampleRateCalcTimer = setInterval(() => {
        this.sampleRateHz = this.sampleCounter;
        this.sampleCounter = 0;
      }, 1000);
    }
  }

  // ─── Event Subscriptions ───────────────────────────────────────────────────
  public onTelemetry(cb: (t: GloveTelemetry) => void) {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  public onStatus(cb: (s: GloveStatus, t: GloveTransport) => void) {
    this.statusListeners.add(cb);
    cb(this.status, this.transport);
    return () => this.statusListeners.delete(cb);
  }

  public onLog(cb: (msg: string) => void) {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  public onScan(cb: (mv: Record<number, number>) => void) {
    this.scanListeners.add(cb);
    return () => this.scanListeners.delete(cb);
  }

  private setStatus(status: GloveStatus, transport: GloveTransport) {
    this.status = status;
    this.transport = transport;
    this.statusListeners.forEach(cb => cb(status, transport));
  }

  private log(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    this.logListeners.forEach(cb => cb(entry));
  }

  // ─── Capability Checks ─────────────────────────────────────────────────────
  public get isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public get isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in (navigator as any);
  }

  // ─── Transport 1: Web Bluetooth (BLE) ──────────────────────────────────────
  public async connectBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported) {
      this.log('❌ Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      this.setStatus('error', 'none');
      return false;
    }

    try {
      this.disconnect();
      this.setStatus('connecting', 'ble');
      this.log('🔍 Scanning for Sparsh Smart Glove via Bluetooth BLE...');

      this.bleDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'Sparsh' }],
        optionalServices: [BLE_SERVICE_UUID]
      });

      this.bleDevice.addEventListener('gattserverdisconnected', () => {
        this.log('🔌 Bluetooth device disconnected.');
        this.setStatus('disconnected', 'none');
      });

      this.log(`🔗 Connecting to GATT Server on ${this.bleDevice.name || 'Glove'}...`);
      this.bleServer = await this.bleDevice.gatt.connect();

      const service = await this.bleServer.getPrimaryService(BLE_SERVICE_UUID);
      this.bleTxChar = await service.getCharacteristic(BLE_TX_CHAR_UUID);
      this.bleRxChar = await service.getCharacteristic(BLE_RX_CHAR_UUID);

      await this.bleTxChar.startNotifications();
      let streamBuffer = '';

      this.bleTxChar.addEventListener('characteristicvaluechanged', (ev: any) => {
        const decoder = new TextDecoder();
        const chunk = decoder.decode(ev.target.value);
        streamBuffer += chunk;

        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          this.parseJsonTelemetry(line.trim(), 'ble');
        }
      });

      this.log('✅ Connected to Sparsh Smart Glove via Bluetooth BLE!');
      this.setStatus('connected', 'ble');
      return true;
    } catch (err: any) {
      this.log(`❌ Bluetooth connection failed: ${err.message || err}`);
      this.setStatus('error', 'none');
      return false;
    }
  }

  // ─── Transport 2: Web Serial (USB) ─────────────────────────────────────────
  public async connectSerial(baudRate = 115200): Promise<boolean> {
    if (!this.isSerialSupported) {
      this.log('❌ Web Serial API not supported in this browser.');
      this.setStatus('error', 'none');
      return false;
    }

    try {
      this.disconnect();
      this.setStatus('connecting', 'serial');
      this.log('🔌 Requesting USB Serial Port (115200 baud)...');

      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ baudRate });

      this.log('✅ USB Serial Port opened. Listening for 5-finger telemetry...');
      this.setStatus('connected', 'serial');
      this.serialReading = true;

      const decoder = new TextDecoderStream();
      this.serialPort.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      this.serialReader = reader;

      let lineBuffer = '';
      (async () => {
        while (this.serialReading) {
          try {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              lineBuffer += value;
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop() || '';
              for (const line of lines) {
                this.parseJsonTelemetry(line.trim(), 'serial');
              }
            }
          } catch (e) {
            break;
          }
        }
      })();

      return true;
    } catch (err: any) {
      this.log(`❌ Serial connection error: ${err.message || err}`);
      this.setStatus('error', 'none');
      return false;
    }
  }

  // ─── Transport 3: Wi-Fi (WebSocket to Backend) ─────────────────────────────
  public async connectWiFi(host = '127.0.0.1:8000'): Promise<boolean> {
    try {
      this.disconnect();
      this.setStatus('connecting', 'wifi');
      this.log(`🌐 Connecting to Smart Glove Wi-Fi WebSocket (ws://${host}/ws/smart-gloves)...`);

      this.ws = new WebSocket(`ws://${host}/ws/smart-gloves`);

      this.ws.onopen = () => {
        this.log('✅ Connected to Smart Glove stream via Wi-Fi!');
        this.setStatus('connected', 'wifi');
      };

      this.ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.type === 'SENSOR_TELEMETRY' && payload.data) {
            this.handleTelemetryObject(payload.data, 'wifi');
          } else if (payload.type === 'sensor_data') {
            this.handleTelemetryObject(payload, 'wifi');
          }
        } catch (_) {}
      };

      this.ws.onerror = (e) => {
        this.log('⚠️ Wi-Fi WebSocket notice: Check backend connectivity.');
      };

      this.ws.onclose = () => {
        if (this.transport === 'wifi') {
          this.log('🔌 Wi-Fi stream closed.');
          this.setStatus('disconnected', 'none');
        }
      };

      return true;
    } catch (err: any) {
      this.log(`❌ Wi-Fi stream failed: ${err.message || err}`);
      this.setStatus('error', 'none');
      return false;
    }
  }

  // ─── Transport 4: Interactive Hardware Simulator ───────────────────────────
  public startSimulator() {
    this.disconnect();
    this.log('🧪 Starting Interactive Smart Glove Simulator (Labeled Demo Mode)...');
    this.setStatus('simulated', 'simulator');

    let seq = 1;
    // Clamp to the real 12-bit ADC range so low values (70–200) stay low
    const clamp = (v: number) => Math.max(0, Math.min(4095, v));
    const noise = () => Math.round((Math.random() - 0.5) * 6); // ±3 counts

    this.simulatorTimer = setInterval(() => {
      seq++;
      const raw = this.simRaw.map(v => clamp(v + noise())) as [number, number, number, number, number];
      this.processRawReadings(raw, seq, 'simulator');
    }, 40); // 25 Hz
  }

  public setSimulatorFinger(fingerIdx: 0 | 1 | 2 | 3 | 4, normalizedValue: number) {
    const val = Math.max(0, Math.min(1, normalizedValue));
    const s = this.calibration.straight[fingerIdx];
    const b = this.calibration.bent[fingerIdx];
    this.simRaw[fingerIdx] = Math.round(s + val * (b - s));
  }

  public setSimulatorPreset(preset: 'open' | 'fist' | 'peace' | 'ok' | 'iloveyou' | 'point' | 'water' | 'thumbsup' | 'help') {
    switch (preset) {
      case 'open':
        this.setSimulatorVector([0.0, 0.0, 0.0, 0.0, 0.0]); // All straight: Hello / Open Palm
        break;
      case 'fist':
        this.setSimulatorVector([1.0, 1.0, 1.0, 1.0, 1.0]); // All bent: Closed Fist / Yes
        break;
      case 'thumbsup':
      case 'help':
        this.setSimulatorVector([0.0, 1.0, 1.0, 1.0, 1.0]); // Thumb upright, rest bent: Thumbs Up / Help
        break;
      case 'point':
        this.setSimulatorVector([1.0, 0.0, 1.0, 1.0, 1.0]); // Index extended: Point / Look
        break;
      case 'peace':
        this.setSimulatorVector([1.0, 0.0, 0.0, 1.0, 1.0]); // Index & Middle extended: Peace / Two
        break;
      case 'water':
        this.setSimulatorVector([1.0, 0.0, 0.0, 0.0, 1.0]); // 3 middle extended: Water / W
        break;
      case 'iloveyou':
        this.setSimulatorVector([0.0, 0.0, 1.0, 1.0, 0.0]); // Thumb, Index, Pinky extended: ILY
        break;
      case 'ok':
        this.setSimulatorVector([0.9, 0.9, 0.0, 0.0, 0.0]);
        break;
    }
  }

  // Auto-cycles through the 6 major signs so student immediately sees gestures even if physical glove isn't bending
  public startDemoCycle(intervalMs = 3000) {
    this.startSimulator();
    const demoPresets: Array<'open' | 'thumbsup' | 'point' | 'peace' | 'water' | 'iloveyou' | 'fist'> = [
      'open',
      'thumbsup',
      'point',
      'peace',
      'water',
      'iloveyou',
      'fist',
    ];
    let idx = 0;
    this.setSimulatorPreset(demoPresets[0]);

    if ((this as any).demoCycleTimer) {
      clearInterval((this as any).demoCycleTimer);
    }
    (this as any).demoCycleTimer = setInterval(() => {
      idx = (idx + 1) % demoPresets.length;
      this.setSimulatorPreset(demoPresets[idx]);
      this.log(`✨ Demonstrating gesture: ${demoPresets[idx].toUpperCase()}`);
    }, intervalMs);
  }

  public setSimulatorVector(vec: [number, number, number, number, number]) {
    for (let i = 0; i < 5; i++) {
      this.setSimulatorFinger(i as any, vec[i]);
    }
  }

  // ─── Disconnect All Transports ─────────────────────────────────────────────
  public disconnect() {
    if (this.simulatorTimer) {
      clearInterval(this.simulatorTimer);
      this.simulatorTimer = null;
    }
    if ((this as any).demoCycleTimer) {
      clearInterval((this as any).demoCycleTimer);
      (this as any).demoCycleTimer = null;
    }

    if (this.bleDevice && this.bleDevice.gatt && this.bleDevice.gatt.connected) {
      this.bleDevice.gatt.disconnect();
    }
    this.bleDevice = null;
    this.bleServer = null;
    this.bleTxChar = null;
    this.bleRxChar = null;

    if (this.serialReader) {
      this.serialReading = false;
      this.serialReader.cancel().catch(() => {});
      this.serialReader = null;
    }
    if (this.serialPort) {
      this.serialPort.close().catch(() => {});
      this.serialPort = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected', 'none');
    this.log('🔌 Disconnected all Smart Glove interfaces.');
  }

  // ─── Command Transmission ──────────────────────────────────────────────────
  public async sendCommand(cmd: string): Promise<boolean> {
    const commandLine = cmd.endsWith('\n') ? cmd : cmd + '\n';
    this.log(`📤 Sending command: ${cmd}`);

    // Via Bluetooth BLE
    if (this.transport === 'ble' && this.bleRxChar) {
      try {
        const encoder = new TextEncoder();
        await this.bleRxChar.writeValue(encoder.encode(commandLine));
        return true;
      } catch (e: any) {
        this.log(`⚠️ BLE command send error: ${e.message}`);
      }
    }

    // Via USB Serial
    if (this.transport === 'serial' && this.serialPort && this.serialPort.writable) {
      try {
        const writer = this.serialPort.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(commandLine));
        writer.releaseLock();
        return true;
      } catch (e: any) {
        this.log(`⚠️ Serial command send error: ${e.message}`);
      }
    }

    // Via Simulator
    if (this.transport === 'simulator') {
      const upper = cmd.trim().toUpperCase();
      if (upper === 'PING') {
        this.log('ℹ️ [Firmware] PONG');
      } else if (upper === 'STATUS') {
        this.log(`ℹ️ [Firmware] seq=128 ble=simulated rate=25Hz`);
      } else if (upper === 'SCAN') {
        this.log('ℹ️ [Firmware] SCAN on: bend one finger at a time');
        const mockMv = { 32: 120, 33: 135, 34: 150, 35: 110, 36: 140, 39: 130 };
        this.scanListeners.forEach(cb => cb(mockMv));
      } else {
        this.log(`🧪 Simulator acknowledged: ${cmd}`);
      }
      return true;
    }

    return false;
  }

  // ─── High-Level Hardware Firmware v2 Commands ──────────────────────────────
  public async ping(): Promise<boolean> {
    return this.sendCommand('PING');
  }

  public async requestStatus(): Promise<boolean> {
    return this.sendCommand('STATUS');
  }

  public async toggleScan(): Promise<boolean> {
    return this.sendCommand('SCAN');
  }

  // ─── Calibration Management ────────────────────────────────────────────────
  public loadCalibration() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_CAL_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.straight && parsed.bent) {
          // Auto-migrate stale high-range calibration (1000/2200) to low-range (<100 to 200)
          if (parsed.straight[0] >= 500) {
            this.saveCalibration({
              straight: [70, 70, 70, 70, 70],
              bent: [200, 200, 200, 200, 200],
              inverted: [false, false, false, false, false],
              calibrated: true,
              updatedAt: new Date().toISOString()
            });
            return;
          }
          this.calibration = parsed;
        }
      }
    } catch (_) {}
  }

  public saveCalibration(config: GloveCalibrationConfig) {
    this.calibration = config;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CAL_KEY, JSON.stringify(config));
    }
    // Also sync to backend API
    fetch('/api/smart-gloves/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thumb:  { straightVal: config.straight[0], bentVal: config.bent[0], inverted: config.inverted[0] },
        index:  { straightVal: config.straight[1], bentVal: config.bent[1], inverted: config.inverted[1] },
        middle: { straightVal: config.straight[2], bentVal: config.bent[2], inverted: config.inverted[2] },
        ring:   { straightVal: config.straight[3], bentVal: config.bent[3], inverted: config.inverted[3] },
        little: { straightVal: config.straight[4], bentVal: config.bent[4], inverted: config.inverted[4] },
      })
    }).catch(() => {});
  }

  // ─── Normalization Algorithm ───────────────────────────────────────────────
  public normalizeRaw(fingerIdx: number, raw: number): number {
    const s = this.calibration.straight[fingerIdx] ?? 70;
    const b = this.calibration.bent[fingerIdx] ?? 200;
    const inv = this.calibration.inverted[fingerIdx] ?? false;

    let norm = 0.0;
    if (!inv) {
      if (raw <= s) norm = 0.0;
      else if (raw >= b) norm = 1.0;
      else norm = (raw - s) / Math.max(1, (b - s));
    } else {
      // Inverted polarity: lower ADC value indicates greater bend
      if (raw >= s) norm = 0.0;
      else if (raw <= b) norm = 1.0;
      else norm = (s - raw) / Math.max(1, (s - b));
    }

    return Math.max(0.0, Math.min(1.0, norm));
  }

  // ─── Telemetry Parsing & Distribution ──────────────────────────────────────
  private parseJsonTelemetry(jsonString: string, transport: GloveTransport) {
    const trimmed = jsonString.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return;
    try {
      const data = JSON.parse(trimmed);
      if (data.type === 'sensor_data' || (data.thumb !== undefined && data.index !== undefined)) {
        this.handleTelemetryObject(data, transport);
      } else if (data.type === 'info') {
        const msg = String(data.msg || '');
        this.log(`ℹ️ [Firmware] ${msg}`);
        // Handle SCAN response format: "mV 32:150 33:200 34:180 35:90 36:80 39:75"
        if (msg.startsWith('mV')) {
          const parts = msg.trim().split(/\s+/).slice(1);
          const mvMap: Record<number, number> = {};
          for (const p of parts) {
            const [pinStr, valStr] = p.split(':');
            if (pinStr && valStr) {
              mvMap[parseInt(pinStr, 10)] = parseInt(valStr, 10);
            }
          }
          this.scanListeners.forEach(cb => cb(mvMap));
        }
      }
    } catch (_) {}
  }

  private handleTelemetryObject(data: any, transport: GloveTransport) {
    const raw: [number, number, number, number, number] = [
      Number(data.thumb ?? 0),
      Number(data.index ?? 0),
      Number(data.middle ?? 0),
      Number(data.ring ?? 0),
      Number(data.little ?? data.pinky ?? 0),
    ];
    const seq = Number(data.seq ?? 0);
    this.processRawReadings(raw, seq, transport);
  }

  private processRawReadings(raw: [number, number, number, number, number], seq: number, transport: GloveTransport) {
    this.sampleCounter++;
    const now = Date.now();
    this.lastPacketTime = now;

    const norm: [number, number, number, number, number] = [
      this.normalizeRaw(0, raw[0]),
      this.normalizeRaw(1, raw[1]),
      this.normalizeRaw(2, raw[2]),
      this.normalizeRaw(3, raw[3]),
      this.normalizeRaw(4, raw[4]),
    ];

    const fingerState = (n: number): 'straight' | 'partial' | 'bent' => {
      if (n < 0.25) return 'straight';
      if (n > 0.70) return 'bent';
      return 'partial';
    };

    const telemetry: GloveTelemetry = {
      seq,
      timestamp: now,
      transport,
      calibrated: this.calibration.calibrated,
      sampleRateHz: this.sampleRateHz || (transport === 'simulator' ? 25 : 40),
      vector: norm,
      fingers: {
        thumb: {
          raw: raw[0],
          normalized: norm[0],
          percentage: Math.round(norm[0] * 100),
          straightVal: this.calibration.straight[0],
          bentVal: this.calibration.bent[0],
          inverted: this.calibration.inverted[0],
          state: fingerState(norm[0]),
        },
        index: {
          raw: raw[1],
          normalized: norm[1],
          percentage: Math.round(norm[1] * 100),
          straightVal: this.calibration.straight[1],
          bentVal: this.calibration.bent[1],
          inverted: this.calibration.inverted[1],
          state: fingerState(norm[1]),
        },
        middle: {
          raw: raw[2],
          normalized: norm[2],
          percentage: Math.round(norm[2] * 100),
          straightVal: this.calibration.straight[2],
          bentVal: this.calibration.bent[2],
          inverted: this.calibration.inverted[2],
          state: fingerState(norm[2]),
        },
        ring: {
          raw: raw[3],
          normalized: norm[3],
          percentage: Math.round(norm[3] * 100),
          straightVal: this.calibration.straight[3],
          bentVal: this.calibration.bent[3],
          inverted: this.calibration.inverted[3],
          state: fingerState(norm[3]),
        },
        little: {
          raw: raw[4],
          normalized: norm[4],
          percentage: Math.round(norm[4] * 100),
          straightVal: this.calibration.straight[4],
          bentVal: this.calibration.bent[4],
          inverted: this.calibration.inverted[4],
          state: fingerState(norm[4]),
        },
      }
    };

    this.telemetryListeners.forEach(cb => cb(telemetry));
  }
}

export const smartGloves = new SmartGlovesManager();
