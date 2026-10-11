'use client';

import { useState, useRef } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { senseBand } from '@/lib/senseband';
import Tesseract from 'tesseract.js';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Volume2,
  Copy,
  Check,
  Download,
  Printer,
  Sparkles,
  Keyboard,
  FileUp,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';

// Standard 6-Dot Unified English Braille (UEB) & Bharati Braille
const TEXT_TO_BRAILLE_MAP: Record<string, string> = {
  // Letters a-z
  a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚',
  k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
  u: '⠌', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵',

  // Numbers (standard UEB Braille mapping)
  '1': '⠂', '2': '⠆', '3': '⠒', '4': '⠲', '5': '⠢',
  '6': '⠖', '7': '⠶', '8': '⠦', '9': '⠔', '0': '⠴',

  // Punctuation & Symbols
  ' ': ' ',
  ',': '⠂',
  ';': '⠆',
  ':': '⠒',
  '.': '⠲',
  '!': '⠖',
  '?': '⠦',
  "'": '⠄',
  '"': '⠦',
  '-': '⠤',
  '/': '⠸',
  '(': '⠐⠣',
  ')': '⠐⠜',

  // Bharati Braille (Hindi & Indian Languages)
  'अ': '⠁', 'आ': '⠜', 'इ': '⠊', 'ई': '⠔', 'उ': '⠥', 'ऊ': '⠱',
  'ए': '⠑', 'ऐ': '⠌', 'ओ': '⠕', 'औ': '⠪', 'क': '⠅', 'ख': '⠨',
  'ग': '⠛', 'घ': '⠣', 'च': '⠉', 'छ': '⠡', 'ज': '⠚', 'झ': '⠴',
  'ट': '⠾', 'ठ': '⠺', 'ड': '⠹', 'ढ': '⠯', 'ण': '⠼', 'त': '⠞',
  'थ': '⠹', 'द': '⠙', 'ध': '⠮', 'न': '⠝', 'प': '⠏', 'फ': '⠖',
  'ब': '⠃', 'भ': '⠘', 'म': '⠍', 'य': '⠽', 'र': '⠗', 'ल': '⠇',
  'व': '⠧', 'श': '⠩', 'ष': '⠯', 'स': '⠎', 'ह': '⠓'
};

// Map each char to active dot numbers (1 to 6)
const CHAR_TO_DOTS_MAP: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
  '1': [1], '2': [1, 2], '3': [1, 4], '4': [1, 4, 5], '5': [1, 5],
  '6': [1, 2, 4], '7': [1, 2, 4, 5], '8': [1, 2, 5], '9': [2, 4], '0': [2, 4, 5]
};

// Map from active dot pattern (e.g. '1,2') to character for 6-dot keyboard
const DOTS_TO_CHAR_MAP: Record<string, string> = {
  '1': 'a',
  '1,2': 'b',
  '1,4': 'c',
  '1,4,5': 'd',
  '1,5': 'e',
  '1,2,4': 'f',
  '1,2,4,5': 'g',
  '1,2,5': 'h',
  '2,4': 'i',
  '2,4,5': 'j',
  '1,3': 'k',
  '1,2,3': 'l',
  '1,3,4': 'm',
  '1,3,4,5': 'n',
  '1,3,5': 'o',
  '1,2,3,4': 'p',
  '1,2,3,4,5': 'q',
  '1,2,3,5': 'r',
  '2,3,4': 's',
  '2,3,4,5': 't',
  '1,3,6': 'u',
  '1,2,3,6': 'v',
  '2,4,5,6': 'w',
  '1,3,4,6': 'x',
  '1,3,4,5,6': 'y',
  '1,3,5,6': 'z',
};

const SAMPLE_TEXTS = [
  {
    title: 'NCERT Science: Photosynthesis',
    text: 'Plants make food using sunlight, water, and carbon dioxide.',
  },
  {
    title: 'Inclusive Education Motto',
    text: 'Every voice matters. Every student can learn with dignity.',
  },
  {
    title: 'Hindi / भारतीय ब्रेल',
    text: 'स्पर्श समावेशी शिक्षा मंच सभी विद्यार्थियों के लिए है।',
  },
];

export default function BrailleLabPage() {
  // Input source: 'text' | 'image' | 'pdf' | 'keypad'
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'pdf' | 'keypad'>('text');

  // Main Text Content
  const [inputText, setInputText] = useState('Welcome to Sparsh inclusive learning.');

  // File Upload States
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [loadingExtraction, setLoadingExtraction] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatusText, setExtractionStatusText] = useState('');

  // 6-Dot Keypad State
  const [activeDots, setActiveDots] = useState<number[]>([]);
  const [translatedSentence, setTranslatedSentence] = useState('');

  // UI Feedback
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { speak } = useAccessibility();

  // Convert text string to Braille Unicode string
  const convertTextToBraille = (text: string) => {
    return text
      .split('')
      .map(char => {
        const lower = char.toLowerCase();
        return TEXT_TO_BRAILLE_MAP[lower] || TEXT_TO_BRAILLE_MAP[char] || char;
      })
      .join('');
  };

  const brailleOutput = convertTextToBraille(inputText) || '⠃⠗⠁⠊⠇⠇⠑';

  // ── Handle Picture OCR Upload ──
  const handleImageUpload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }

    setLoadingExtraction(true);
    setExtractionProgress(10);
    setExtractionStatusText('Initializing Optical Character Recognition (OCR)...');
    setUploadedFileName(file.name);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const p = Math.round(m.progress * 100);
            setExtractionProgress(p);
            setExtractionStatusText(`Scanning printed text: ${p}% complete...`);
          }
        }
      });

      const extracted = result.data.text ? result.data.text.trim() : '';

      if (extracted && extracted.length > 2) {
        setInputText(extracted);
        speak(`Image OCR complete. Converted ${file.name} to Braille.`);
        senseBand.send('OCR_TEXT');
      } else {
        alert('No clear text found in this image. Please ensure the image is bright and clear.');
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      alert('Failed to scan image. Please try another image.');
    } finally {
      setLoadingExtraction(false);
      setExtractionProgress(0);
      setExtractionStatusText('');
    }
  };

  // ── Handle PDF Upload ──
  const handlePdfUpload = async (file: File) => {
    if (!file) return;

    setLoadingExtraction(true);
    setExtractionProgress(25);
    setExtractionStatusText('Extracting text from PDF document...');
    setUploadedFileName(file.name);
    setImagePreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Call our document extraction API
      const res = await fetch('/api/extract-document', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 0) {
          setInputText(data.text);
          setPdfPageCount(data.total_pages || 1);
          setExtractionProgress(100);
          speak(`PDF document extracted. ${data.total_pages || 1} pages converted to Braille.`);
          senseBand.send('OCR_TEXT');
          return;
        }
      }

      // Fallback: simple text read if text/plain or small PDF
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result as string;
        // Basic extraction of printable characters from text stream
        const cleaned = raw.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 20) {
          setInputText(cleaned.slice(0, 5000));
          speak(`Text extracted from ${file.name} and converted to Braille.`);
        } else {
          alert('Could not parse text from this PDF. Please ensure the PDF contains selectable text.');
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      console.error('PDF Extraction Error:', err);
      alert('Error parsing PDF. Please try a standard text PDF.');
    } finally {
      setLoadingExtraction(false);
      setExtractionProgress(0);
      setExtractionStatusText('');
    }
  };

  // ── Copy Braille ──
  const handleCopyBraille = () => {
    navigator.clipboard.writeText(brailleOutput);
    setCopied(true);
    speak('Braille copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download .BRF file (Braille Ready Format for Refreshable Braille Displays) ──
  const handleDownloadBRF = () => {
    const blob = new Blob([brailleOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparsh_braille_${Date.now()}.brf`;
    a.click();
    URL.revokeObjectURL(url);
    speak('Downloading Braille Ready BRF file for tactile display');
  };

  // ── Printable Tactile Embosser Document ──
  const handleDownloadBraillePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sparsh Tactile Braille Embossing Sheet</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; color: #000; background: #fff; }
            .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 25px; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 13px; color: #444; margin-top: 5px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 15px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 5px; margin-bottom: 12px; }
            .original-text { font-size: 17px; line-height: 1.6; color: #222; }
            .braille-output { font-size: 52px; letter-spacing: 0.35em; font-family: monospace; line-height: 1.8; background: #f8f8f8; padding: 25px; border: 2px dashed #000; border-radius: 8px; word-break: break-all; }
            .dot-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 15px; }
            .dot-card { border: 2px solid #000; padding: 10px 14px; border-radius: 8px; text-align: center; width: 75px; }
            .dot-letter { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .dot-symbol { font-size: 34px; margin: 4px 0; }
            .dot-nums { font-size: 11px; font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">⠃ Sparsh Tactile Braille Embossing Document</div>
            <div class="subtitle">Standard 6-Dot Grade 1 Braille • Suitable for swell paper, tactile embossers, and touch practice</div>
          </div>

          <div class="section">
            <div class="section-title">Original Document Content</div>
            <div class="original-text">${inputText}</div>
          </div>

          <div class="section">
            <div class="section-title">Tactile Braille Output</div>
            <div class="braille-output">${brailleOutput}</div>
          </div>

          <div class="section">
            <div class="section-title">Letter by Letter Dot Cell Breakdown</div>
            <div class="dot-grid">
              ${inputText.split('').slice(0, 60).map(char => {
                if (char === ' ') return '';
                const lower = char.toLowerCase();
                const bChar = TEXT_TO_BRAILLE_MAP[lower] || TEXT_TO_BRAILLE_MAP[char] || char;
                const dots = CHAR_TO_DOTS_MAP[lower] || [];
                return `
                  <div class="dot-card">
                    <div class="dot-letter">${char}</div>
                    <div class="dot-symbol">${bChar}</div>
                    <div class="dot-nums">${dots.length ? 'Dots ' + dots.join(',') : ''}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    speak('Opening printable Braille embossing sheet');
  };

  // ── 6-Dot Keypad Logic ──
  const toggleDot = (dotNum: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    setActiveDots(prev => {
      const next = prev.includes(dotNum) ? prev.filter(d => d !== dotNum) : [...prev, dotNum].sort();
      return next;
    });
  };

  const handleCommitBrailleCell = () => {
    const key = activeDots.join(',');
    const char = DOTS_TO_CHAR_MAP[key] || '?';
    setTranslatedSentence(prev => prev + char);
    speak(char === '?' ? 'Unknown dot cell' : `Letter ${char}`);
    if (char !== '?') {
      senseBand.send('CORRECT');
    } else {
      senseBand.send('WRONG');
    }
    setActiveDots([]);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs text-slate-300 font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7]" />
            <span>Inclusive Assistive Technology</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span className="text-[#00C9A7]">⠃</span> Braille Conversion & Speech Lab
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Convert standard text, uploaded document photos (OCR), or PDF worksheets into 6-Dot Tactile Braille and natural audio speech.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => speak(inputText)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition flex items-center gap-2 border border-white/10"
          >
            <Volume2 className="w-4 h-4 text-[#00C9A7]" />
            <span>Read Aloud (TTS)</span>
          </button>
          <button
            onClick={handleDownloadBraillePDF}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:from-[#5b52f9] hover:to-[#00b899] text-white font-bold text-xs shadow-md shadow-[#6C63FF]/20 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Emboss PDF</span>
          </button>
        </div>
      </div>

      {/* ── Conversion Mode Navigation Tabs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-white/10">
        <button
          onClick={() => {
            setActiveTab('text');
            speak('Type or paste normal text mode');
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'text'
              ? 'bg-[#6C63FF] text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Type / Paste Text</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('image');
            speak('Upload picture OCR mode');
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'image'
              ? 'bg-[#00C9A7] text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Upload Picture (OCR)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('pdf');
            speak('Upload PDF document mode');
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'pdf'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileUp className="w-4 h-4" />
          <span>Upload PDF Document</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('keypad');
            speak('6-Dot Braille Keypad mode');
          }}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'keypad'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>6-Dot Braille Keypad</span>
        </button>
      </div>

      {/* ── TAB 1: Type / Paste Normal Text ── */}
      {activeTab === 'text' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <span>🔤</span> Enter Normal Text to Translate:
              </h2>
              <p className="text-slate-400 text-xs">Supports English, numbers, punctuation, and Hindi / Bharati Braille</p>
            </div>

            {/* Quick Sample Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Quick Examples:</span>
              {SAMPLE_TEXTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(sample.text)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 transition"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste any text, article, notes, or homework here..."
            className="w-full h-32 p-4 text-white text-base rounded-xl border border-white/15 bg-slate-950/70 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition resize-y"
          />
        </div>
      )}

      {/* ── TAB 2: Upload Picture (OCR Scanner) ── */}
      {activeTab === 'image' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#00C9A7]" />
              <span>Upload Picture to Convert into Braille:</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Upload textbook pages, handwritten notes, worksheets, or camera photos. AI OCR extracts text and instantly converts it to Braille.
            </p>
          </div>

          {/* Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/20 hover:border-[#00C9A7] rounded-2xl p-8 text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/70 flex flex-col items-center justify-center gap-3 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-[#00C9A7] group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                Click to browse or drop an image here
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Supports JPG, PNG, WEBP, and phone camera photos
              </p>
            </div>
          </div>

          {/* OCR Scanning Progress */}
          {loadingExtraction && (
            <div className="p-4 rounded-xl bg-slate-950 border border-[#00C9A7]/40 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#00C9A7] font-semibold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{extractionStatusText}</span>
                </span>
                <span className="text-white font-bold">{extractionProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] transition-all duration-300"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Image Preview & Extracted Text Side-by-Side */}
          {imagePreview && !loadingExtraction && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Uploaded Image Preview:</span>
                <div className="relative h-44 w-full rounded-lg overflow-hidden border border-white/10">
                  <img
                    src={imagePreview}
                    alt="Uploaded Document"
                    className="object-contain w-full h-full bg-black/50"
                  />
                </div>
                <span className="text-[11px] text-slate-500 block truncate">{uploadedFileName}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#00C9A7] block">Extracted Text (Editable):</span>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full h-36 mt-1 p-3 text-xs text-white rounded-lg border border-white/10 bg-slate-900 focus:outline-none focus:border-[#00C9A7] resize-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400">
                  You can edit the extracted text above to refine the Braille output below.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Upload PDF Document ── */}
      {activeTab === 'pdf' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-400" />
              <span>Upload PDF Document to Convert into Braille:</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Upload NCERT chapters, school worksheets, test papers, or reading material (.pdf / .txt).
            </p>
          </div>

          {/* PDF Drop Zone */}
          <div
            onClick={() => pdfInputRef.current?.click()}
            className="border-2 border-dashed border-white/20 hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/70 flex flex-col items-center justify-center gap-3 group"
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfUpload(file);
              }}
            />
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                Click to browse or drop a PDF here
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Multi-page PDFs are automatically parsed and translated to Braille
              </p>
            </div>
          </div>

          {/* Progress */}
          {loadingExtraction && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-400 font-semibold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{extractionStatusText}</span>
                </span>
                <span className="text-white font-bold">{extractionProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-[#00C9A7] transition-all duration-300"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Document Summary & Extracted Content */}
          {uploadedFileName && !loadingExtraction && (
            <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Document: {uploadedFileName}</span>
                </span>
                {pdfPageCount && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                    {pdfPageCount} Page{pdfPageCount > 1 ? 's' : ''} Processed
                  </span>
                )}
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">
                  Extracted Text (Editable for Braille translation):
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full h-36 p-3 text-xs text-white rounded-lg border border-white/10 bg-slate-900 focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Interactive 6-Dot Keypad (Haptic Touch) ── */}
      {activeTab === 'keypad' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Keypad */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 flex flex-col items-center space-y-4 shadow-xl">
            <h3 className="text-white font-bold text-base text-center">
              Interactive 6-Dot Tactile Cell Input
            </h3>
            <p className="text-slate-400 text-xs text-center">
              Tap dots to form a letter (e.g. Dot 1 = A, Dots 1,2 = B), then click "Commit Cell"
            </p>

            {/* 6-Dot Matrix Display */}
            <div className="grid grid-cols-2 gap-6 p-6 bg-slate-950 border-2 border-[#00C9A7]/40 rounded-2xl">
              {/* Column 1: Dots 1, 2, 3 */}
              <div className="space-y-4 flex flex-col items-center">
                {[1, 2, 3].map(dotNum => {
                  const isSelected = activeDots.includes(dotNum);
                  return (
                    <button
                      key={dotNum}
                      type="button"
                      onClick={() => toggleDot(dotNum)}
                      className={`w-14 h-14 rounded-full border-4 font-bold text-base transition flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-yellow-400 border-yellow-300 text-black scale-105 shadow-lg shadow-yellow-400/40'
                          : 'bg-white/10 border-white/20 text-white/50 hover:border-[#00C9A7]'
                      }`}
                      aria-label={`Dot ${dotNum}`}
                    >
                      {dotNum}
                    </button>
                  );
                })}
              </div>

              {/* Column 2: Dots 4, 5, 6 */}
              <div className="space-y-4 flex flex-col items-center">
                {[4, 5, 6].map(dotNum => {
                  const isSelected = activeDots.includes(dotNum);
                  return (
                    <button
                      key={dotNum}
                      type="button"
                      onClick={() => toggleDot(dotNum)}
                      className={`w-14 h-14 rounded-full border-4 font-bold text-base transition flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-yellow-400 border-yellow-300 text-black scale-105 shadow-lg shadow-yellow-400/40'
                          : 'bg-white/10 border-white/20 text-white/50 hover:border-[#00C9A7]'
                      }`}
                      aria-label={`Dot ${dotNum}`}
                    >
                      {dotNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commit & Actions */}
            <div className="flex gap-2 w-full pt-2">
              <button
                type="button"
                onClick={handleCommitBrailleCell}
                className="flex-1 py-3 bg-[#00C9A7] text-white font-bold rounded-xl text-xs hover:bg-[#00b093] transition shadow-lg"
              >
                ✓ Commit Cell ({DOTS_TO_CHAR_MAP[activeDots.join(',')] || '?'})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTranslatedSentence(prev => prev + ' ');
                  speak('Space');
                }}
                className="px-4 py-3 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-700 transition"
              >
                Space
              </button>
              <button
                type="button"
                onClick={() => {
                  setTranslatedSentence(prev => prev.slice(0, -1));
                  speak('Delete');
                }}
                className="px-4 py-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs hover:bg-rose-500/30 transition"
              >
                ⌫
              </button>
            </div>
          </div>

          {/* Composed Output */}
          <div className="bg-slate-900/90 border border-[#00C9A7]/30 rounded-2xl p-6 space-y-4 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                <h3 className="text-[#00C9A7] font-bold text-base flex items-center gap-2">
                  <span>🔊</span> Composed Text Output
                </h3>
                <button
                  type="button"
                  onClick={() => speak(translatedSentence || 'No translated text')}
                  className="px-3 py-1.5 bg-[#58cc02] text-white text-xs font-bold rounded-xl hover:bg-[#46a302] transition"
                >
                  🔊 Read Aloud
                </button>
              </div>

              <div className="p-5 bg-slate-950 rounded-xl border border-white/10 min-h-[140px]">
                <p className="text-2xl font-bold text-white leading-relaxed">
                  {translatedSentence || (
                    <span className="text-slate-600 italic text-base">
                      Target text appears here as you tap Braille dots...
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (translatedSentence) setInputText(translatedSentence);
                setActiveTab('text');
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/10 transition"
            >
              Transfer Composed Text to Full Braille Translator ➔
            </button>
          </div>
        </div>
      )}

      {/* ── UNIFIED TACTILE BRAILLE OUTPUT SECTION ── */}
      <div className="bg-slate-900/90 border border-[#6C63FF]/30 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
        
        {/* Output Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <span className="text-yellow-400 text-2xl">⠃</span>
              <span>Tactile 6-Dot Braille Output (Grade 1 / UEB & Bharati):</span>
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
              <span>{inputText.length} Characters</span>
              <span>•</span>
              <span>{inputText.trim() ? inputText.trim().split(/\s+/).length : 0} Words</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">Standard 6-Dot Unicode</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyBraille}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{copied ? 'Copied!' : 'Copy Braille'}</span>
            </button>

            {/* Download BRF */}
            <button
              type="button"
              onClick={handleDownloadBRF}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export .BRF</span>
            </button>

            {/* Print / Emboss PDF */}
            <button
              type="button"
              onClick={handleDownloadBraillePDF}
              className="px-4 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5b52f9] text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Emboss</span>
            </button>
          </div>
        </div>

        {/* High-Contrast Large Braille Display */}
        <div className="p-6 sm:p-8 bg-slate-950 rounded-2xl border border-white/10 shadow-inner overflow-x-auto">
          <p className="text-3xl sm:text-4xl lg:text-5xl text-yellow-300 tracking-[0.35em] font-mono leading-loose select-all break-words">
            {brailleOutput}
          </p>
        </div>

        {/* Letter by Letter Tactile Dot Breakdown */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00C9A7]" />
              <span>Interactive Dot Cell Inspector (Click any cell to hear dots):</span>
            </h3>
            <span className="text-[11px] text-slate-500">First 40 cells displayed</span>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5 max-h-64 overflow-y-auto p-1">
            {inputText.split('').slice(0, 40).map((char, index) => {
              if (char === ' ') return <div key={index} className="w-4" />;
              const lower = char.toLowerCase();
              const brailleChar = TEXT_TO_BRAILLE_MAP[lower] || TEXT_TO_BRAILLE_MAP[char] || char;
              const dots = CHAR_TO_DOTS_MAP[lower] || [];

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const desc = dots.length ? `Letter ${char}, Braille dots ${dots.join(' and ')}` : `Character ${char}`;
                    speak(desc);
                  }}
                  className="p-2.5 sm:p-3 bg-slate-950 border border-white/10 hover:border-[#00C9A7] rounded-xl text-center space-y-1 transition hover:scale-105 cursor-pointer min-w-[56px]"
                >
                  <span className="text-[#00C9A7] font-bold text-xs block uppercase">{char}</span>
                  <span className="text-2xl text-yellow-300 block font-mono">{brailleChar}</span>
                  <span className="text-[10px] text-slate-400 block font-mono font-medium">
                    {dots.length ? dots.join(',') : '-'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Informative Braille Hardware Guide */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 flex items-start gap-3 text-xs text-slate-400">
          <Info className="w-4 h-4 text-[#00C9A7] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Embossing & Refreshable Display Compatibility:</span>
            <p className="mt-0.5">
              Sparsh Braille exports directly to standard Unicode braille patterns and .BRF files, compatible with Orbit Reader 20, Braille Me, Focus 40 Blue, Index Braille embossers, and tactile swell paper printers.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
