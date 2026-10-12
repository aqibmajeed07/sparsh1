// ─── Sparsh SenseBand — Web Bluetooth API Layer ───────────────────────────────
// Communicates with the ESP32-C3 SenseBand firmware via BLE.
//
// BLE Service UUID:        4fafc201-1fb5-459e-8fcc-c5c9c331914b
// BLE Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
//
// Browser support: Chrome 56+, Edge 79+
// Protocol: Write without response (PROPERTY_WRITE_NR) for lowest latency

export type HapticCommand =
    | 'CONNECTED'
    | 'AI_READY'
    | 'LEFT'
    | 'RIGHT'
    | 'FORWARD'
    | 'STOP'
    | 'SUCCESS'
    | 'ERROR'
    | 'CORRECT'
    | 'WRONG'
    | 'MESSAGE'
    | 'CALL'
    | 'CALL_STOP'
    | 'LESSON_COMPLETE'
    | 'ASSIGNMENT'
    | 'NAV_NEXT'
    | 'NAV_PREVIOUS'
    | 'NAV_MENU'
    | 'OCR_TEXT'
    | 'OCR_DONE'
    | 'EMERGENCY'
    | 'LOW_BATTERY'
    | 'BATTERY_REQUEST'
    | 'TEST'
    | 'SLEEP'
    | 'WAKE';

export type SenseBandStatus = 'disconnected' | 'searching' | 'connected' | 'error';

// ─── Haptic pattern metadata (for the UI) ────────────────────────────────────
export const HAPTIC_PATTERNS: Record<HapticCommand, { label: string; description: string; pattern: string; group: string }> = {
    CONNECTED: { label: 'Connected', description: 'One short pulse + beep', pattern: '·', group: 'System' },
    AI_READY: { label: 'AI Response Ready', description: 'Two short pulses', pattern: '· ·', group: 'AI' },
    LEFT: { label: 'Turn Left', description: 'Two short pulses', pattern: '· ·', group: 'Navigation' },
    RIGHT: { label: 'Turn Right', description: 'Three short pulses', pattern: '· · ·', group: 'Navigation' },
    FORWARD: { label: 'Move Forward', description: 'Pulse every 2 seconds', pattern: '· … · …', group: 'Navigation' },
    STOP: { label: 'Stop', description: 'One long pulse', pattern: '—', group: 'Navigation' },
    SUCCESS: { label: 'Success', description: 'Three quick pulses + beep', pattern: '···', group: 'Feedback' },
    ERROR: { label: 'Error', description: 'Long short long + beep', pattern: '— · —', group: 'Feedback' },
    CORRECT: { label: 'Correct Answer', description: 'Three short pulses', pattern: '· · ·', group: 'Feedback' },
    WRONG: { label: 'Wrong Answer', description: 'One long pulse', pattern: '—', group: 'Feedback' },
    MESSAGE: { label: 'New Message', description: 'Double pulse + beep', pattern: '·· ··', group: 'Notifications' },
    CALL: { label: 'Incoming Call', description: 'Continuous every 1s', pattern: '█ █ █', group: 'Notifications' },
    CALL_STOP: { label: 'End Call', description: 'Stop vibration', pattern: '—', group: 'Notifications' },
    LESSON_COMPLETE: { label: 'Lesson Completed', description: 'Short Short Long', pattern: '· · —', group: 'Learning' },
    ASSIGNMENT: { label: 'New Assignment', description: 'Long Short', pattern: '— ·', group: 'Learning' },
    NAV_NEXT: { label: 'Navigate Next', description: 'One short pulse', pattern: '·', group: 'Navigation' },
    NAV_PREVIOUS: { label: 'Navigate Previous', description: 'Two short pulses', pattern: '· ·', group: 'Navigation' },
    NAV_MENU: { label: 'Open Menu', description: 'Three short pulses', pattern: '· · ·', group: 'Navigation' },
    OCR_TEXT: { label: 'OCR Sentence', description: 'Tiny pulse per sentence', pattern: '·', group: 'OCR' },
    OCR_DONE: { label: 'OCR Complete', description: 'Long pulse', pattern: '—', group: 'OCR' },
    EMERGENCY: { label: 'Emergency', description: 'Continuous 3 seconds', pattern: '██████', group: 'Emergency' },
    LOW_BATTERY: { label: 'Low Battery', description: 'Slow pulse every 30s', pattern: '· … ·', group: 'System' },
    BATTERY_REQUEST: { label: 'Battery Check', description: 'Request battery %', pattern: '?', group: 'System' },
    TEST: { label: 'Test Vibration', description: 'Full 1-second burst', pattern: '████', group: 'System' },
    SLEEP: { label: 'Sleep Mode', description: 'Enter deep sleep', pattern: 'Zzz', group: 'System' },
    WAKE: { label: 'Wake Up', description: 'Wake from sleep', pattern: '!', group: 'System' },
};

// ─── BLE UUIDs — must match the firmware exactly ─────────────────────────────
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// ─── Manager class ────────────────────────────────────────────────────────────
class SenseBandManager {
    private device: any = null;   // BluetoothDevice
    private server: any = null;   // BluetoothRemoteGATTServer
    private characteristic: any = null;   // BluetoothRemoteGATTCharacteristic

    private statusListeners: Set<(status: SenseBandStatus) => void> = new Set();
    private logListeners: Set<(log: string) => void> = new Set();
    private batteryListeners: Set<(pct: number) => void> = new Set();

    public status: SenseBandStatus = 'disconnected';
    public firmwareVersion: string = 'SB-v2.0';
    public deviceId: string = '—';
    public batteryPercent: number = -1;

    // ── Event subscriptions ──────────────────────────────────────────────────
    onStatus(cb: (s: SenseBandStatus) => void) {
        this.statusListeners.add(cb);
        return () => { this.statusListeners.delete(cb); };
    }
    onLog(cb: (l: string) => void) {
        this.logListeners.add(cb);
        return () => { this.logListeners.delete(cb); };
    }
    onBattery(cb: (pct: number) => void) {
        this.batteryListeners.add(cb);
        return () => { this.batteryListeners.delete(cb); };
    }

    private setStatus(s: SenseBandStatus) {
        this.status = s;
        this.statusListeners.forEach(cb => cb(s));
    }
    private addLog(msg: string) {
        const ts = new Date().toLocaleTimeString();
        this.logListeners.forEach(cb => cb(`[${ts}] ${msg}`));
    }

    // ── Browser capability checks ────────────────────────────────────────────
    get isBluetoothSupported(): boolean {
        return (
            typeof navigator !== 'undefined' &&
            'bluetooth' in navigator
        );
    }

    // Legacy USB Serial support (kept for prototype fallback)
    get isSerialSupported(): boolean {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    // ── Connect via BLE ──────────────────────────────────────────────────────
    async connect(forceAllDevices: boolean = false): Promise<boolean> {
        if (!this.isBluetoothSupported) {
            this.addLog('❌ Web Bluetooth not supported. Use Chrome or Edge.');
            this.setStatus('error');
            return false;
        }

        try {
            this.setStatus('searching');
            this.addLog(forceAllDevices ? '🔍 Opening Bluetooth picker (scanning all devices)…' : '🔍 Opening Bluetooth device picker…');

            const requestOptions: any = forceAllDevices
                ? {
                    acceptAllDevices: true,
                    optionalServices: [SERVICE_UUID],
                }
                : {
                    filters: [
                        { name: 'Sparsh SenseBand' },
                        { name: 'SparshSenseBand' },
                        { namePrefix: 'Sparsh' },
                        { namePrefix: 'Sense' },
                        { services: [SERVICE_UUID] },
                    ],
                    optionalServices: [SERVICE_UUID],
                };

            // Show the browser's native Bluetooth pair dialog
            this.device = await (navigator as any).bluetooth.requestDevice(requestOptions);

            this.deviceId = this.device!.id || 'BLE-DEVICE';
            this.firmwareVersion = 'SB-v2.0';

            this.addLog(`📡 Found: ${this.device!.name || 'SenseBand'} — connecting…`);

            // Listen for disconnect events
            this.device!.addEventListener('gattserverdisconnected', () => {
                this.addLog('📴 SenseBand disconnected (BLE).');
                this.setStatus('disconnected');
                this.server = null;
                this.characteristic = null;
            });

            // Connect to GATT server on the ESP32
            this.server = await this.device!.gatt!.connect();
            this.addLog('✅ GATT server connected.');

            // Discover service
            const service = await this.server.getPrimaryService(SERVICE_UUID);
            this.addLog('✅ BLE service found.');

            // Get writable characteristic
            this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
            this.addLog('✅ Haptic characteristic ready.');

            // Listen for notifications (battery responses)
            try {
                await this.characteristic.startNotifications();
                this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                    const value = new TextDecoder().decode(event.target.value);
                    if (value.startsWith('BATTERY:')) {
                        const pct = parseInt(value.split(':')[1], 10);
                        if (!isNaN(pct)) {
                            this.batteryPercent = pct;
                            this.batteryListeners.forEach(cb => cb(pct));
                            this.addLog(`🔋 Battery: ${pct}%`);
                        }
                    }
                });
            } catch (_) {
                this.addLog('ℹ️ Notifications not available — battery polling disabled.');
            }

            this.setStatus('connected');
            this.addLog(`🎉 SenseBand connected! Device: ${this.device!.name || 'Sparsh SenseBand'}`);

            // Tell the band it's connected
            await this.send('CONNECTED');

            // Request battery percentage immediately upon connection
            setTimeout(() => {
                this.requestBattery().catch(() => { });
            }, 600);

            // Start 30-second periodic battery status polling
            this.startBatteryPolling();

            return true;

        } catch (err: any) {
            if (err?.name === 'NotFoundError') {
                this.addLog('ℹ️ No device chosen. Click "Scan All Devices" if your ESP32 name is different.');
            } else if (err?.name === 'SecurityError') {
                this.addLog('🔒 Bluetooth permission denied. Ensure Web Bluetooth is allowed in browser settings.');
            } else {
                this.addLog(`❌ Connection failed: ${err?.message ?? err}`);
            }
            this.setStatus('error');
            return false;
        }
    }

    private batteryInterval: any = null;

    private startBatteryPolling() {
        this.stopBatteryPolling();
        this.batteryInterval = setInterval(() => {
            if (this.status === 'connected') {
                this.requestBattery().catch(() => { });
            }
        }, 30000);
    }

    private stopBatteryPolling() {
        if (this.batteryInterval) {
            clearInterval(this.batteryInterval);
            this.batteryInterval = null;
        }
    }

    // ── Disconnect ───────────────────────────────────────────────────────────
    async disconnect(): Promise<void> {
        this.stopBatteryPolling();
        try {
            if (this.server?.connected) {
                this.server.disconnect();
            }
        } catch (_) { }
        this.server = null;
        this.characteristic = null;
        this.device = null;
        this.setStatus('disconnected');
        this.addLog('🔌 SenseBand disconnected.');
    }

    // ── Send a haptic command ────────────────────────────────────────────────
    async send(cmd: HapticCommand): Promise<boolean> {
        if (this.status !== 'connected' || !this.characteristic) {
            // Silent fail — don't spam when band isn't paired
            return false;
        }
        try {
            const encoded = new TextEncoder().encode(cmd);
            // writeValueWithoutResponse is faster (no ACK roundtrip)
            if ('writeValueWithoutResponse' in this.characteristic) {
                await (this.characteristic as any).writeValueWithoutResponse(encoded);
            } else {
                await this.characteristic.writeValue(encoded);
            }
            const pat = HAPTIC_PATTERNS[cmd];
            this.addLog(`→ ${cmd.padEnd(18)} ${pat.pattern}  (${pat.description})`);
            return true;
        } catch (err: any) {
            this.addLog(`❌ Send error [${cmd}]: ${err?.message ?? err}`);
            // If the connection dropped silently, update status
            if (!this.server?.connected) {
                this.setStatus('disconnected');
            }
            return false;
        }
    }

    // ── Request battery level ────────────────────────────────────────────────
    async requestBattery(): Promise<number> {
        await this.send('BATTERY_REQUEST');
        return this.batteryPercent;
    }
}

// ── Singleton exported for use across the entire app ──────────────────────────
export const senseBand = new SenseBandManager();
