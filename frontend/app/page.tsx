import Link from 'next/link';
import SparshLogo from '@/components/ui/SparshLogo';

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    color: 'border-white/10',
    btnStyle: 'bg-white/10 text-white hover:bg-white/20',
    features: [
      'Access to NCERT library',
      'Basic ISL avatar',
      'Community support',
    ],
    notIncluded: ['Upload own PDFs/Videos', 'Sign Lab AI Practice', 'Live classes', 'Offline mode'],
  },
  {
    name: 'Learner Pro',
    price: '₹149',
    period: 'per month',
    color: 'border-pink-500/50',
    badge: 'For Students',
    btnStyle: 'bg-pink-500 text-white font-bold hover:bg-pink-600',
    features: [
      'Upload PDFs for Braille/TTS',
      'Upload Videos for ISL Avatar',
      'AI Sign Lab Practice',
      'Personal Study AI Tutor',
      'Offline mode (PWA)',
    ],
    notIncluded: ['Teacher dashboard', 'Compliance reports'],
  },
  {
    name: 'Pro',
    price: '₹2,999',
    period: 'per month',
    color: 'border-[#6C63FF]',
    badge: 'Most Popular',
    btnStyle: 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white hover:opacity-90',
    features: [
      '300 students',
      '20 teachers',
      'Unlimited lessons',
      'Full ISL avatar',
      'Sign Lab access',
      'Live classes (Daily.co)',
      'PDF Reports',
      'Offline mode (PWA)',
      'Priority support',
    ],
    notIncluded: ['Braille export', 'White-label', 'API access'],
  },
  {
    name: 'Institution',
    price: '₹14,999',
    period: 'per month',
    color: 'border-[#00C9A7]',
    btnStyle: 'bg-[#00C9A7] text-black font-bold hover:bg-[#00b894]',
    features: [
      '1,000 students',
      'Unlimited teachers',
      'Unlimited lessons',
      'All Pro features',
      'Braille export (HID)',
      'DeafBlind mode',
      'Bhashini translation',
      'RPwD compliance report',
      'Dedicated success manager',
    ],
    notIncluded: ['White-label', 'Custom AI models'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    color: 'border-yellow-500/40',
    btnStyle: 'bg-yellow-500 text-black font-bold hover:bg-yellow-400',
    features: [
      'Unlimited everything',
      'White-label deployment',
      'Custom AI models',
      'On-premises option',
      'API access',
      'SLA guarantee',
      '24/7 dedicated support',
      'Government procurement ready',
      'GIGW compliance',
    ],
    notIncluded: [],
  },
];

const FEATURES = [
  { icon: '🤟', title: 'ISL Avatar', desc: 'AI-generated Indian Sign Language interpretation overlay on every lesson video.' },
  { icon: '💬', title: 'Live Captions', desc: 'Whisper-powered auto-captions with 97%+ accuracy in Hindi and English.' },
  { icon: '🔊', title: 'Text-to-Speech', desc: 'Multi-language TTS narration for visually impaired students via ElevenLabs.' },
  { icon: '⠿', title: 'Braille Support', desc: 'HID Braille display connectivity for DeafBlind learners.' },
  { icon: '📡', title: 'Live Classes', desc: 'Real-time video classes via Daily.co with embedded ISL and captions.' },
  { icon: '📱', title: 'PWA Native App', desc: 'Install on any device — works offline, feels native.' },
  { icon: '🤖', title: 'AI Sign Lab', desc: 'Practice ISL signs with your camera and MediaPipe AI grading.' },
  { icon: '📊', title: 'Compliance Reports', desc: 'Auto-generated RPwD Act 2016 and NEP 2020 compliance documentation.' },
];

const STATS = [
  { value: '2.68Cr', label: 'Persons with Disabilities in India' },
  { value: '97%', label: 'Caption Accuracy (Whisper)' },
  { value: '100%', label: 'NCERT-Aligned Curriculum' },
  { value: '42+', label: 'Institutions on Platform' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/10"
        style={{ background: 'rgba(15,12,41,0.85)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <SparshLogo size="sm" href="/" showTagline={false} />
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-white/60 hover:text-white text-sm transition">Features</a>
            <a href="#pricing" className="text-white/60 hover:text-white text-sm transition">Pricing</a>
            <a href="#accessibility" className="text-white/60 hover:text-white text-sm transition">Accessibility</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"><button className="px-4 py-2 text-white/70 text-sm hover:text-white transition">Login</button></Link>
            <Link href="/register"><button className="px-4 py-2 bg-[#6C63FF] text-white text-sm font-semibold rounded-xl hover:bg-[#5b54e6] transition">Get Started Free</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 text-[#6C63FF] text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse" />
          Accessible by design. Inclusive by default.
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
          Education for
          <br />
          <span className="bg-gradient-to-r from-[#6C63FF] via-[#a29bfe] to-[#00C9A7] bg-clip-text text-transparent">
            Every Student
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
          AI-powered accessible education platform for visually impaired, hearing impaired, and DeafBlind students across India. NCERT-aligned, ISL-ready, and RPwD compliant.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <button className="px-8 py-4 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold rounded-2xl text-lg hover:opacity-90 transition w-full sm:w-auto">
              Start Free Today →
            </button>
          </Link>
          <Link href="/login">
            <button className="px-8 py-4 bg-white/10 border border-white/20 text-white font-semibold rounded-2xl text-lg hover:bg-white/20 transition w-full sm:w-auto">
              Watch Demo 🎥
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
          {STATS.map((s, i) => (
            <div key={i} className="glass-card p-4 rounded-2xl text-center">
              <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] bg-clip-text text-transparent">{s.value}</p>
              <p className="text-white/50 text-xs sm:text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Built for Accessibility</h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">Every feature is designed to remove barriers and empower learners of all abilities.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card p-6 rounded-2xl hover:border-[#6C63FF]/40 transition group">
              <span className="text-4xl block mb-3">{f.icon}</span>
              <h3 className="text-white font-bold mb-2 group-hover:text-[#6C63FF] transition">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Accessibility Showcase */}
      <section id="accessibility" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="glass-card p-8 sm:p-12 rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="px-3 py-1 bg-[#00C9A7]/20 text-[#00C9A7] text-xs rounded-full font-medium">RPwD Act 2016 Compliant</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 mb-4">Every Student Deserves to Learn</h2>
              <p className="text-white/60 leading-relaxed mb-6">Sparsh is built ground-up for inclusive education. Whether your students are deaf, blind, or DeafBlind, our AI stack — ISL avatars, real-time captions, TTS, Braille HID — ensures no one is left behind.</p>
              <div className="space-y-3">
                {[
                  { icon: '🤟', text: 'AI-generated ISL interpretation on 100% of lessons' },
                  { icon: '💬', text: 'Whisper-powered captions with 97%+ accuracy in Hindi/English' },
                  { icon: '⠿', text: 'HID Braille display protocol support' },
                  { icon: '🌐', text: 'Bhashini API for 22 Indian language translations' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <p className="text-white/80 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Hearing Impaired', icon: '👂', pct: '40%', desc: 'ISL + Captions' },
                { label: 'Visually Impaired', icon: '👁️', pct: '29%', desc: 'TTS + Braille' },
                { label: 'Multi-Sensory', icon: '🧠', pct: '14%', desc: 'Combined aids' },
                { label: 'DeafBlind', icon: '🤲', pct: '7%', desc: 'Switch + Braille' },
              ].map((d, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-5 text-center">
                  <span className="text-3xl block mb-2">{d.icon}</span>
                  <p className="text-white font-bold">{d.label}</p>
                  <p className="text-[#6C63FF] text-xl font-black">{d.pct}</p>
                  <p className="text-white/40 text-xs mt-1">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Simple, Transparent Pricing</h2>
          <p className="text-white/50 text-lg">Start free. Scale as you grow. No hidden fees.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          {PLANS.map((plan, i) => (
            <div key={i} className={`glass-card p-6 rounded-2xl flex flex-col border-2 ${plan.color} ${i === 1 ? 'ring-2 ring-[#6C63FF]/30 scale-105 relative' : ''}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#6C63FF] text-white text-xs font-bold rounded-full">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
              <div className="mb-5">
                <span className="text-3xl font-black text-white">{plan.price}</span>
                <span className="text-white/40 text-sm ml-1">/{plan.period}</span>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-white/80">
                    <span className="text-[#00C9A7] shrink-0">✓</span> {f}
                  </li>
                ))}
                {plan.notIncluded.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-white/30">
                    <span className="shrink-0">✕</span> {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === 'Enterprise' ? 'mailto:enterprise@sparsh.edu.in' : '/register'}>
                <button className={`w-full py-3 rounded-xl font-semibold transition ${plan.btnStyle}`}>
                  {plan.name === 'Free' ? 'Start Free' : plan.name === 'Enterprise' ? 'Contact Sales' : `Get ${plan.name}`}
                </button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 max-w-3xl mx-auto text-center">
        <div className="glass-card p-10 rounded-3xl">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Transform Learning?</h2>
          <p className="text-white/60 mb-8 text-lg">Join 42+ institutions empowering students with disabilities across India.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <button className="px-8 py-4 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold rounded-2xl text-lg hover:opacity-90 transition w-full sm:w-auto">
                Start Free Today →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <SparshLogo size="sm" href="/" showTagline={false} />
          <p className="text-white/30 text-sm text-center">
            © 2026 Sparsh Education Pvt. Ltd. • Built for India&apos;s 2.68 crore persons with disabilities
          </p>
          <div className="flex gap-4 text-sm">
            <a href="#" className="text-white/30 hover:text-white/60 transition">Privacy</a>
            <a href="#" className="text-white/30 hover:text-white/60 transition">Terms</a>
            <a href="mailto:support@sparsh.edu.in" className="text-white/30 hover:text-white/60 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
