import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, ExternalLink, ChevronLeft, ChevronRight, Building2, BriefcaseBusiness, CalendarDays, IndianRupee, Landmark, Package2, ShieldCheck, TrendingUp, Users, Factory, Globe2 } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from 'recharts'
import StatCard from '../components/StatCard'
import RadialGauge from '../components/RadialGauge'
import ProjectCard from '../components/ProjectCard'
import ProjectMapSafe from '../components/ProjectMapSafe'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { projects, sectorPerformance, healthBreakdown } from '../data/mockData'
import { getMapProjects, getPortfolioSummary } from '../services/api'
import type { MapProject, PortfolioSummary, Project } from '../types'

import slide1 from '../assests/slide1.png'
import slide2 from '../assests/slide2.png'
import slide3 from '../assests/slide3.png'
import slide4 from '../assests/slide4.png'
import slide5 from '../assests/slide5.png'

import introVideo from '../assests/intro1.mp4'

const carouselSlides = [
  { 
    img: slide1, 
    title: 'Kempegowda International Airport (BLR)', 
    url: 'https://en.wikipedia.org/wiki/Kempegowda_International_Airport' 
  },
  { 
    img: slide2, 
    title: 'Western Ghats Vande Bharat Testing Track', 
    url: 'https://www.thehindu.com/news/cities/Mangalore/swr-conducts-runtime-trial-run-of-vande-bharat-express-between-yeshwantpur-mangaluru/article71432477.ece' 
  },
  { 
    img: slide3, 
    title: 'Delhi–Mumbai National Expressway (NE-4)', 
    url: 'https://en.wikipedia.org/wiki/Delhi%E2%80%93Mumbai_Expressway ' 
  },
  { 
    img: slide4, 
    title: 'Vande Bharat High-Speed Fleet Expansion', 
    url: 'https://en.wikipedia.org/wiki/Vande_Bharat' 
  },
  { 
    img: slide5, 
    title: 'Kamuthi Clean Energy Solar Power Infrastructure', 
    url: 'https://en.wikipedia.org/wiki/Kamuthi_Solar_Power_Station' 
  },
]

const highValueProjects = [
  {
    sector: 'Public Transport',
    organization: 'Chennai Metro Rail Limited [CMRL]',
    project: 'Chennai Metro Rail Phase-II Development',
    originalCost: '₹63,246 Cr',
    progress: 56,
    revisedCost: '₹78,910 Cr',
    revisedCompletion: '31/08/2029',
  },
  {
    sector: 'Telecommunication',
    organization: 'Department of Telecommunications [DoT]',
    project: 'BharatNet',
    originalCost: '₹61,109 Cr',
    progress: 100,
    revisedCost: '₹12,709 Cr',
    revisedCompletion: '31/12/2025',
  },
  {
    sector: 'Oil & Gas',
    organization: 'Bharat Petroleum Corporation Limited [BPCL]',
    project: 'Ethylene Cracker Project at Bina',
    originalCost: '₹43,367 Cr',
    progress: 34,
    revisedCost: '₹43,367 Cr',
    revisedCompletion: '31/05/2028',
  },
  {
    sector: 'Electricity Generation',
    organization: 'National Thermal Power Corporation [NTPC]',
    project: 'Meja Thermal Power Project, Unit-II',
    originalCost: '₹38,358 Cr',
    progress: 0,
    revisedCost: '₹38,358 Cr',
    revisedCompletion: '31/12/2032',
  },
  {
    sector: 'Real Estate',
    organization: 'National Buildings Construction Corporation [NBCC]',
    project: 'Redevelopment of Seven General Pool Residential Colonies',
    originalCost: '₹32,850 Cr',
    progress: 47,
    revisedCost: '₹32,841 Cr',
    revisedCompletion: '31/12/2025',
  },
  {
    sector: 'Power & Renewable Energy',
    organization: 'Solar Energy Corporation of India [SECI]',
    project: 'National Renewable Energy Infrastructure',
    originalCost: '₹29,840 Cr',
    progress: 68,
    revisedCost: '₹31,205 Cr',
    revisedCompletion: '31/03/2028',
  },
]

const summaryData = {
  ministry: [
    {
      key: 'DWR, RD & GR',
      name: 'Department of Water Resources, River Development & GR',
      projectCount: 38,
      originalCost: '₹ 100,526.50',
      revisedCost: '₹ 201,149.07',
      expenditure: '₹ 142,168.88',
      completed: 0,
      newAdded: 0,
      label: 'as of July, 2026',
    },
    {
      key: 'MoHUA',
      name: 'Ministry of Housing & Urban Affairs',
      projectCount: 42,
      originalCost: '₹ 88,420.30',
      revisedCost: '₹ 104,782.16',
      expenditure: '₹ 76,904.51',
      completed: 2,
      newAdded: 1,
      label: 'as of July, 2026',
    },
    {
      key: 'MoRTH',
      name: 'Ministry of Road Transport & Highways',
      projectCount: 61,
      originalCost: '₹ 172,384.00',
      revisedCost: '₹ 198,624.42',
      expenditure: '₹ 132,846.21',
      completed: 3,
      newAdded: 2,
      label: 'as of July, 2026',
    },
    {
      key: 'DHE',
      name: 'Department of Higher Education',
      projectCount: 27,
      originalCost: '₹ 41,208.75',
      revisedCost: '₹ 46,892.13',
      expenditure: '₹ 30,116.70',
      completed: 1,
      newAdded: 1,
      label: 'as of July, 2026',
    },
    {
      key: 'MoR',
      name: 'Ministry of Railways',
      projectCount: 54,
      originalCost: '₹ 214,502.60',
      revisedCost: '₹ 238,904.85',
      expenditure: '₹ 164,725.40',
      completed: 4,
      newAdded: 2,
      label: 'as of July, 2026',
    },
  ],
  sector: [
    {
      key: 'Roads',
      name: 'Road Transport & Highways',
      projectCount: 61,
      originalCost: '₹ 172,384.00',
      revisedCost: '₹ 198,624.42',
      expenditure: '₹ 132,846.21',
      completed: 3,
      newAdded: 2,
      label: 'sector-wise snapshot',
    },
    {
      key: 'Railways',
      name: 'Railways',
      projectCount: 54,
      originalCost: '₹ 214,502.60',
      revisedCost: '₹ 238,904.85',
      expenditure: '₹ 164,725.40',
      completed: 4,
      newAdded: 2,
      label: 'sector-wise snapshot',
    },
    {
      key: 'Energy',
      name: 'Power & Renewable Energy',
      projectCount: 48,
      originalCost: '₹ 158,904.20',
      revisedCost: '₹ 176,218.64',
      expenditure: '₹ 121,560.18',
      completed: 2,
      newAdded: 3,
      label: 'sector-wise snapshot',
    },
    {
      key: 'Urban',
      name: 'Urban Infrastructure',
      projectCount: 42,
      originalCost: '₹ 88,420.30',
      revisedCost: '₹ 104,782.16',
      expenditure: '₹ 76,904.51',
      completed: 2,
      newAdded: 1,
      label: 'sector-wise snapshot',
    },
    {
      key: 'Water',
      name: 'Water Resources',
      projectCount: 38,
      originalCost: '₹ 100,526.50',
      revisedCost: '₹ 201,149.07',
      expenditure: '₹ 142,168.88',
      completed: 0,
      newAdded: 0,
      label: 'sector-wise snapshot',
    },
  ],
}

const spark = (data: number[], color: string) => (
  <ResponsiveContainer width={64} height={28}>
    <LineChart data={data.map((v, i) => ({ i, v }))}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
)

export default function Dashboard() {
  const navigate = useNavigate()
  
  // Persistence Check to prevent repeating video splash
  const [showIntro, setShowIntro] = useState(() => {
    const hasSeenIntro = sessionStorage.getItem('hasSeenPaimanaIntro')
    return hasSeenIntro !== 'true'
  })
  
  const [animateOut, setAnimateOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [attentionList, setAttentionList] = useState<Project[]>(() => {
    return projects
      .filter((p) => p.status !== 'On Track')
      .concat(projects.filter((p) => p.status === 'On Track'))
      .slice(0, 6)
  })

  useEffect(() => {
    getPortfolioSummary()
      .then((summary) => {
        setPortfolioSummary(summary)
        if (summary?.top_risk_projects && summary.top_risk_projects.length > 0) {
          setAttentionList(summary.top_risk_projects)
        }
      })
      .catch((err) => console.warn('Could not load portfolio summary', err))
  }, [])

  useEffect(() => {
    let alive = true
    getMapProjects()
      .then((res) => {
        if (alive) setMapProjects(res.projects)
      })
      .catch((err) => console.warn('Could not load map projects', err))
    return () => {
      alive = false
    }
  }, [])

  const [currentSlide, setCurrentSlide] = useState(0)
  const [highValueStart, setHighValueStart] = useState(0)
  const [summaryMode, setSummaryMode] = useState<'ministry' | 'sector'>('ministry')
  const [selectedSummaryIndex, setSelectedSummaryIndex] = useState(0)
  const [mapProjects, setMapProjects] = useState<MapProject[]>([])

  const mapRiskStats = useMemo(() => {
    const total = mapProjects.length
    const atRisk = mapProjects.filter((p) => p.status === 'At Risk').length
    const watch = mapProjects.filter((p) => p.status === 'Watch').length
    const onTrack = mapProjects.filter((p) => p.status === 'On Track').length
    const avgRisk = total
      ? Math.round(mapProjects.reduce((sum, p) => sum + (p.risk_score ?? 0), 0) / total)
      : 0
    return { total, atRisk, watch, onTrack, avgRisk }
  }, [mapProjects])

  const summaryList = summaryData[summaryMode]
  const selectedSummary = summaryList[selectedSummaryIndex] ?? summaryList[0]
  const selectorItems = summaryList.slice(0, 5)
  
  // Click-and-drag Swipe Trackers
  const [dragStartX, setDragStartX] = useState(0)
  const isDragging = useRef(false)

  // Video intro timelines
  useEffect(() => {
    if (!showIntro) return

    if (videoRef.current) {
      videoRef.current.playbackRate = 2.0
    }
    const fadeTimer = setTimeout(() => setAnimateOut(true), 3000)
    const hideTimer = setTimeout(() => {
      setShowIntro(false)
      sessionStorage.setItem('hasSeenPaimanaIntro', 'true')
    }, 3400)
    
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [showIntro])

  // Auto-play interval loop
  useEffect(() => {
    if (showIntro) return
    const timer = setInterval(() => {
      handleNextSlide()
    }, 5000)
    return () => clearInterval(timer)
  }, [showIntro, currentSlide])

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
  }

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)
  }

  const highValueScrollRef = useRef<HTMLDivElement>(null)

  const handleHighValuePrev = () => {
    if (highValueScrollRef.current) {
      highValueScrollRef.current.scrollBy({ left: -340, behavior: 'smooth' })
    }
  }

  const handleHighValueNext = () => {
    if (highValueScrollRef.current) {
      highValueScrollRef.current.scrollBy({ left: 340, behavior: 'smooth' })
    }
  }

  const handleSummaryPrev = () => {
    setSelectedSummaryIndex((prev) => (prev - 1 + summaryList.length) % summaryList.length)
  }

  const handleSummaryNext = () => {
    setSelectedSummaryIndex((prev) => (prev + 1) % summaryList.length)
  }

  // Swipe handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartX(e.clientX)
    isDragging.current = false
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartX === 0) return
    if (Math.abs(e.clientX - dragStartX) > 10) {
      isDragging.current = true
    }
  }

  const handleMouseUp = (e: React.MouseEvent, url: string) => {
    const dragDistance = e.clientX - dragStartX
    setDragStartX(0)

    if (isDragging.current) {
      if (dragDistance > 50) {
        handlePrevSlide()
      } else if (dragDistance < -50) {
        handleNextSlide()
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  if (showIntro) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ease-in-out ${animateOut ? 'opacity-0' : 'opacity-100'}`}>
        <video ref={videoRef} src={introVideo} autoPlay muted playsInline className="w-full h-full object-contain sm:object-cover bg-white" />
      </div>
    )
  }

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out">
      
      {/* Interactive Carousel Panel Layer Block */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-md group">
        
        {/* Track Slider Wrapper */}
        <div className="relative w-full h-[320px] sm:h-[400px] overflow-hidden z-0">
          {carouselSlides.map((slide, idx) => (
            <div
              key={idx}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={(e) => handleMouseUp(e, slide.url)}
              className={`absolute inset-0 cursor-grab active:cursor-grabbing select-none transition-all duration-1000 ease-in-out transform ${
                idx === currentSlide 
                  ? 'opacity-100 translate-x-0 scale-100' 
                  : idx < currentSlide 
                    ? 'opacity-0 -translate-x-full scale-95' 
                    : 'opacity-0 translate-x-full scale-95'
              }`}
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 pointer-events-none" 
                style={{ backgroundImage: `url(${slide.img})` }}
              />
              
              {/* Soft Dark Vignette Shield Layer */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent pointer-events-none" />
              
              {/* BRIGHTENED TEXT LAYER ELEMENTS */}
              <div className="absolute bottom-6 left-6 sm:left-12 z-20 text-white max-w-md sm:max-w-xl pointer-events-none">
                <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500 text-slate-950 px-2 py-1 rounded font-sans shadow-md">
                  National Asset
                </span>
                <h4 className="font-display text-lg sm:text-2xl font-black mt-3 flex items-center gap-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                  {slide.title} 
                  <ExternalLink size={16} className="text-brand-orange opacity-100 drop-shadow-md flex-shrink-0" />
                </h4>
              </div>
            </div>
          ))}
          
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/30 dark:to-ink-950/60" />
        </div>

        {/* Floating Hero Center Titles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-2/3 w-full max-w-2xl px-6 text-center pointer-events-none z-10">
          <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold leading-[1.1] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
            Monitoring India's infrastructure.{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent block mt-1 drop-shadow-none">
              Viksit Bharat.
            </span>
          </h1>
          <p className="mt-4 max-w-md mx-auto text-[11px] sm:text-sm text-slate-100 font-medium drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)] leading-relaxed">
            An intelligence layer transforming national asset pathways into actionable indicators.
          </p>
          
          <div className="mt-6 flex flex-row gap-4 justify-center pointer-events-auto">
            <Link
              to="/intelligence"
              className="flex items-center gap-2 rounded-full bg-brand-orange hover:bg-brand-orangeDark text-white px-6 py-2.5 text-xs font-bold transition-all shadow-lg active:scale-95"
            >
              Explore Intelligence <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Manual Chevron Switcher Buttons */}
        <button
          onClick={handlePrevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10"
          aria-label="Previous Slide"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={handleNextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10"
          aria-label="Next Slide"
        >
          <ChevronRight size={20} />
        </button>

        {/* Bottom Progress Dot Strip */}
        <div className="absolute bottom-4 right-6 sm:right-12 z-20 flex gap-2">
          {carouselSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentSlide ? 'w-6 bg-brand-orange' : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>


      {/* KPI row */}


      {/* KPI row */}


      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="TOTAL PROJECTS" value={portfolioSummary ? `${portfolioSummary.total_projects}` : "317"} delta="Active ML catalog" sparkline={spark([10, 14, 12, 18, 20, 24], '#3FC1D6')} />
        <StatCard label="PORTFOLIO HEALTH" value={portfolioSummary ? `${portfolioSummary.avg_health}/100` : "74.5/100"} delta="ML composite index" sparkline={spark([8, 10, 9, 13, 15, 17], '#1FAE7A')} />
        <StatCard label="AVG COST OVERRUN" value={portfolioSummary ? `+${portfolioSummary.avg_cost_overrun_pct}%` : "+7.8%"} delta="National drift" deltaTone="up-bad" sparkline={spark([6, 9, 11, 10, 15, 19], '#E8A33D')} />
        <StatCard label="AVG TIME OVERRUN RISK" value={portfolioSummary ? `${portfolioSummary.avg_top_prob}%` : "46.1%"} delta="TOP model probability" sparkline={spark([4, 7, 9, 13, 16, 18], '#1FAE7A')} />
        <StatCard label="PROJECTS AT RISK" value={portfolioSummary ? `${portfolioSummary.projects_at_risk}` : "42"} delta="Critical + High tier" deltaTone="down-good" sparkline={spark([20, 18, 19, 16, 15, 14], '#E85D4E')} />
        <StatCard label="AVG COST OVERRUN RISK" value={portfolioSummary ? `${portfolioSummary.avg_cop_prob}%` : "38.2%"} delta="COP model probability" deltaTone="up-bad" sparkline={spark([5, 8, 7, 10, 12, 15], '#E8A33D')} />
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5 sm:p-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-600 dark:text-cyan-400 uppercase">National Asset Watch</p>
            <h2 className="mt-1 font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white">High Value Projects</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Major monitored projects ranked by infrastructure value.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button onClick={handleHighValuePrev} className="p-2 rounded-full border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 text-slate-600 dark:text-slate-300 hover:text-brand-orange hover:border-brand-orange/40 transition-colors" aria-label="Previous high value project cards">
              <ChevronLeft size={18} />
            </button>
            <button onClick={handleHighValueNext} className="p-2 rounded-full border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 text-slate-600 dark:text-slate-300 hover:text-brand-orange hover:border-brand-orange/40 transition-colors" aria-label="Next high value project cards">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="relative">
          <div 
            ref={highValueScrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-4"
          >
            {highValueProjects.map((item) => (
              <div key={item.project} className="min-w-[280px] sm:min-w-[320px] shrink-0 snap-start rounded-2xl border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-[10px] font-bold tracking-wider text-cyan-600 dark:text-cyan-400 uppercase">{item.sector}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1">{item.organization}</p>
                <h3 className="font-semibold text-slate-900 dark:text-white leading-snug min-h-[3.5rem]">{item.project}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500 dark:text-slate-400">Original Cost</span><span className="font-semibold text-slate-900 dark:text-white">{item.originalCost}</span></div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5"><span className="text-slate-500 dark:text-slate-400">Physical Progress</span><span className="font-semibold text-slate-900 dark:text-white">{item.progress}%</span></div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-ink-900 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500 group-hover:scale-[1.02] origin-left" style={{ width: `${item.progress}%` }} /></div>
                  </div>
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500 dark:text-slate-400">Latest Revised Cost</span><span className="font-semibold text-slate-900 dark:text-white">{item.revisedCost}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-slate-500 dark:text-slate-400">Revised Completion</span><span className="font-semibold text-slate-900 dark:text-white">{item.revisedCompletion}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Composite + AI intelligence */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-6">
        {/* Replace the old wrapper line with this responsive theme version */}
<div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card transition-colors duration-200">

          <p className="text-xs font-semibold tracking-wide text-cyan-600 mb-5">COMPOSITE INTELLIGENCE</p>
          <div className="flex items-center gap-5">
            <RadialGauge value={78.4} />
            <div>
              <h3 className="font-display font-semibold text-ink-950">National health index</h3>
              <p className="text-sm text-slate-500 mt-1 leading-snug">
                Weighted across cost, schedule, physical and financial progress.
              </p>
              <p className="text-sm font-medium text-emerald-600 mt-2">↗ +4.2% this quarter</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {healthBreakdown.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
                <span className="text-sm text-slate-600 w-16">{h.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${h.pct}%`, backgroundColor: h.color }} />
                </div>
                <span className="text-sm text-slate-500 w-9 text-right">{h.pct}%</span>
              </div>
            ))}
          </div>
          <button className="mt-5 text-sm font-medium text-brand-orangeDark hover:underline">
            View index methodology ›
          </button>
        </div>

        {/* Replace the old wrapper line with this responsive theme version */}
<div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col transition-colors duration-200">

          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-semibold tracking-wide text-cyan-600">AI PROJECT INTELLIGENCE</p>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-600 flex items-center gap-1">
              <Sparkles size={11} /> Model preview
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Change the inner metric cards to look dark and flat */}
<div className="rounded-lg border border-slate-100 dark:border-ink-800 bg-transparent p-4">

              <p className="text-[11px] font-medium text-slate-400 mb-2">COST OVERRUN RISK</p>
              <p className="font-display text-2xl font-semibold text-ink-950">18.7%</p>
              <p className="text-xs text-amber-600 mt-1">Moderate risk</p>
              <div className="h-1 rounded-full bg-slate-100 mt-3">
                <div className="h-full rounded-full bg-amber-400" style={{ width: '19%' }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">₹2,840 Cr exposure</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">TIME OVERRUN RISK</p>
              <p className="font-display text-2xl font-semibold text-ink-950">31.4%</p>
              <p className="text-xs text-red-500 mt-1">High risk</p>
              <div className="h-1 rounded-full bg-slate-100 mt-3">
                <div className="h-full rounded-full bg-red-400" style={{ width: '31%' }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">8.3 months expected</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">PROJECT HEALTH</p>
              <p className="font-display text-2xl font-semibold text-ink-950">72 / 100</p>
              <p className="text-xs text-amber-600 mt-1">Watch</p>
              <div className="h-1 rounded-full bg-slate-100 mt-3">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: '72%' }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">87% confidence</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg bg-slate-50 p-4 flex-1">
            <p className="text-sm font-semibold text-ink-950 mb-1.5">Why this matters</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Schedule slippage and revised project cost are increasing risk, while strong physical progress is
              partially offsetting the forecast. Predictions are estimates to support review, not authoritative
              outcomes.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">+ Strong physical progress</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">+ Schedule slippage</span>
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] text-orange-700">+ Cost restrain</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live project map (Leaflet) */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr,1fr] gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400">WHERE THE RISK IS</p>
            <Link to="/map" className="text-xs text-cyan-400 cursor-pointer hover:underline">Open full map ›</Link>
          </div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">Live infrastructure project map</h3>
          <ProjectMapSafe
            projects={mapProjects}
            height={380}
            dark={document.documentElement.classList.contains('dark')}
          />
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Watch</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Risk</span>
            </span>
            <span>{mapRiskStats.total} projects plotted</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card transition-colors duration-200 flex flex-col">
          <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400">RISK SURFACE INDEX</p>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white mt-1 mb-4">Live portfolio snapshot</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">AT RISK</p>
              <p className="font-display text-2xl font-black text-red-500 leading-none">{mapRiskStats.atRisk}</p>
              <p className="text-[11px] text-slate-400 mt-2">{mapRiskStats.total ? Math.round((mapRiskStats.atRisk / mapRiskStats.total) * 100) : 0}% of plotted</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">WATCH</p>
              <p className="font-display text-2xl font-black text-amber-500 leading-none">{mapRiskStats.watch}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">ON TRACK</p>
              <p className="font-display text-2xl font-black text-emerald-500 leading-none">{mapRiskStats.onTrack}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800 p-4">
              <p className="text-[11px] font-medium text-slate-400 mb-2">AVG RISK SCORE</p>
              <p className="font-display text-2xl font-black text-slate-900 dark:text-white leading-none">
                {mapRiskStats.avgRisk}<span className="text-sm font-bold text-slate-400">/100</span>
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-ink-950 p-4 flex-1">
            <p className="text-sm font-semibold text-ink-950 dark:text-white mb-1.5">Why this matters</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Markers are pinned to deterministic state-centroid coordinates. Risk signals come straight from the
              same XGBoost composite used in the hotspot list — points are display data aligned to the model,
              not a geospatial survey.
            </p>
          </div>
          <Link to="/map" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:underline self-start">
            Explore the national project map <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5 sm:p-6 transition-colors duration-200">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setSummaryMode('ministry'); setSelectedSummaryIndex(0) }} className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${summaryMode === 'ministry' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 dark:bg-ink-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-ink-800'}`}>
              Ministry-Wise
            </button>
            <button onClick={() => { setSummaryMode('sector'); setSelectedSummaryIndex(0) }} className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${summaryMode === 'sector' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 dark:bg-ink-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-ink-800'}`}>
              Sector-Wise
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 p-3">
              <div className="space-y-2">
                {selectorItems.map((item, idx) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedSummaryIndex(idx)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selectedSummaryIndex === idx ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-800 text-slate-700 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-700'}`}
                  >
                    <span className="text-sm font-semibold leading-snug">{item.key}</span>
                    <ArrowRight size={14} className={selectedSummaryIndex === idx ? 'text-white' : 'text-slate-400'} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={handleSummaryPrev} className="p-2 rounded-full border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-slate-500 dark:text-slate-400 hover:text-brand-orange transition-colors" aria-label="Previous summary item"><ChevronLeft size={16} /></button>
                <button onClick={handleSummaryNext} className="p-2 rounded-full border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-slate-500 dark:text-slate-400 hover:text-brand-orange transition-colors" aria-label="Next summary item"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 p-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-cyan-600 dark:text-cyan-400 uppercase">{selectedSummary.label}</p>
                  <h3 className="mt-1 font-display text-xl font-black text-slate-900 dark:text-white">{selectedSummary.name}</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{summaryMode === 'ministry' ? 'Ministry-wide snapshot' : 'Sector-wide snapshot'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  { label: 'Project Count (No.)', value: selectedSummary.projectCount, icon: BriefcaseBusiness },
                  { label: 'Original Cost (in Cr)', value: selectedSummary.originalCost, icon: IndianRupee },
                  { label: 'Latest Revised Cost (in Cr)', value: selectedSummary.revisedCost, icon: TrendingUp },
                  { label: summaryMode === 'ministry' ? 'Expenditure(Cumm.) (in Cr)' : 'Expenditure', value: selectedSummary.expenditure, icon: Landmark },
                  { label: summaryMode === 'ministry' ? 'Completed During Month (No.)' : 'Completed', value: selectedSummary.completed, icon: ShieldCheck },
                  { label: 'Newly Added (No.)', value: selectedSummary.newAdded, icon: Users },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                      <metric.icon size={16} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.label}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

                 {/* Projects requiring attention */}
      <section className="animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold tracking-wide text-blue-600 dark:text-cyan-400 mb-1">RECOVERY SUPPORT</p>
            <h2 className="font-display text-xl font-black text-slate-900 dark:text-white">Projects requiring attention</h2>
          </div>
          <Link to="/projects" className="text-sm font-semibold text-brand-orange hover:text-brand-orangeDark transition-colors flex items-center gap-1">
            View all projects <ArrowRight size={14} />
          </Link>
        </div>

        {/* PROJECTS GRID CONTAINER PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {attentionList.map((item) => {
            const statusBadge =
              item.status === 'At Risk'
                ? 'text-red-500'
                : item.status === 'Watch'
                ? 'text-amber-500'
                : 'text-emerald-500'
            const sectorLabel = item.sector || 'Infrastructure'
            const customProgressValue = item.physicalProgress ?? 50
            const costVal = `${item.costVariance > 0 ? '+' : ''}${item.costVariance}%`
            const timeVal = `${item.timeVariance > 0 ? '+' : ''}${item.timeVariance} mo`
            const mapLocation = item.state || 'India'

            return (
              <div 
                key={item.id} 
                className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-[0_4px_20px_rgba(15,20,32,0.02)] hover:shadow-[0_6px_25px_rgba(15,20,32,0.06)] transition-all duration-300 flex flex-col justify-between text-left group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      {item.id}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${statusBadge}`}>
                      {item.status}
                    </span>
                  </div>
                  
                  {/* Title and Sector - Removed Logo Boxes completely */}
                  <div className="flex justify-between items-start mb-5 gap-3">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h4 className="font-sans font-bold text-slate-800 dark:text-white text-sm leading-snug tracking-tight truncate group-hover:text-brand-orange transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">
                        📍 {mapLocation}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight self-center flex-shrink-0">
                      {sectorLabel}
                    </span>
                  </div>

                  {/* Physical Progress Trackbar */}
                  <div className="space-y-2 mt-2">
                    <span className="block text-[9px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                      Physical Progress
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden border border-slate-200/20 dark:border-transparent">
                        <div 
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${customProgressValue}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {customProgressValue}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-ink-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      Cost <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{costVal}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      Time <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{timeVal}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link 
                      to={`/projects/${item.id}`} 
                      className="text-blue-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-0.5"
                    >
                      View intelligence →
                    </Link>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </section>


      {/* Sector performance + AI executive summary */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-cyan-600 mb-1">SECTOR INTELLIGENCE</p>
          <h2 className="font-display text-lg font-semibold text-ink-950 mb-4">Where performance is moving</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sectorPerformance.map((s) => (
              <div key={s.sector} className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-sm transition-colors duration-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{s.sector}</p>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {s.count} monitored projects · {s.value}
                </p>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${s.progress}%`, backgroundColor: s.color }} />
                </div>
                <p className="text-[11px] text-slate-500">{s.progress}% average progress</p>
              </div>
            ))}
          </div>
        </div>

        {/* Find the AI executive summary section container wrapper near the bottom */}
<div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col">
  <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-2">
    GENERATED ANALYTICAL SUMMARY
  </p>
  <h3 className="font-display font-semibold text-slate-900 dark:text-white text-lg">
    AI executive summary
  </h3>

  {/* 
    CRITICAL FIX AREA: 
    - Replaced hardcoded text with text-slate-700 dark:text-slate-300
    - Enforced a font-medium balance so sentences remain highly visible
  */}
  <p className="mt-4 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
    "Overall project health has improved by <span className="text-emerald-600 dark:text-emerald-400 font-bold">4.2% this quarter</span>. However, 18 projects show increasing schedule risk, primarily in transport and energy sectors. Uttar Pradesh and Maharashtra currently account for the largest predicted cost-overrun exposure."
  </p>

  {/* Action Links zone at the bottom */}
  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-ink-800 flex items-center justify-between text-xs">
    <button className="font-medium text-slate-400 dark:text-slate-500 hover:text-brand-orangeDark transition-colors">
      Download full latest summary report ↓
    </button>
    <button className="font-semibold text-brand-orange dark:text-amber-400 hover:underline">
      View supporting data ›
    </button>
  </div>
</div>
      </section>
  {/* ========================================================================= */}
{/* OFFICIAL MINISTRY GOVERNMENT FLOATING FOOTER CARD                        */}
{/* ========================================================================= */}
<footer className="mt-16 px-4 sm:px-6 pb-8 transition-colors duration-200">
  
  {/* 
    CURVED CARD THEME FIX:
    - Wrapped the footer in 'rounded-3xl border border-slate-200 dark:border-ink-800'
    - Added 'bg-white dark:bg-ink-900 shadow-md' to create a floating layer matching your charts
  */}
  <div className="mx-auto max-w-[1440px] rounded-3xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 sm:p-8 shadow-md">
    
    {/* TOP BALANCED SECTION HEADER BAR */}
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 pb-8 border-b border-slate-100 dark:border-ink-800/60">
      
      {/* Ministry Brand Identity Grouping */}
      <div className="space-y-4 max-w-xl w-full">
        <div className="flex items-center gap-4">
          
          {/* MINISTRY PNG LOGO IMAGE SOURCE BLOCK */}
          <div className="flex h-12 w-auto flex-shrink-0 items-center justify-center select-none">
            <img 
              src={new URL('../assests/ministry-logo.png', import.meta.url).href} 
              alt="Ministry Logo" 
              className="h-12 w-auto object-contain dark:brightness-110"
            />
          </div>
          
          <div>
            <span className="block font-display font-black text-xs tracking-wide text-slate-800 dark:text-white uppercase leading-tight">
              Ministry of Statistics and Programme Implementation
            </span>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              Government of India
            </span>
          </div>
        </div>

        {/* Address and Get In Touch Data */}
        <div className="space-y-1 pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-orange">Get in touch</p>
          <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">
            Ministry of Statistics and Programme Implementation, Government of India, Khurshid Lal Bhawan, Janpath, New Delhi-110001 (India).
          </p>
        </div>

        {/* Contact Credentials Rows */}
        <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 pt-1 text-xs">
          <a href="tel:011-23455604" className="flex items-center gap-2 font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-brand-orange transition-colors">
            <span className="text-brand-orange text-sm">📞</span> 011-23455604
          </a>
          <a href="mailto:dir-ipmd@mospi.gov.in" className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-400 hover:text-brand-orange transition-colors">
            <span className="text-brand-orange text-sm">✉</span> dir-ipmd[at]mospi[dot]gov[dot]in
          </a>
        </div>
      </div>

      {/* NEGD BRANDING IMAGE WRAPPER - Text fallbacks removed completely */}
      <div className="flex-shrink-0 bg-slate-50/50 dark:bg-ink-950/40 p-4 rounded-2xl border border-slate-100 dark:border-ink-800/80 shadow-sm flex flex-col items-center justify-center text-center w-full sm:w-auto min-w-[220px]">
        <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Design and Developed by NeGD
        </span>
        <img 
          src={new URL('../assests/negd-logo.png', import.meta.url).href} 
          alt="NeGD Logo" 
          className="h-10 w-auto object-contain dark:brightness-110"
        />
        <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest">
          National e-Governance Division
        </span>
      </div>

    </div>

    {/* MIDDLE SECTION: QUICK LINKS PANEL STRIP */}
    <div className="py-6 border-b border-slate-100 dark:border-ink-800/60">
      <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-3">Quick Links</p>
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
        <Link 
  to="/" 
  className="hover:text-brand-orange transition-colors"
  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
>
  Home
</Link>

        <a href="https://paimana-proj.mospi.gov.in/ContactUs/Contact" className="hover:text-brand-orange transition-colors">Contact Us</a>
<a href="https://paimana-proj.mospi.gov.in/FAQ" className="hover:text-brand-orange transition-colors">FAQs</a>
<a href="https://paimana-proj.mospi.gov.in/QuickLink/SiteMap" className="hover:text-brand-orange transition-colors">Site Map</a>
<a href="https://paimana-proj.mospi.gov.in/QuickLink/HyperLinkPolicy" className="hover:text-brand-orange transition-colors">Hyperlinking Policy</a>
<a href="https://paimana-proj.mospi.gov.in/QuickLink/PrivacyPolicy" className="hover:text-brand-orange transition-colors">Privacy Policy</a>

      </nav>
    </div>
</div>
    {/* BOTTOM SECTION: COPYRIGHT INDEX MARKER */}
    <div className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
      <p className="leading-relaxed">
        <span className="font-bold text-slate-500 dark:text-slate-400">Content owned and maintained by:</span> Infrastructure & Project Monitoring Division(IPMD) | Ministry of Statistics and Programme Implementation.
      </p>
      <p className="font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
        Copyright © 2026 Ministry of Statistics and Programme Implementation
      </p>
    </div>
      </footer>
  </div>

  )
}

