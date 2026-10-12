/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — GESTURE RECOGNITION ENGINE           ║
 * ║        Static Template Matching + Unknown Rejection                  ║
 * ║        Temporal Debounce + Sample Recorder + Dynamic DTW Ext         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface StaticGestureTemplate {
  id: string;
  name: string;
  text: string;
  category: 'letter' | 'word' | 'phrase' | 'control';
  vector: [number, number, number, number, number]; // [thumb, index, middle, ring, little] (0.0 = straight, 1.0 = bent)
  tolerance: number; // Euclidean distance threshold (typically 0.20 - 0.32)
  description: string;
  icon?: string;
  enabled: boolean;
}

export interface RecognitionResult {
  gesture: StaticGestureTemplate | null;
  text: string;
  confidence: number; // 0.0 to 1.0 (or percentage 0..100)
  distance: number;
  isUnknown: boolean;
  timestamp: number;
  rawVector: [number, number, number, number, number];
}

export interface GestureSampleData {
  id: string;
  label: string;
  timestamp: number;
  vector: [number, number, number, number, number];
  rawAdc?: [number, number, number, number, number];
}

export interface DynamicGestureTemplate {
  id: string;
  name: string;
  text: string;
  sequence: Array<[number, number, number, number, number]>;
  durationMs: number;
  tolerance: number;
}

// ── Standard Default Gesture Templates ───────────────────────────────────────
export const DEFAULT_GESTURE_TEMPLATES: StaticGestureTemplate[] = [
  // ── Letters ──
  {
    id: 'letter_a',
    name: 'Letter A',
    text: 'A',
    category: 'letter',
    vector: [0.15, 0.90, 0.90, 0.90, 0.90],
    tolerance: 0.28,
    description: 'Fist with thumb resting upright beside index finger',
    icon: '🅰️',
    enabled: true,
  },
  {
    id: 'letter_b',
    name: 'Letter B',
    text: 'B',
    category: 'letter',
    vector: [0.90, 0.05, 0.05, 0.05, 0.05],
    tolerance: 0.28,
    description: 'Flat open palm with thumb tucked across palm',
    icon: '🅱️',
    enabled: true,
  },
  {
    id: 'letter_c',
    name: 'Letter C',
    text: 'C',
    category: 'letter',
    vector: [0.45, 0.45, 0.45, 0.45, 0.45],
    tolerance: 0.30,
    description: 'Curved fingers forming a C arc shape',
    icon: '🅲',
    enabled: true,
  },
  {
    id: 'letter_d',
    name: 'Letter D',
    text: 'D',
    category: 'letter',
    vector: [0.85, 0.05, 0.88, 0.88, 0.88],
    tolerance: 0.28,
    description: 'Index pointing straight up, thumb touching middle/ring tips',
    icon: '🅳',
    enabled: true,
  },
  {
    id: 'letter_f',
    name: 'Letter F',
    text: 'F',
    category: 'letter',
    vector: [0.88, 0.88, 0.05, 0.05, 0.05],
    tolerance: 0.28,
    description: 'Index and thumb touching in circle, middle, ring, pinky upright',
    icon: '🅵',
    enabled: true,
  },
  {
    id: 'letter_i',
    name: 'Letter I',
    text: 'I',
    category: 'letter',
    vector: [0.90, 0.90, 0.90, 0.90, 0.05],
    tolerance: 0.28,
    description: 'Pinky finger extended upright, other 4 fingers curled into fist',
    icon: '🅸',
    enabled: true,
  },
  {
    id: 'letter_l',
    name: 'Letter L',
    text: 'L',
    category: 'letter',
    vector: [0.05, 0.05, 0.90, 0.90, 0.90],
    tolerance: 0.28,
    description: 'Thumb and index extended at 90° angle, rest curled',
    icon: '🅻',
    enabled: true,
  },
  {
    id: 'letter_o',
    name: 'Letter O',
    text: 'O',
    category: 'letter',
    vector: [0.75, 0.75, 0.75, 0.75, 0.75],
    tolerance: 0.28,
    description: 'All fingers curved with tips touching thumb to make an O circle',
    icon: '🅾️',
    enabled: true,
  },
  {
    id: 'letter_u',
    name: 'Letter U',
    text: 'U',
    category: 'letter',
    vector: [0.90, 0.05, 0.05, 0.90, 0.90],
    tolerance: 0.28,
    description: 'Index and middle fingers held together upright, rest curled',
    icon: '🆄',
    enabled: true,
  },
  {
    id: 'letter_v',
    name: 'Letter V',
    text: 'V',
    category: 'letter',
    vector: [0.90, 0.05, 0.05, 0.90, 0.90],
    tolerance: 0.28,
    description: 'Index and middle fingers extended in V shape (Peace), rest curled',
    icon: '✌️',
    enabled: true,
  },
  {
    id: 'letter_w',
    name: 'Letter W',
    text: 'W',
    category: 'letter',
    vector: [0.85, 0.05, 0.05, 0.05, 0.90],
    tolerance: 0.28,
    description: 'Index, middle, and ring extended upward, thumb over pinky',
    icon: '🆆',
    enabled: true,
  },
  {
    id: 'letter_y',
    name: 'Letter Y',
    text: 'Y',
    category: 'letter',
    vector: [0.05, 0.90, 0.90, 0.90, 0.05],
    tolerance: 0.28,
    description: 'Thumb and pinky extended outwards, middle three fingers folded',
    icon: '🆈',
    enabled: true,
  },

  // ── Words & Common Phrases ──
  {
    id: 'word_hello',
    name: 'Hello',
    text: 'Hello',
    category: 'word',
    vector: [0.05, 0.05, 0.05, 0.05, 0.05],
    tolerance: 0.26,
    description: 'Open flat hand with all five fingers straight',
    icon: '👋',
    enabled: true,
  },
  {
    id: 'word_yes',
    name: 'Yes',
    text: 'Yes',
    category: 'word',
    vector: [0.85, 0.85, 0.85, 0.85, 0.85],
    tolerance: 0.26,
    description: 'Closed fist (nodding fist pose in ISL)',
    icon: '✊',
    enabled: true,
  },
  {
    id: 'word_no',
    name: 'No',
    text: 'No',
    category: 'word',
    vector: [0.45, 0.45, 0.45, 0.85, 0.85],
    tolerance: 0.28,
    description: 'Index and middle pinch against thumb, ring and pinky bent',
    icon: '🙅',
    enabled: true,
  },
  {
    id: 'word_thank_you',
    name: 'Thank You',
    text: 'Thank You',
    category: 'phrase',
    vector: [0.08, 0.08, 0.08, 0.08, 0.08],
    tolerance: 0.24,
    description: 'Flat open palm extended outwards gently',
    icon: '🙏',
    enabled: true,
  },
  {
    id: 'word_water',
    name: 'Water',
    text: 'Water',
    category: 'word',
    vector: [0.80, 0.05, 0.05, 0.05, 0.85],
    tolerance: 0.26,
    description: 'Three middle fingers straight up in W configuration',
    icon: '💧',
    enabled: true,
  },
  {
    id: 'word_help',
    name: 'Help',
    text: 'Help',
    category: 'word',
    vector: [0.05, 0.90, 0.90, 0.90, 0.90],
    tolerance: 0.26,
    description: 'Thumbs up (thumbs upright, fingers curled into base)',
    icon: '🆘',
    enabled: true,
  },
  {
    id: 'phrase_iloveyou',
    name: 'I Love You',
    text: 'I Love You',
    category: 'phrase',
    vector: [0.05, 0.05, 0.90, 0.90, 0.05],
    tolerance: 0.26,
    description: 'Universal ILY sign: Thumb, Index, and Little finger extended',
    icon: '🤟',
    enabled: true,
  },
  {
    id: 'word_stop',
    name: 'Stop',
    text: 'Stop',
    category: 'control',
    vector: [0.02, 0.02, 0.02, 0.02, 0.02],
    tolerance: 0.22,
    description: 'Hand flat upright with firm spread fingers',
    icon: '🛑',
    enabled: true,
  },
  {
    id: 'word_point',
    name: 'Look / Point',
    text: 'Look',
    category: 'word',
    vector: [0.85, 0.05, 0.85, 0.85, 0.85],
    tolerance: 0.26,
    description: 'Index extended forward, other four fingers closed',
    icon: '👉',
    enabled: true,
  },
  {
    id: 'word_ok',
    name: 'OK',
    text: 'OK',
    category: 'word',
    vector: [0.85, 0.85, 0.05, 0.05, 0.05],
    tolerance: 0.26,
    description: 'Thumb & index ring together, remaining three fingers extended',
    icon: '👌',
    enabled: true,
  },
];

const STORAGE_CUSTOM_KEY = 'sparsh_smart_glove_custom_templates_v1';
const STORAGE_SAMPLES_KEY = 'sparsh_smart_glove_samples_v1';

export class GestureRecognitionEngine {
  private templates: StaticGestureTemplate[] = [];
  private samples: GestureSampleData[] = [];

  // Temporal Debounce & Stability
  private lastCandidateId: string | null = null;
  private candidateStartTime: number = 0;
  private candidateHoldMs: number = 320; // Must hold steady for 320ms
  private confirmedGestureId: string | null = null;
  private minConfidenceThreshold: number = 0.65; // 65% minimum confidence

  // Dynamic Trajectory Window for Temporal Gesture Extension
  private trajectoryBuffer: Array<{ time: number; vector: [number, number, number, number, number] }> = [];
  private bufferMaxLen: number = 50; // ~1-2 seconds at 25-50Hz

  constructor() {
    this.loadTemplates();
    this.loadSamples();
  }

  /**
   * Load standard and user-defined templates
   */
  public loadTemplates(): void {
    let custom: StaticGestureTemplate[] = [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_CUSTOM_KEY);
        if (saved) custom = JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to load custom templates from localStorage:', err);
      }
    }
    this.templates = [...DEFAULT_GESTURE_TEMPLATES, ...custom];
  }

  public getTemplates(): StaticGestureTemplate[] {
    return this.templates;
  }

  public setConfidenceThreshold(threshold: number): void {
    this.minConfidenceThreshold = Math.max(0.3, Math.min(0.95, threshold));
  }

  public setHoldDuration(ms: number): void {
    this.candidateHoldMs = Math.max(100, Math.min(1500, ms));
  }

  /**
   * Euclidean Distance-based Template Matching
   * Distance = sqrt( sum( (live_i - template_i)^2 ) / 5 )
   * Normalized Confidence = clamp(1.0 - (dist / tolerance), 0, 1)
   */
  public recognize(vector: [number, number, number, number, number]): RecognitionResult {
    const now = Date.now();

    // Push into trajectory buffer for dynamic gesture pipeline
    this.trajectoryBuffer.push({ time: now, vector: [...vector] });
    if (this.trajectoryBuffer.length > this.bufferMaxLen) {
      this.trajectoryBuffer.shift();
    }

    let bestMatch: StaticGestureTemplate | null = null;
    let minDistance = 999.0;
    let maxConfidence = 0.0;

    for (const tpl of this.templates) {
      if (!tpl.enabled) continue;

      let sumSq = 0;
      for (let i = 0; i < 5; i++) {
        const diff = vector[i] - tpl.vector[i];
        sumSq += diff * diff;
      }
      const dist = Math.sqrt(sumSq / 5);

      if (dist <= tpl.tolerance) {
        const conf = Math.max(0, 1.0 - (dist / tpl.tolerance));
        if (conf > maxConfidence) {
          maxConfidence = conf;
          minDistance = dist;
          bestMatch = tpl;
        }
      }
    }

    // Reject unknown if below confidence threshold
    if (!bestMatch || maxConfidence < this.minConfidenceThreshold) {
      return {
        gesture: null,
        text: 'Unknown gesture',
        confidence: 0,
        distance: minDistance === 999.0 ? 1.0 : Number(minDistance.toFixed(3)),
        isUnknown: true,
        timestamp: now,
        rawVector: vector,
      };
    }

    return {
      gesture: bestMatch,
      text: bestMatch.text,
      confidence: Number(maxConfidence.toFixed(3)),
      distance: Number(minDistance.toFixed(3)),
      isUnknown: false,
      timestamp: now,
      rawVector: vector,
    };
  }

  /**
   * Temporal Filter & Debouncer:
   * Only triggers the callback when the same pose is held stable for `candidateHoldMs`
   */
  public processTemporal(
    vector: [number, number, number, number, number],
    onGestureConfirmed: (result: RecognitionResult) => void
  ): RecognitionResult {
    const result = this.recognize(vector);
    const now = Date.now();
    const candidateId = result.gesture ? result.gesture.id : null;

    if (candidateId === null) {
      // Returned to unknown/neutral pose — reset candidate tracker
      this.lastCandidateId = null;
      this.confirmedGestureId = null;
      return result;
    }

    if (candidateId !== this.lastCandidateId) {
      // New candidate pose detected — start hold timer
      this.lastCandidateId = candidateId;
      this.candidateStartTime = now;
    } else {
      // Same candidate pose held — check duration
      const holdTime = now - this.candidateStartTime;
      if (holdTime >= this.candidateHoldMs && this.confirmedGestureId !== candidateId) {
        // Confirmed stable pose!
        this.confirmedGestureId = candidateId;
        onGestureConfirmed(result);
      }
    }

    return result;
  }

  // ── Training & Sample Recording ─────────────────────────────────────────────
  private loadSamples(): void {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_SAMPLES_KEY);
        if (saved) this.samples = JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to load gesture samples:', err);
      }
    }
  }

  public recordSample(
    label: string,
    vector: [number, number, number, number, number],
    rawAdc?: [number, number, number, number, number]
  ): GestureSampleData {
    const sample: GestureSampleData = {
      id: 'sample_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      label: label.trim().toUpperCase(),
      timestamp: Date.now(),
      vector: [...vector],
      rawAdc: rawAdc ? [...rawAdc] : undefined,
    };
    this.samples.push(sample);
    this.saveSamples();
    return sample;
  }

  public getSamples(): GestureSampleData[] {
    return [...this.samples];
  }

  public clearSamples(): void {
    this.samples = [];
    this.saveSamples();
  }

  private saveSamples(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_SAMPLES_KEY, JSON.stringify(this.samples));
      } catch (e) {
        console.error('Error saving samples:', e);
      }
    }
  }

  public exportSamplesAsJson(): string {
    return JSON.stringify(this.samples, null, 2);
  }

  public exportSamplesAsCsv(): string {
    if (this.samples.length === 0) return 'id,label,timestamp,thumb,index,middle,ring,little\n';
    const header = 'id,label,timestamp,thumb,index,middle,ring,little\n';
    const rows = this.samples.map(s =>
      `${s.id},"${s.label}",${s.timestamp},${s.vector[0].toFixed(3)},${s.vector[1].toFixed(3)},${s.vector[2].toFixed(3)},${s.vector[3].toFixed(3)},${s.vector[4].toFixed(3)}`
    ).join('\n');
    return header + rows;
  }

  // ── Custom Template Creation ────────────────────────────────────────────────
  public addCustomTemplate(tpl: Omit<StaticGestureTemplate, 'id'>): StaticGestureTemplate {
    const newTpl: StaticGestureTemplate = {
      ...tpl,
      id: 'custom_' + Date.now(),
    };
    this.templates.push(newTpl);
    this.saveCustomTemplates();
    return newTpl;
  }

  public deleteCustomTemplate(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id);
    this.saveCustomTemplates();
  }

  private saveCustomTemplates(): void {
    if (typeof window !== 'undefined') {
      const custom = this.templates.filter(t => t.id.startsWith('custom_'));
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(custom));
    }
  }

  // ── Dynamic Gesture Recognition Extensibility (DTW Baseline) ────────────────
  /**
   * Extension Point: Dynamic Time Warping (DTW) calculation between two 5D trajectories.
   * Compares the live buffer with a recorded dynamic gesture pattern over time.
   */
  public computeDtwDistance(
    seq1: Array<[number, number, number, number, number]>,
    seq2: Array<[number, number, number, number, number]>
  ): number {
    const n = seq1.length;
    const m = seq2.length;
    if (n === 0 || m === 0) return 1.0;

    // Cost matrix initialization
    const dtw: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        // 5-dimensional Euclidean distance between points
        let cost = 0;
        for (let k = 0; k < 5; k++) {
          const diff = seq1[i - 1][k] - seq2[j - 1][k];
          cost += diff * diff;
        }
        cost = Math.sqrt(cost / 5);

        dtw[i][j] = cost + Math.min(
          dtw[i - 1][j],     // insertion
          dtw[i][j - 1],     // deletion
          dtw[i - 1][j - 1]  // match
        );
      }
    }

    return dtw[n][m] / (n + m);
  }
}

// Singleton instance
export const gestureEngine = new GestureRecognitionEngine();
