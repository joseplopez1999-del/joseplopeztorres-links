import { useEffect, useState } from 'react';

type Props = Readonly<{ onClose: () => void }>;
type Step = 'form' | 'success' | 'error';

const SOURCE_OPTIONS = [
  'TikTok (@josepltpianoestudio)',
  'TikTok (@___xus___)',
  'Instagram',
  'GitHub',
  'Me lo recomendaron',
  'Búsqueda en Google',
  'Otro',
];

export default function NewsletterScreen({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [location, setLocation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, location, occupation, about }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setStep('success');
      } else {
        setErrorMsg(data.error ?? 'Algo salió mal.');
        setStep('error');
      }
    } catch {
      setErrorMsg('No se pudo conectar. Inténtalo de nuevo.');
      setStep('error');
    }
    setLoading(false);
  };

  return (
    <div
      className="absolute inset-0 z-[150] flex items-end justify-center rounded-[34px] bg-black/60 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90%] w-full overflow-y-auto rounded-t-[32px] bg-gradient-to-b from-[#1c140d] to-[#0b0806] px-6 pb-10 pt-5 shadow-[0_-8px_48px_rgba(0,0,0,0.7)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-1 w-10 rounded-full bg-white/20" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/50 transition-colors hover:bg-white/20 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {step === 'form' && (
          <>
            <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-[#c9824a]/60">
              Lista de espera
            </p>
            <h2 className="mb-1 font-sans text-xl font-bold text-white">Cuéntame un poco</h2>
            <p className="mb-5 font-sans text-xs leading-relaxed text-white/40">
              Sin spam. Sin urgencia falsa. Te escribo cuando valga la pena.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">

              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
              />

              {/* ¿Dónde me conociste? */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿Dónde me conociste?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSource(opt)}
                      className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                        source === opt
                          ? 'bg-[#c9824a] text-[#120c07]'
                          : 'border border-white/10 bg-white/5 text-white/60 hover:border-[#c9824a]/40'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* ¿De dónde eres? */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿De dónde eres?
                </label>
                <input
                  type="text"
                  placeholder="Valencia, Madrid, México..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
                />
              </div>

              {/* ¿A qué te dedicas? */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿A qué te dedicas?
                </label>
                <input
                  type="text"
                  placeholder="Desarrollador, músico, emprendedor..."
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
                />
              </div>

              {/* ¿En qué estás trabajando? */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿En qué estás trabajando? (opcional)
                </label>
                <textarea
                  placeholder="Estoy construyendo una app de IA para..."
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-2xl bg-[#c9824a] py-3 font-sans text-sm font-semibold text-[#120c07] shadow-[0_0_24px_rgba(201,130,74,0.35)] transition-all duration-200 hover:shadow-[0_0_32px_rgba(201,130,74,0.55)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? 'Enviando...' : 'Apúntame'}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="py-6 text-center">
            <p className="mb-3 text-4xl">✌️</p>
            <h2 className="mb-1 font-sans text-xl font-bold text-white">Anotado.</h2>
            <p className="mb-6 font-sans text-xs leading-relaxed text-white/40">
              Te escribo cuando haya algo que merezca tu atención.
            </p>
            <button type="button" onClick={onClose}
              className="font-sans text-sm font-medium text-[#c9824a]">
              Cerrar
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6 text-center">
            <p className="mb-3 text-4xl">🤔</p>
            <h2 className="mb-1 font-sans text-xl font-bold text-white">Algo falló.</h2>
            <p className="mb-4 font-sans text-xs text-white/40">{errorMsg}</p>
            <button type="button" onClick={() => setStep('form')}
              className="font-sans text-sm font-medium text-[#c9824a]">
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
