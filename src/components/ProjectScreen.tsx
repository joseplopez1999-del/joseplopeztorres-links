import { useEffect, useState } from 'react';

type Props = Readonly<{ onClose: () => void }>;
type Step = 'form' | 'success' | 'error';

const SERVICE_GROUPS: { label: string; options: string[] }[] = [
  {
    label: 'IA & Automatización',
    options: [
      'Automatizaciones con IA',
      'Chatbot con IA',
      'Agente IA personalizado',
      'Análisis de datos',
      'Generación de contenido con IA',
    ],
  },
  {
    label: 'SEO',
    options: [
      'Auditoría SEO',
      'Keyword Research',
      'Arquitectura web',
      'SEO On-Page',
      'Link Building',
      'SEO Local',
    ],
  },
  {
    label: 'Marketing Digital',
    options: [
      'Estrategia de marketing',
      'Google Ads / SEM',
      'Meta Ads (Facebook & Instagram)',
      'Plan de marketing',
      'Estrategia de contenidos',
    ],
  },
  {
    label: 'Web',
    options: [
      'Creación de web',
      'WordPress',
      'Shopify',
    ],
  },
];

export default function ProjectScreen({ onClose }: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [service, setService] = useState('');
  const [customService, setCustomService] = useState('');
  const [description, setDescription] = useState('');
  const [occupation, setOccupation] = useState('');
  const [socialAccounts, setSocialAccounts] = useState('');
  const [wantsAudit, setWantsAudit] = useState<'si' | 'no' | ''>('');
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
    if (!name || !contact) return;
    setLoading(true);
    try {
      const finalService = service === 'Otro' ? `Otro: ${customService}` : service;
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, service: finalService, description, occupation, socialAccounts, wantsAudit }),
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
              Nuevo proyecto
            </p>
            <h2 className="mb-1 font-sans text-xl font-bold text-white">¿Cuándo empezamos?</h2>
            <p className="mb-5 font-sans text-xs leading-relaxed text-white/40">
              Cuéntame qué necesitas. Te respondo en menos de 24h.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nombre y contacto */}
              <input
                type="text"
                required
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
              />
              <input
                type="text"
                required
                placeholder="Email o WhatsApp"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
              />

              {/* Servicios por grupo */}
              <div className="space-y-3">
                <label className="block font-sans text-[11px] font-medium text-white/40">
                  ¿Qué servicio buscas?
                </label>
                {SERVICE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-[#c9824a]/40">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setService(opt)}
                          className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                            service === opt
                              ? 'bg-[#c9824a] text-[#120c07]'
                              : 'border border-white/10 bg-white/5 text-white/60 hover:border-[#c9824a]/40'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Otro — estilo propio, fuera de la lógica de servicios */}
              <div className="flex flex-col items-start gap-2 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setService(service === 'Otro' ? '' : 'Otro')}
                  className="group flex items-center gap-2"
                >
                  <span className={`text-base transition-transform duration-200 ${service === 'Otro' ? 'rotate-45' : 'rotate-0'}`}>✦</span>
                  <span className={`font-serif text-base italic transition-colors ${
                    service === 'Otro' ? 'text-[#c4b5fd]' : 'text-white/50 group-hover:text-white/80'
                  }`}>
                    Tengo algo diferente en mente
                  </span>
                </button>
                {service === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Descríbelo en pocas palabras..."
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    className="w-full rounded-xl border border-[#c9824a]/30 bg-white/5 px-4 py-3 font-sans text-sm text-white placeholder-white/30 outline-none focus:border-[#c9824a]/50"
                    autoFocus
                  />
                )}
              </div>

              {/* Auditoría */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿Quieres empezar con una auditoría de tu situación actual?
                </label>
                <div className="flex gap-2">
                  {(['si', 'no'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWantsAudit(val)}
                      className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium capitalize transition-colors ${
                        wantsAudit === val
                          ? 'bg-[#c9824a] text-[#120c07]'
                          : 'border border-white/10 bg-white/5 text-white/60 hover:border-[#c9824a]/40'
                      }`}
                    >
                      {val === 'si' ? 'Sí' : 'No'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuéntame tu proyecto */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  Cuéntame tu proyecto
                </label>
                <textarea
                  placeholder="Necesito automatizar mis facturas, crear un chatbot para..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-sans text-sm text-white placeholder-white/30 outline-none focus:border-[#c9824a]/50"
                />
              </div>

              {/* Contexto extra */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿A qué te dedicas?
                </label>
                <input
                  type="text"
                  placeholder="Emprendedor, clínica, tienda online..."
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-sans text-[11px] font-medium text-white/40">
                  ¿Qué cuentas de RRSS gestionas?
                </label>
                <input
                  type="text"
                  placeholder="Instagram @tutienda, TikTok, LinkedIn..."
                  value={socialAccounts}
                  onChange={(e) => setSocialAccounts(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 font-sans text-sm text-white placeholder-white/25 outline-none transition-colors duration-200 focus:border-[#c9824a]/60 focus:bg-white/[0.07]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name || !contact}
                className="w-full rounded-2xl bg-[#c9824a] py-3 font-sans text-sm font-semibold text-[#120c07] shadow-[0_0_24px_rgba(201,130,74,0.35)] transition-all duration-200 hover:shadow-[0_0_32px_rgba(201,130,74,0.55)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="py-6 text-center">
            <p className="mb-3 text-4xl">🚀</p>
            <h2 className="mb-1 font-sans text-xl font-bold text-white">Recibido.</h2>
            <p className="mb-6 font-sans text-xs leading-relaxed text-white/40">
              Te respondo en menos de 24 horas.
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
