// ─── SPARSH Smart Keyboard — Web Bluetooth + WebSerial Manager ─────────────────
// Communicates with ESP32 Smart Keyboard firmware via BLE UART or USB Serial.
//
// BLE  Service UUID:  6e400001-b5a3-f393-e0a9-e50e24dcca9e  (Nordic UART)
// BLE  TX (Notify):   6e400003-b5a3-f393-e0a9-e50e24dcca9e
// BLE  RX (Write):    6e400002-b5a3-f393-e0a9-e50e24dcca9e
//
// USB: 115200 baud, line-delimited text messages
//
// Message Protocol:
//   KEY:A | KEY:SPACE | KEY:ENTER
//   WORD:HELLO
//   LONG:A
//   STATUS:CONNECTED | STATUS:DISCONNECTED | STATUS:READY
//   MODE:BLE | MODE:USB

export type KeyboardConnectionType = 'ble' | 'usb' | 'none';
export type KeyboardStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface KeyboardEvent {
    type: 'KEY' | 'WORD' | 'LONG' | 'STATUS' | 'MODE';
    value: string;
    timestamp: number;
    connection: KeyboardConnectionType;
}

// ─── BLE UUIDs — Must match firmware ──────────────────────────────────────────
const KB_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const KB_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const KB_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// ─── Braille Lookup (for Learning Mode display) ──────────────────────────────
const BRAILLE_MAP: Record<string, string> = {
    A: '⠁', B: '⠃', C: '⠉', D: '⠙', E: '⠑', F: '⠋', G: '⠛', H: '⠓',
    I: '⠊', J: '⠚', K: '⠅', L: '⠇', M: '⠍', N: '⠝', O: '⠕', P: '⠏',
    Q: '⠟', R: '⠗', S: '⠎', T: '⠞', U: '⠥', V: '⠧', W: '⠺', X: '⠭',
    Y: '⠽', Z: '⠵', SPACE: '⠀', ENTER: '⏎',
};

// ─── Keyboard Manager Class ──────────────────────────────────────────────────
class SparshKeyboardManager {
    // Connection state
    private bleDevice: any = null;
    private bleServer: any = null;
    private bleTxChar: any = null;
    private bleRxChar: any = null;

    private serialPort: any = null;
    private serialReader: ReadableStreamDefaultReader | null = null;
    private serialReading: boolean = false;

    // Public state
    public status: KeyboardStatus = 'disconnected';
    public connectionType: KeyboardConnectionType = 'none';
    public typedText: string = '';
    public currentWord: string = '';
    public lastKey: string = '';
    public history: KeyboardEvent[] = [];

    // Listeners
    private statusListeners: Set<(s: KeyboardStatus) => void> = new Set();
    private keyListeners: Set<(e: KeyboardEvent) => void> = new Set();
    private logListeners: Set<(msg: string) => void> = new Set();
    private textListeners: Set<(text: string) => void> = new Set();

    private isListeningPhysical: boolean = false;

    // ── Subscriptions ──────────────────────────────────────────────────────────
    onStatus(cb: (s: KeyboardStatus) => void) {
        this.statusListeners.add(cb);
        return () => { this.statusListeners.delete(cb); };
    }
    onKey(cb: (e: KeyboardEvent) => void) {
        this.keyListeners.add(cb);
        return () => { this.keyListeners.delete(cb); };
    }
    onLog(cb: (msg: string) => void) {
        this.logListeners.add(cb);
        return () => { this.logListeners.delete(cb); };
    }
    onText(cb: (text: string) => void) {
        this.textListeners.add(cb);
        return () => { this.textListeners.delete(cb); };
    }

    // ── Automatic Physical / Bluetooth HID Keyboard Handler ─────────────────────
    public initPhysicalKeyboardListener() {
        if (typeof window === 'undefined' || this.isListeningPhysical) return;
        this.isListeningPhysical = true;

        window.addEventListener('keydown', (e: globalThis.KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            let keyLabel = '';
            if (e.key === ' ' || e.code === 'Space') {
                keyLabel = 'SPACE';
            } else if (e.key === 'Enter') {
                keyLabel = 'ENTER';
            } else if (e.key === 'Backspace') {
                keyLabel = 'BACKSPACE';
            } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                keyLabel = e.key.toUpperCase();
            }

            if (keyLabel) {
                const conn: KeyboardConnectionType = this.connectionType !== 'none' ? this.connectionType : 'usb';
                this.lastKey = keyLabel;
                this.handleKeyInput(keyLabel);
                this.emitKey({
                    type: 'KEY',
                    value: keyLabel,
                    timestamp: Date.now(),
                    connection: conn,
                });

                if (this.status === 'disconnected') {
                    this.connectionType = 'usb';
                    this.setStatus('connected');
                    this.addLog(`⌨️ Key press detected via OS Keyboard / Bluetooth HID (${keyLabel})`);
                }
            }
        });
        this.addLog('⌨️ Physical & Bluetooth HID keyboard input active');
    }

    private setStatus(s: KeyboardStatus) {
        this.status = s;
        this.statusListeners.forEach(cb => cb(s));
    }
    private addLog(msg: string) {
        const ts = new Date().toLocaleTimeString();
        this.logListeners.forEach(cb => cb(`[${ts}] ${msg}`));
    }
    private emitKey(ev: KeyboardEvent) {
        this.history.unshift(ev);
        if (this.history.length > 200) this.history.pop();
        this.keyListeners.forEach(cb => cb(ev));
    }
    private emitText() {
        this.textListeners.forEach(cb => cb(this.typedText));
    }

    // ── Browser capability checks ──────────────────────────────────────────────
    get isBluetoothSupported(): boolean {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }
    get isSerialSupported(): boolean {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    // ── Get Braille for a letter ───────────────────────────────────────────────
    getBraille(letter: string): string {
        return BRAILLE_MAP[letter.toUpperCase()] || '?';
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // BLE CONNECTION
    // ══════════════════════════════════════════════════════════════════════════════
    async connectBLE(): Promise<boolean> {
        if (!this.isBluetoothSupported) {
            this.addLog('❌ Web Bluetooth not supported. Use Chrome or Edge.');
            this.setStatus('error');
            return false;
        }

        try {
            this.setStatus('connecting');
            this.addLog('🔍 Searching for SPARSH Keyboard via BLE...');

            try {
                this.bleDevice = await (navigator as any).bluetooth.requestDevice({
                    filters: [
                        { name: 'SPARSH Keyboard' },
                        { namePrefix: 'SPARSH' },
                        { services: [KB_SERVICE_UUID] }
                    ],
                    optionalServices: [KB_SERVICE_UUID],
                });
            } catch (filterErr: any) {
                if (filterErr?.name === 'NotFoundError') throw filterErr;
                this.addLog('ℹ️ Specific BLE filter failed, opening generic device scanner...');
                this.bleDevice = await (navigator as any).bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [KB_SERVICE_UUID],
                });
            }

            this.addLog(`📡 Found: ${this.bleDevice.name || 'Bluetooth Device'} — connecting GATT...`);

            // Disconnect handler with auto-reconnect
            this.bleDevice.addEventListener('gattserverdisconnected', () => {
                this.addLog('📴 BLE disconnected');
                this.setStatus('disconnected');
                this.connectionType = 'none';
                this.bleServer = null;
                this.bleTxChar = null;
                this.bleRxChar = null;
                // Auto-reconnect after 2 seconds
                setTimeout(() => this.tryBLEReconnect(), 2000);
            });

            this.bleServer = await this.bleDevice.gatt!.connect();
            this.addLog('✅ GATT connected');

            const service = await this.bleServer.getPrimaryService(KB_SERVICE_UUID);
            this.addLog('✅ UART service discovered');

            // TX characteristic (notifications from keyboard)
            this.bleTxChar = await service.getCharacteristic(KB_TX_CHAR_UUID);
            await this.bleTxChar.startNotifications();
            this.bleTxChar.addEventListener('characteristicvaluechanged', (event: any) => {
                const raw = new TextDecoder().decode(event.target.value);
                this.parseMessage(raw, 'ble');
            });
            this.addLog('✅ TX notifications enabled');

            // RX characteristic (write to keyboard)
            try {
                this.bleRxChar = await service.getCharacteristic(KB_RX_CHAR_UUID);
                this.addLog('✅ RX write channel ready');
            } catch (_) {
                this.addLog('ℹ️ RX write channel not available');
            }

            this.connectionType = 'ble';
            this.setStatus('connected');
            this.addLog('🎉 SPARSH Keyboard connected via BLE!');
            return true;

        } catch (err: any) {
            if (err?.name === 'NotFoundError') {
                this.addLog('ℹ️ Pairing cancelled by user');
            } else {
                this.addLog(`❌ BLE error: ${err?.message ?? err}`);
            }
            this.setStatus('error');
            return false;
        }
    }

    private async tryBLEReconnect() {
        if (this.status !== 'disconnected' || !this.bleDevice) return;
        try {
            this.addLog('🔄 Attempting BLE auto-reconnect...');
            this.setStatus('connecting');
            this.bleServer = await this.bleDevice.gatt!.connect();
            const service = await this.bleServer.getPrimaryService(KB_SERVICE_UUID);
            this.bleTxChar = await service.getCharacteristic(KB_TX_CHAR_UUID);
            await this.bleTxChar.startNotifications();
            this.bleTxChar.addEventListener('characteristicvaluechanged', (event: any) => {
                const raw = new TextDecoder().decode(event.target.value);
                this.parseMessage(raw, 'ble');
            });
            this.connectionType = 'ble';
            this.setStatus('connected');
            this.addLog('✅ BLE auto-reconnected!');
        } catch (err: any) {
            this.addLog(`⚠️ Reconnect failed: ${err?.message ?? err}`);
            this.setStatus('disconnected');
            // Retry again after 5 seconds
            setTimeout(() => this.tryBLEReconnect(), 5000);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // USB SERIAL CONNECTION
    // ══════════════════════════════════════════════════════════════════════════════
    async connectUSB(): Promise<boolean> {
        if (!this.isSerialSupported) {
            this.addLog('❌ WebSerial not supported. Use Chrome or Edge.');
            this.setStatus('error');
            return false;
        }

        try {
            // Clean up previous serial connection state if present
            if (this.serialPort) {
                try {
                    this.serialReading = false;
                    if (this.serialReader) {
                        await this.serialReader.cancel().catch(() => { });
                        this.serialReader.releaseLock();
                    }
                    await this.serialPort.close().catch(() => { });
                } catch (_) { }
                this.serialPort = null;
                this.serialReader = null;
            }

            this.setStatus('connecting');
            this.addLog('🔌 Opening USB Serial port picker...');

            try {
                // Request port with broad filters including CP210x, CH340, FTDI, and native ESP32
                this.serialPort = await (navigator as any).serial.requestPort({
                    filters: [
                        { usbVendorId: 0x10C4 }, // Silicon Labs CP210x
                        { usbVendorId: 0x1A86 }, // QinHeng CH340 / CH341
                        { usbVendorId: 0x0403 }, // FTDI
                        { usbVendorId: 0x303A }, // Espressif native USB
                        { usbVendorId: 0x067B }, // Prolific PL2303
                    ]
                });
            } catch (filterErr: any) {
                if (filterErr?.name === 'NotFoundError') throw filterErr;
                this.addLog('ℹ️ Specific USB filter failed, opening generic COM port selector...');
                this.serialPort = await (navigator as any).serial.requestPort();
            }

            await this.serialPort.open({ baudRate: 115200 });
            this.addLog('✅ USB Serial port opened at 115200 baud');

            this.connectionType = 'usb';
            this.setStatus('connected');
            this.addLog('🎉 SPARSH Keyboard connected via USB!');

            // Start reading serial data
            this.readSerialLoop();
            return true;

        } catch (err: any) {
            if (err?.name === 'NotFoundError') {
                this.addLog('ℹ️ No USB device selected');
            } else if (err?.message?.includes('Failed to open serial port') || err?.name === 'InvalidStateError') {
                this.addLog('⚠️ COM Port is BUSY! Please close Arduino IDE Serial Monitor, PuTTY, or other apps using this COM port, then click Connect again.');
            } else {
                this.addLog(`❌ USB error: ${err?.message ?? err}`);
            }
            this.setStatus('error');
            return false;
        }
    }

    private async readSerialLoop() {
        if (!this.serialPort?.readable || this.serialReading) return;
        this.serialReading = true;

        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
        this.serialReader = textDecoder.readable.getReader();

        let lineBuffer = '';

        try {
            while (this.serialReading) {
                const { value, done } = await this.serialReader!.read();
                if (done) break;
                if (!value) continue;

                lineBuffer += value;

                // Process complete lines (delimited by \n)
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.length > 0) {
                        this.parseMessage(trimmed, 'usb');
                    }
                }
            }
        } catch (err: any) {
            this.addLog(`⚠️ USB read error: ${err?.message ?? err}`);
        } finally {
            this.serialReading = false;
            try {
                this.serialReader?.releaseLock();
                await readableStreamClosed.catch(() => { });
            } catch (_) { }

            if (this.status === 'connected' && this.connectionType === 'usb') {
                this.setStatus('disconnected');
                this.connectionType = 'none';
                this.addLog('📴 USB Serial disconnected');
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // MESSAGE PARSER — Handles structured protocol from firmware
    // ══════════════════════════════════════════════════════════════════════════════
    private parseMessage(raw: string, conn: KeyboardConnectionType) {
        const msg = raw.trim();
        if (!msg || !msg.includes(':')) return;

        const colonIdx = msg.indexOf(':');
        const type = msg.substring(0, colonIdx).toUpperCase();
        const value = msg.substring(colonIdx + 1);

        const event: KeyboardEvent = {
            type: type as KeyboardEvent['type'],
            value,
            timestamp: Date.now(),
            connection: conn,
        };

        switch (type) {
            case 'KEY':
                this.lastKey = value;
                this.handleKeyInput(value);
                this.emitKey(event);
                break;

            case 'WORD':
                this.emitKey(event);
                this.addLog(`📝 Word: ${value}`);
                break;

            case 'LONG':
                this.emitKey(event);
                this.addLog(`⏱️ Long Press: ${value}`);
                break;

            case 'STATUS':
                this.addLog(`📊 Status: ${value}`);
                break;

            case 'MODE':
                this.addLog(`🔗 Mode: ${value}`);
                break;

            default:
                // Unknown message type — log but don't crash
                this.addLog(`❓ Unknown: ${msg}`);
                break;
        }
    }

    // ── Key Input Handler — Builds typed text ─────────────────────────────────
    private handleKeyInput(key: string) {
        switch (key) {
            case 'SPACE':
                this.typedText += ' ';
                break;
            case 'ENTER':
                this.typedText += '\n';
                break;
            case 'BACKSPACE':
                this.typedText = this.typedText.slice(0, -1);
                break;
            default:
                // Single letter key
                this.typedText += key;
                break;
        }
        this.emitText();
    }

    // ── Send command to keyboard (via BLE or USB) ─────────────────────────────
    async sendToKeyboard(cmd: string): Promise<boolean> {
        if (this.connectionType === 'ble' && this.bleRxChar) {
            try {
                const data = new TextEncoder().encode(cmd);
                if ('writeValueWithoutResponse' in this.bleRxChar) {
                    await this.bleRxChar.writeValueWithoutResponse(data);
                } else {
                    await this.bleRxChar.writeValue(data);
                }
                return true;
            } catch (err: any) {
                this.addLog(`❌ BLE write error: ${err?.message}`);
                return false;
            }
        }

        if (this.connectionType === 'usb' && this.serialPort?.writable) {
            try {
                const writer = this.serialPort.writable.getWriter();
                await writer.write(new TextEncoder().encode(cmd + '\n'));
                writer.releaseLock();
                return true;
            } catch (err: any) {
                this.addLog(`❌ USB write error: ${err?.message}`);
                return false;
            }
        }

        return false;
    }

    // ── Disconnect ─────────────────────────────────────────────────────────────
    async disconnect(): Promise<void> {
        // BLE
        if (this.bleServer?.connected) {
            try { this.bleServer.disconnect(); } catch (_) { }
        }
        this.bleServer = null;
        this.bleTxChar = null;
        this.bleRxChar = null;
        this.bleDevice = null;

        // USB
        this.serialReading = false;
        try {
            this.serialReader?.releaseLock();
        } catch (_) { }
        try {
            await this.serialPort?.close();
        } catch (_) { }
        this.serialPort = null;
        this.serialReader = null;

        this.connectionType = 'none';
        this.setStatus('disconnected');
        this.addLog('🔌 Keyboard disconnected');
    }

    // ── Clear typed text ───────────────────────────────────────────────────────
    clearText() {
        this.typedText = '';
        this.currentWord = '';
        this.emitText();
    }

    // ── Backspace ──────────────────────────────────────────────────────────────
    backspace() {
        this.typedText = this.typedText.slice(0, -1);
        this.emitText();
    }
}

// ── Singleton exported for use across the entire SPARSH app ───────────────────
export const sparshKeyboard = new SparshKeyboardManager();
