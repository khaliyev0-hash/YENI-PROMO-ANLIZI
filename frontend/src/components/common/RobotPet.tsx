import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    id: 'excel_upload',
    question: 'Necə Excel yükləyirəm?',
    answer: 'Yuxarı paneldəki "Excel Yüklə" düyməsinə klikləyin. Şablon 1 (Promosiya Satış/Dağılım) və ya Şablon 2 (Service Level) faylınızı sürüşdürüb buraxın. Sütunlar avtomatik tanınacaq.'
  },
  {
    id: 'stockout',
    question: 'Stockout nə deməkdir?',
    answer: 'Promosiya dövründə mağazada məhsul stokunun 0-a düşməsi (tükənməsi) və alıcı tələbatının qarşılanmaması (Lost Sales) halıdır.'
  },
  {
    id: 'wape',
    question: 'WAPE göstəricisi nəyi bildirir?',
    answer: 'Weighted Absolute Percentage Error — Proqnozun faktiki satışlardan meyl faizidir. Aşağı göstərici (məs. < 15%) daha yüksək proqnoz dəqiqliyini göstərir.'
  },
  {
    id: 'dates',
    question: 'Kampaniya tarixləri necə müəyyən olunur?',
    answer: 'Excel daxilindəki "Başlama Tarixi" və "Bitmə Tarixi" sütunlarından avtomatik oxunur. Sütunlar olmadıqda standart kampaniya aralığı tətbiq olunur.'
  },
  {
    id: 'abc_xyz',
    question: 'ABC / XYZ analizi nədir?',
    answer: 'ABC məhsulları dövriyyə payına görə (A: 80%, B: 15%, C: 5%), XYZ isə satışların zaman üzrə sabitlik dəqiqliyinə görə təsnifatlandırır.'
  }
];

export const RobotPet: React.FC = () => {
  const { setShowUploadModal } = useData();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>('excel_upload');
  const [hovered, setHovered] = useState<boolean>(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // 1. Entrance animation (1s delay after page mount)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Organic random eye blinking (every 3 to 5 seconds)
  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;

    const scheduleNextBlink = () => {
      const randomDelay = Math.floor(Math.random() * 2000) + 3000; // 3000ms - 5000ms
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 160);
      }, randomDelay);
    };

    scheduleNextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 3. Close panel on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleRobotClick = () => {
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 350);
    setIsOpen(!isOpen);
  };

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  if (!visible) return null;

  return (
    <>
      {/* Inline Keyframe Animations */}
      <style>{`
        @keyframes petFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-9px); }
        }
        @keyframes petFloatFast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-11px); }
        }
        @keyframes petSway {
          0%, 100% { transform: rotate(-3.5deg); }
          50% { transform: rotate(3.5deg); }
        }
        @keyframes shadowScale {
          0%, 100% { transform: scaleX(1); opacity: 0.22; }
          50% { transform: scaleX(0.72); opacity: 0.08; }
        }
        @keyframes antennaSparkle {
          0%, 100% { transform: scale(0.85); opacity: 0.75; }
          50% { transform: scale(1.25); opacity: 1; filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.9)); }
        }
        @keyframes leftArmSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-10deg); }
        }
        @keyframes rightArmSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(10deg); }
        }

        .animate-pet-float {
          animation: petFloat 3.2s ease-in-out infinite;
        }
        .animate-pet-float-fast {
          animation: petFloatFast 1.6s ease-in-out infinite;
        }
        .animate-pet-sway {
          animation: petSway 4.4s ease-in-out infinite;
        }
        .animate-shadow-pulse {
          animation: shadowScale 3.2s ease-in-out infinite;
          transform-origin: center center;
        }
        .animate-antenna-sparkle {
          animation: antennaSparkle 1.8s ease-in-out infinite;
          transform-origin: 40px 13px;
        }
        .animate-left-arm {
          animation: leftArmSway 3.6s ease-in-out infinite;
          transform-origin: 22px 61px;
        }
        .animate-right-arm {
          animation: rightArmSway 3.6s ease-in-out infinite;
          transform-origin: 58px 61px;
        }
      `}</style>

      <div className="fixed bottom-6 right-2 z-50 flex flex-col items-end select-none">
        {/* Help Center Panel Popup */}
        {isOpen && (
          <div
            ref={panelRef}
            className="mb-4 w-80 sm:w-88 max-w-[calc(100vw-2rem)] max-h-[440px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center p-1 border border-white/30 backdrop-blur-xs">
                  {/* Mini Mascot Icon */}
                  <svg viewBox="0 0 40 40" className="w-full h-full text-amber-300" fill="none" stroke="currentColor">
                    <circle cx="20" cy="5" r="2.5" fill="#F59E0B" stroke="#FDE68A" strokeWidth="0.8" />
                    <line x1="20" y1="7.5" x2="20" y2="12" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
                    <rect x="8" y="12" width="24" height="18" rx="5" fill="#1E40AF" stroke="#60A5FA" strokeWidth="1.5" />
                    <circle cx="15" cy="20" r="2.5" fill="#67E8F9" />
                    <circle cx="25" cy="20" r="2.5" fill="#67E8F9" />
                    <path d="M16 26 Q20 28 24 26" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white tracking-wide leading-tight">
                    TamStore Kömək Mərkəzi
                  </h3>
                  <p className="text-[11px] text-blue-200/90 font-medium">Promo Intelligence Asistenti</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Bağla"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Accordion FAQ Body */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2 text-slate-700 dark:text-slate-200 text-xs">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-1 uppercase tracking-wider">
                Tez-tez Verilən Suallar
              </p>
              {FAQ_LIST.map((faq) => {
                const isExpanded = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full text-left p-3 font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 focus:outline-none cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        {faq.question}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                          isExpanded ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 text-slate-600 dark:text-slate-300 leading-relaxed border-t border-blue-100/60 dark:border-blue-900/40 font-sans">
                        <p className="mt-2">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Action */}
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sualınız var?</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowUploadModal(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Excel Yüklə</span>
              </button>
            </div>
          </div>
        )}

        {/* Speech Bubble Tooltip on Hover */}
        {hovered && !isOpen && (
          <div className="mb-2 px-3 py-1.5 bg-slate-900/95 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150 relative backdrop-blur-xs">
            <span>Kömək lazımdır?</span>
            <div className="absolute right-7 -bottom-1.5 w-3 h-3 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
          </div>
        )}

        {/* Freestanding Floating Robot Character Button */}
        <button
          onClick={handleRobotClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`w-20 h-24 relative flex flex-col items-center justify-center cursor-pointer group focus:outline-none transition-transform duration-200 ${
            isClicking ? 'scale-125' : ''
          }`}
          title="TamStore Kömək Asistenti"
        >
          {/* Custom Organic Vector SVG Robot */}
          <div className={`w-full h-20 ${hovered ? 'animate-pet-float-fast' : 'animate-pet-float'}`}>
            <div className="w-full h-full animate-pet-sway">
              <svg viewBox="0 0 80 90" className="w-full h-full drop-shadow-xl overflow-visible">
                <defs>
                  {/* Head Metallic Blue Gradient */}
                  <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1E3A8A" />
                  </linearGradient>

                  {/* Body Gradient */}
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="60%" stopColor="#1D4ED8" />
                    <stop offset="100%" stopColor="#1E1B4B" />
                  </linearGradient>

                  {/* Glass Visor Highlight */}
                  <linearGradient id="visorGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>

                  {/* Glow Filter for Chest Core */}
                  <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* 1. Antenna Stem */}
                <line x1="40" y1="16" x2="40" y2="25" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />
                
                {/* 2. Antenna Sparkle Top Dot */}
                <g className="animate-antenna-sparkle">
                  <circle cx="40" cy="13" r="4.5" fill="#F59E0B" stroke="#FDE68A" strokeWidth="1" />
                  <circle cx="40" cy="13" r="2" fill="#FFFFFF" />
                  {/* Sparkle Rays */}
                  <path d="M40 6 L40 8 M40 18 L40 20 M33 13 L35 13 M45 13 L47 13" stroke="#FDE68A" strokeWidth="1" strokeLinecap="round" />
                </g>

                {/* 3. Left Arm (Swinging) */}
                <g className="animate-left-arm">
                  <path
                    d="M20 59 C13 61, 12 68, 17 71"
                    stroke="#3B82F6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="17" cy="71" r="2" fill="#60A5FA" />
                </g>

                {/* 4. Right Arm (Swinging) */}
                <g className="animate-right-arm">
                  <path
                    d="M60 59 C67 61, 68 68, 63 71"
                    stroke="#3B82F6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="63" cy="71" r="2" fill="#60A5FA" />
                </g>

                {/* 5. Head Container */}
                <rect x="20" y="24" width="40" height="30" rx="11" fill="url(#headGrad)" stroke="#60A5FA" strokeWidth="1.5" />
                
                {/* Head Top Glass Highlight */}
                <path d="M23 27 Q40 24 57 27" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />

                {/* Side Bolt Ear Accents */}
                <rect x="16" y="34" width="4" height="10" rx="2" fill="#60A5FA" />
                <rect x="60" y="34" width="4" height="10" rx="2" fill="#60A5FA" />

                {/* 6. Dark Screen Visor */}
                <rect x="23" y="27" width="34" height="24" rx="8" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" />
                <rect x="23" y="27" width="34" height="24" rx="8" fill="url(#visorGlass)" />

                {/* 7. Expressive Eyes (With Organic Blinking & Enlarge on Hover/Open) */}
                {isBlinking ? (
                  <>
                    {/* Blinking Blink Lines */}
                    <line x1="28" y1="38" x2="35" y2="38" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="45" y1="38" x2="52" y2="38" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    {/* Left Eye */}
                    <circle
                      cx="31.5"
                      cy="37"
                      r={isOpen || hovered ? '5.2' : '4.4'}
                      fill="#FFFFFF"
                      className="transition-all duration-200"
                    />
                    <circle
                      cx="31.5"
                      cy="37"
                      r={isOpen || hovered ? '3.2' : '2.6'}
                      fill="#0284C7"
                      className="transition-all duration-200"
                    />
                    <circle cx="30" cy="35.5" r="1.2" fill="#FFFFFF" />

                    {/* Right Eye */}
                    <circle
                      cx="48.5"
                      cy="37"
                      r={isOpen || hovered ? '5.2' : '4.4'}
                      fill="#FFFFFF"
                      className="transition-all duration-200"
                    />
                    <circle
                      cx="48.5"
                      cy="37"
                      r={isOpen || hovered ? '3.2' : '2.6'}
                      fill="#0284C7"
                      className="transition-all duration-200"
                    />
                    <circle cx="47" cy="35.5" r="1.2" fill="#FFFFFF" />
                  </>
                )}

                {/* 8. Happy Smiling Mouth */}
                <path
                  d={isOpen || hovered ? "M32 44 Q40 49 48 44" : "M33 44 Q40 47 47 44"}
                  stroke="#38BDF8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* 9. Neck Joint Bar */}
                <rect x="35" y="53.5" width="10" height="4.5" rx="2" fill="#94A3B8" />

                {/* 10. Torso / Body Capsule */}
                <path
                  d="M25 57 C25 54, 55 54, 55 57 L52 75 C52 78, 28 78, 28 75 Z"
                  fill="url(#bodyGrad)"
                  stroke="#60A5FA"
                  strokeWidth="1.5"
                />

                {/* Body Tech Detail Accent Lines */}
                <path d="M28 62 L52 62" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

                {/* 11. Chest Glowing Cyan Core Indicator */}
                <circle cx="40" cy="67" r="3.5" fill="#22D3EE" filter="url(#cyanGlow)" />
                <circle cx="40" cy="67" r="1.5" fill="#FFFFFF" />
              </svg>
            </div>
          </div>

          {/* Ground Soft Shadow Ellipse (Contracts/Expands in Sync with Floating) */}
          <svg viewBox="0 0 80 12" className="w-16 h-3 -mt-1 pointer-events-none">
            <ellipse
              cx="40"
              cy="6"
              rx="18"
              ry="4"
              fill="#0F172A"
              className="animate-shadow-pulse"
            />
          </svg>
        </button>
      </div>
    </>
  );
};

export default RobotPet;
