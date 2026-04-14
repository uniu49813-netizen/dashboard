import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
import { 
  X, CheckCircle2, RefreshCcw, Calendar, Bell, User, Network, Search, 
  Cloud, Sun, CloudRain, CloudLightning, Thermometer, BellOff, Info, 
  CheckCircle, Share2, TrendingUp, Settings, ArrowRight, Zap, Brain, 
  LockOpen, MessageCircle, MessageSquare, Sparkles, UserPlus, 
  ExternalLink, Users, Clock, Newspaper, LayoutDashboard, 
  ChevronRight, ChevronLeft, Volume2, Music, Check, MoreVertical, MapPin, Wind, Droplets, Battery, Wifi,
  Send, Bot, Loader2, BarChart3, ArrowUpRight, ArrowDownRight, DollarSign,
  Layout, ArrowUp, ArrowDown, GripVertical
} from "lucide-react";
import { cn } from './lib/utils';
import { getGeminiResponse } from './services/geminiService';

// --- Interfaces ---

interface NewsItem {
  id: string;
  title: string;
  source: string;
  category: string;
  timestamp: number;
  url: string;
  image?: string;
  summary: string;
}

interface WeatherData {
  temp: string;
  condition: string;
  location: string;
  icon: 'sun' | 'cloud' | 'rain' | 'lightning';
  humidity: string;
  windSpeed: string;
  feelsLike: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
}

interface AppTheme {
  name: string;
  accentColor: string;
  gradient: string;
  subtleGradient: string;
  borderColor: string;
  glowColor: string;
  bgAccent: string;
}

// --- Constants ---

const THEME: AppTheme = {
  name: "Modern",
  accentColor: "text-blue-500",
  gradient: "from-blue-500 to-indigo-600",
  subtleGradient: "from-blue-500/10 to-indigo-600/10",
  borderColor: "border-blue-500/20",
  glowColor: "shadow-blue-500/20",
  bgAccent: "bg-blue-500"
};

// --- Main Component ---

export default function App() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'n1',
      title: 'System Initialized',
      message: 'Welcome to your personal dashboard. All systems nominal.',
      type: 'success',
      timestamp: Date.now(),
      read: false
    }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'weather' | 'markets' | 'settings'>('overview');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isCalendarAuthenticated, setIsCalendarAuthenticated] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [settingsSubPage, setSettingsSubPage] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    news: true,
    weather: true,
    stocks: true,
    system: true,
    sound: 'chime'
  });
  const [dashboardLayout, setDashboardLayout] = useState([
    { id: 'hero', label: 'Time & Date', width: '2' },
    { id: 'weather', label: 'Weather Summary', width: '1' },
    { id: 'calendar', label: 'Upcoming Events', width: '1' },
    { id: 'markets', label: 'Market Overview', width: '1' },
    { id: 'news', label: 'Top News', width: '2' },
    { id: 'actions', label: 'Quick Actions', width: '1' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // --- Effects ---

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initData = async () => {
      fetchStocks();
      checkCalendarStatus();
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const loc = `${latitude},${longitude}`;
            setUserLocation(loc);
            fetchWeather(loc);
          },
          (error) => {
            console.warn("Geolocation error:", error);
            fetchWeather(); // Fallback to San Francisco
          }
        );
      } else {
        fetchWeather(); // Fallback to San Francisco
      }
      fetchNews();
      getBatteryInfo();
    };

    initData();
    
    const newsTimer = setInterval(fetchNews, 600000); // Every 10 mins
    return () => clearInterval(newsTimer);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'google') {
        setIsCalendarAuthenticated(true);
        fetchCalendarEvents();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Helper Functions ---

  const checkCalendarStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsCalendarAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        fetchCalendarEvents();
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    }
  };

  const handleCalendarConnect = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (error) {
      console.error('Error getting auth URL:', error);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const response = await fetch('/api/calendar/events');
      if (response.ok) {
        const data = await response.json();
        setCalendarEvents(data);
      } else if (response.status === 401) {
        setIsCalendarAuthenticated(false);
        setCalendarEvents([]);
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  const handleCalendarLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsCalendarAuthenticated(false);
      setCalendarEvents([]);
    } catch (error) {
      console.error('Error logging out of calendar:', error);
    }
  };

  const getBatteryInfo = async () => {
    if ("getBattery" in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        setBatteryLevel(battery.level);
        battery.addEventListener('levelchange', () => setBatteryLevel(battery.level));
      } catch (e) {
        console.error("Battery API error:", e);
      }
    }
  };

  const fetchStocks = async () => {
    try {
      const response = await fetch('/api/stocks');
      if (!response.ok) throw new Error('Failed to fetch stocks');
      const data = await response.json();
      setStocks(data);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  };

  const fetchNews = async () => {
    // Simulated news fetch
    const mockNews: NewsItem[] = [
      {
        id: '1',
        title: "Global Tech Summit 2026 Announces Keynote Speakers",
        source: "TechDaily",
        category: "Technology",
        timestamp: Date.now() - 1800000,
        url: "#",
        image: "https://picsum.photos/seed/tech/800/400",
        summary: "The upcoming summit will focus on sustainable AI and the future of quantum computing."
      },
      {
        id: '2',
        title: "New Environmental Policy Shows Positive Impact on Urban Air Quality",
        source: "EcoWatch",
        category: "Environment",
        timestamp: Date.now() - 7200000,
        url: "#",
        image: "https://picsum.photos/seed/nature/800/400",
        summary: "Recent data suggests a 15% improvement in air quality across major metropolitan areas."
      },
      {
        id: '3',
        title: "Breakthrough in Fusion Energy Research Reported by International Team",
        source: "ScienceNow",
        category: "Science",
        timestamp: Date.now() - 14400000,
        url: "#",
        image: "https://picsum.photos/seed/science/800/400",
        summary: "Researchers have achieved a stable plasma reaction for a record-breaking duration."
      },
      {
        id: '4',
        title: "Mars Colony Habitat Prototype Successfully Tested in Antarctica",
        source: "AstroNews",
        category: "Space",
        timestamp: Date.now() - 21600000,
        url: "#",
        image: "https://picsum.photos/seed/mars/800/400",
        summary: "The habitat maintained a stable internal environment for 6 months in extreme cold."
      }
    ];
    setNewsItems(mockNews);
  };

  const fetchWeather = async (location?: string) => {
    try {
      const searchLocation = location || "San Francisco";
      const response = await fetch(`/api/weather?location=${encodeURIComponent(searchLocation)}`);
      if (response.ok) {
        const data = await response.json();
        
        if (!data || !data.current_condition || !data.current_condition[0]) return null;

        const current = data.current_condition[0];
        const nearest = data.nearest_area[0];
        
        const weather: WeatherData = {
          temp: `${current.temp_C}°C`,
          condition: current.weatherDesc?.[0]?.value || "Unknown",
          location: `${nearest.areaName?.[0]?.value || "Unknown"}, ${nearest.country?.[0]?.value || "Unknown"}`,
          humidity: `${current.humidity}%`,
          windSpeed: `${current.windspeedKmph} km/h`,
          feelsLike: `${current.FeelsLikeC}°C`,
          icon: current.weatherDesc?.[0]?.value?.toLowerCase().includes('sun') ? 'sun' :
                current.weatherDesc?.[0]?.value?.toLowerCase().includes('rain') ? 'rain' :
                current.weatherDesc?.[0]?.value?.toLowerCase().includes('thunder') ? 'lightning' : 'cloud'
        };
        setWeatherData(weather);
        return weather;
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error);
    }
    return null;
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    const userMsg = aiInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const context = `
        Weather: ${weatherData ? `${weatherData.temp}, ${weatherData.condition} in ${weatherData.location}` : 'Unknown'}
        Latest News: ${newsItems.slice(0, 3).map(n => n.title).join('; ')}
        Markets: ${stocks.slice(0, 3).map(s => `${s.symbol}: ${s.price} (${s.changePercent.toFixed(2)}%)`).join('; ')}
        Calendar: ${calendarEvents.length > 0 ? calendarEvents.slice(0, 3).map(e => `${e.summary} (${e.start.dateTime || e.start.date})`).join('; ') : 'No upcoming events'}
        Time: ${currentTime.toLocaleTimeString()}
        Notifications: ${notifications.length} active
      `;
      const response = await getGeminiResponse(userMsg, context);
      setChatMessages(prev => [...prev, { role: 'ai', content: response || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error: Failed to connect to AI service. Please check your API key." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Render Helpers ---

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      {/* Background Accents */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
      </div>

      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LayoutDashboard size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none">DASHBOARD</h1>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Multi-Purpose Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-bold text-gray-400">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-blue-500" />
              <span>{formatTime(currentTime)}</span>
            </div>
            {weatherData && (
              <div className="flex items-center gap-2">
                {weatherData.icon === 'sun' && <Sun size={14} className="text-yellow-400" />}
                {weatherData.icon === 'cloud' && <Cloud size={14} className="text-gray-400" />}
                {weatherData.icon === 'rain' && <CloudRain size={14} className="text-blue-400" />}
                {weatherData.icon === 'lightning' && <CloudLightning size={14} className="text-purple-400" />}
                <span>{weatherData.temp}</span>
              </div>
            )}
            {batteryLevel !== null && (
              <div className="flex items-center gap-2">
                <Battery size={14} className={batteryLevel < 0.2 ? "text-red-500" : "text-green-500"} />
                <span>{Math.round(batteryLevel * 100)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "p-2.5 hover:bg-white/5 rounded-full transition-all relative group",
                showNotifications ? "text-blue-500 bg-blue-500/10" : "text-gray-400 hover:text-white"
              )}
            >
              <Bell size={20} />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0a0a0a]"></span>
              )}
            </button>
            <button 
              onClick={() => {
                setActiveTab('settings');
                setSettingsSubPage(null);
              }}
              className="p-2.5 hover:bg-white/5 rounded-full transition-all text-gray-400 hover:text-white"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-20 md:w-64 border-r border-white/10 bg-[#0a0a0a]/50 flex flex-col shrink-0">
          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
              { id: 'news', label: 'News Feed', icon: <Newspaper size={20} /> },
              { id: 'weather', label: 'Weather', icon: <Cloud size={20} /> },
              { id: 'markets', label: 'Markets', icon: <BarChart3 size={20} /> },
              { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSettingsSubPage(null);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all group",
                  activeTab === item.id 
                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" 
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                )}
              >
                <div className={cn("shrink-0 transition-transform group-hover:scale-110", activeTab === item.id ? "text-blue-500" : "text-gray-500")}>
                  {item.icon}
                </div>
                <span className="hidden md:block font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="bg-white/5 rounded-2xl p-4 hidden md:block">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black">JD</div>
                <div>
                  <p className="text-xs font-bold text-white">John Doe</p>
                  <p className="text-[10px] text-gray-500">Premium Member</p>
                </div>
              </div>
              <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Dynamic Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {dashboardLayout.map((widget) => {
                    if (widget.id === 'hero') {
                      return (
                        <div key="hero" className={cn(
                          "p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-white/10 shadow-2xl shadow-blue-500/10 relative overflow-hidden group",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock size={200} />
                          </div>
                          <div className="relative z-10">
                            <p className="text-blue-200 font-bold uppercase tracking-[0.2em] text-xs mb-4">Current Time & Date</p>
                            <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-2">{formatTime(currentTime)}</h2>
                            <p className="text-xl text-blue-100 font-medium">{formatDate(currentTime)}</p>
                          </div>
                        </div>
                      );
                    }
                    if (widget.id === 'weather') {
                      return (
                        <div key="weather" className={cn(
                          "p-8 rounded-3xl bg-[#141414] border border-white/10 flex flex-col justify-between group",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Weather Summary</h3>
                            <button onClick={() => fetchWeather(userLocation || undefined)} className="p-2 hover:bg-white/5 rounded-lg transition-all text-gray-500 hover:text-white">
                              <RefreshCcw size={16} />
                            </button>
                          </div>
                          {weatherData ? (
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                                  {weatherData.icon === 'sun' && <Sun size={32} />}
                                  {weatherData.icon === 'cloud' && <Cloud size={32} />}
                                  {weatherData.icon === 'rain' && <CloudRain size={32} />}
                                  {weatherData.icon === 'lightning' && <CloudLightning size={32} />}
                                </div>
                                <div>
                                  <p className="text-4xl font-black">{weatherData.temp}</p>
                                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{weatherData.condition}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                <MapPin size={14} className="text-blue-500" />
                                {weatherData.location}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-600 italic text-sm">
                              Loading weather...
                            </div>
                          )}
                          <button 
                            onClick={() => setActiveTab('weather')}
                            className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            View Full Forecast <ChevronRight size={14} />
                          </button>
                        </div>
                      );
                    }
                    if (widget.id === 'calendar') {
                      return (
                        <div key="calendar" className={cn(
                          "p-8 rounded-3xl bg-[#141414] border border-white/10 flex flex-col justify-between group",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Upcoming Events</h3>
                            <button onClick={fetchCalendarEvents} className="p-2 hover:bg-white/5 rounded-lg transition-all text-gray-500 hover:text-white">
                              <RefreshCcw size={16} />
                            </button>
                          </div>
                          
                          {!isCalendarAuthenticated ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Calendar size={24} />
                              </div>
                              <p className="text-xs text-gray-500 font-medium">Connect your Google Calendar to see upcoming events.</p>
                              <button 
                                onClick={handleCalendarConnect}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Connect Google
                              </button>
                            </div>
                          ) : calendarEvents.length > 0 ? (
                            <div className="space-y-3 flex-1">
                              {calendarEvents.slice(0, 3).map((event) => (
                                <div key={event.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                                  <p className="text-xs font-bold text-white line-clamp-1">{event.summary}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Clock size={10} className="text-blue-500" />
                                    <p className="text-[10px] text-gray-500 font-bold">
                                      {event.start.dateTime 
                                        ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : 'All Day'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-600 italic text-sm">
                              No upcoming events.
                            </div>
                          )}
                          
                          {isCalendarAuthenticated && (
                            <div className="mt-6 flex gap-2">
                              <button 
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                              >
                                View Full Calendar <ChevronRight size={14} />
                              </button>
                              <button 
                                onClick={handleCalendarLogout}
                                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                                title="Disconnect Calendar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (widget.id === 'markets') {
                      return (
                        <div key="markets" className={cn(
                          "p-8 rounded-3xl bg-[#141414] border border-white/10 flex flex-col justify-between group",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Market Overview</h3>
                            <button onClick={fetchStocks} className="p-2 hover:bg-white/5 rounded-lg transition-all text-gray-500 hover:text-white">
                              <RefreshCcw size={16} />
                            </button>
                          </div>
                          <div className="space-y-3">
                            {stocks.slice(0, 3).map((stock) => (
                              <div key={stock.symbol} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    stock.change >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                  )}>
                                    {stock.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-white">{stock.symbol}</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{stock.name}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-black text-white">${stock.price.toLocaleString()}</p>
                                  <p className={cn(
                                    "text-[10px] font-bold",
                                    stock.change >= 0 ? "text-green-500" : "text-red-500"
                                  )}>
                                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => setActiveTab('markets')}
                            className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            View Markets <ChevronRight size={14} />
                          </button>
                        </div>
                      );
                    }
                    if (widget.id === 'news') {
                      return (
                        <div key="news" className={cn(
                          "space-y-4",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Top News</h3>
                            <button onClick={() => setActiveTab('news')} className="text-xs font-bold text-blue-500 hover:underline">View All</button>
                          </div>
                          <div className={cn(
                            "grid gap-4",
                            widget.width === '1' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                          )}>
                            {newsItems.slice(0, 2).map((news) => (
                              <div key={news.id} className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden group hover:border-blue-500/30 transition-all">
                                <div className="h-32 overflow-hidden">
                                  <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                </div>
                                <div className="p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-tighter rounded border border-blue-500/20">{news.category}</span>
                                    <span className="text-[8px] text-gray-500 font-bold uppercase">{news.source}</span>
                                  </div>
                                  <h4 className="font-bold text-sm text-white line-clamp-2 group-hover:text-blue-400 transition-colors">{news.title}</h4>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (widget.id === 'actions') {
                      return (
                        <div key="actions" className={cn(
                          "space-y-4",
                          widget.width === '1' ? 'lg:col-span-1' : widget.width === '2' ? 'lg:col-span-2' : 'lg:col-span-3'
                        )}>
                          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Quick Actions</h3>
                          <div className={cn(
                            "grid gap-3",
                            widget.width === '1' ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
                          )}>
                            {[
                              { label: 'Calendar', icon: <Calendar size={20} />, color: 'bg-orange-500' },
                              { label: 'Messages', icon: <MessageSquare size={20} />, color: 'bg-green-500' },
                              { label: 'Network', icon: <Network size={20} />, color: 'bg-purple-500' },
                              { label: 'Search', icon: <Search size={20} />, color: 'bg-blue-500' },
                            ].map((action) => (
                              <button key={action.label} className="p-4 bg-[#141414] border border-white/10 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/5 transition-all group">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform", action.color)}>
                                  {action.icon}
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{action.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === 'news' && (
              <motion.div
                key="news"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">News Feed</h2>
                    <p className="text-sm text-gray-500">Stay updated with the latest global events.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search news..." 
                        className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all w-64"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {newsItems.map((news) => (
                    <motion.div
                      key={news.id}
                      whileHover={{ y: -5 }}
                      className="bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-xl group"
                    >
                      <div className="h-48 overflow-hidden relative">
                        <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg">{news.category}</span>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          <span>{news.source}</span>
                          <span>{new Date(news.timestamp).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white leading-tight group-hover:text-blue-400 transition-colors">{news.title}</h3>
                        <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{news.summary}</p>
                        <button className="w-full py-3 bg-white/5 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                          Read Full Article <ExternalLink size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'weather' && (
              <motion.div
                key="weather"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-4xl font-black tracking-tight">Weather Forecast</h2>
                  <p className="text-gray-500">Detailed atmospheric conditions for your area.</p>
                </div>

                {weatherData ? (
                  <div className="space-y-6">
                    <div className="p-10 rounded-[40px] bg-gradient-to-br from-blue-600 to-indigo-700 border border-white/10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                        {weatherData.icon === 'sun' && <Sun size={240} />}
                        {weatherData.icon === 'cloud' && <Cloud size={240} />}
                        {weatherData.icon === 'rain' && <CloudRain size={240} />}
                        {weatherData.icon === 'lightning' && <CloudLightning size={240} />}
                      </div>
                      
                      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="text-center md:text-left space-y-4">
                          <div className="flex items-center justify-center md:justify-start gap-3 text-blue-200">
                            <MapPin size={20} />
                            <span className="text-xl font-bold">{weatherData.location}</span>
                          </div>
                          <h3 className="text-8xl font-black tracking-tighter">{weatherData.temp}</h3>
                          <p className="text-2xl font-bold text-blue-100 uppercase tracking-[0.2em]">{weatherData.condition}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                          {[
                            { label: 'Feels Like', value: weatherData.feelsLike, icon: <Thermometer size={20} /> },
                            { label: 'Humidity', value: weatherData.humidity, icon: <Droplets size={20} /> },
                            { label: 'Wind Speed', value: weatherData.windSpeed, icon: <Wind size={20} /> },
                            { label: 'UV Index', value: 'Low', icon: <Sun size={20} /> },
                          ].map((stat) => (
                            <div key={stat.label} className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 min-w-[120px]">
                              <div className="text-blue-200">{stat.icon}</div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/60">{stat.label}</p>
                              <p className="text-lg font-bold">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {['Tomorrow', 'Wednesday', 'Thursday'].map((day, i) => (
                        <div key={day} className="bg-[#141414] border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 hover:border-blue-500/30 transition-all">
                          <p className="text-sm font-black uppercase tracking-widest text-gray-500">{day}</p>
                          <div className="text-blue-500">
                            {i === 0 ? <Cloud size={48} /> : i === 1 ? <Sun size={48} /> : <CloudRain size={48} />}
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-black">{22 + i}°C</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{i === 0 ? 'Partly Cloudy' : i === 1 ? 'Sunny' : 'Light Rain'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center gap-4">
                    <RefreshCcw size={48} className="text-blue-500 animate-spin" />
                    <p className="text-gray-500 font-bold uppercase tracking-widest">Updating Forecast...</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'markets' && (
              <motion.div
                key="markets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">Market Insights</h2>
                    <p className="text-sm text-gray-500">Real-time stock prices and financial trends.</p>
                  </div>
                  <button 
                    onClick={fetchStocks}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <RefreshCcw size={14} /> Refresh Data
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {stocks.map((stock) => (
                    <motion.div
                      key={stock.symbol}
                      whileHover={{ y: -5 }}
                      className="p-6 bg-[#141414] border border-white/10 rounded-3xl space-y-6 group hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                            stock.change >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          )}>
                            <DollarSign size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white">{stock.symbol}</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{stock.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-white">${stock.price.toLocaleString()}</p>
                          <div className={cn(
                            "flex items-center justify-end gap-1 text-xs font-bold",
                            stock.change >= 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {stock.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {stock.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Day High</p>
                          <p className="text-sm font-black text-white">${stock.high.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Day Low</p>
                          <p className="text-sm font-black text-white">${stock.low.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Volume</p>
                          <p className="text-sm font-black text-white">{(stock.volume / 1000000).toFixed(2)}M</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Currency</p>
                          <p className="text-sm font-black text-white">{stock.currency}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Brain size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white">Market Analysis</h4>
                      <p className="text-sm text-gray-500">Ask Gemini for a detailed analysis of these stocks.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowAIChat(true);
                      setAiInput("Can you analyze the current stock market trends based on the data in my dashboard?");
                    }}
                    className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20"
                  >
                    Analyze with AI
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {!settingsSubPage ? (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black tracking-tight">Settings</h2>
                      <p className="text-gray-500">Customize your dashboard experience.</p>
                    </div>

                    <div className="space-y-4">
                      {[
                        { label: 'Appearance', desc: 'Customize themes and layout colors', icon: <Sparkles size={20} /> },
                        { label: 'Dashboard Layout', desc: 'Rearrange and resize dashboard widgets', icon: <Layout size={20} />, id: 'layout' },
                        { label: 'Notifications', desc: 'Manage alert preferences and sounds', icon: <Bell size={20} />, id: 'notifications' },
                        { label: 'Privacy & Security', desc: 'Control your data and account access', icon: <LockOpen size={20} /> },
                        { label: 'System Updates', desc: 'Check for dashboard software updates', icon: <RefreshCcw size={20} /> },
                      ].map((setting) => (
                        <button 
                          key={setting.label} 
                          onClick={() => setting.id && setSettingsSubPage(setting.id)}
                          className="w-full p-6 bg-[#141414] border border-white/10 rounded-3xl flex items-center justify-between group hover:border-blue-500/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-blue-500 transition-colors">
                              {setting.icon}
                            </div>
                            <div className="text-left">
                              <h4 className="font-bold text-white">{setting.label}</h4>
                              <p className="text-xs text-gray-500">{setting.desc}</p>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : settingsSubPage === 'layout' ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSettingsSubPage(null)}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div>
                        <h2 className="text-3xl font-black tracking-tight">Dashboard Layout</h2>
                        <p className="text-gray-500">Rearrange and resize your widgets.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {dashboardLayout.map((widget, index) => (
                        <div key={widget.id} className="bg-[#141414] border border-white/10 rounded-3xl p-6 flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="text-gray-600">
                              <GripVertical size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white">{widget.label}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Width:</span>
                                <div className="flex gap-1">
                                  {['1', '2', '3'].map((w) => (
                                    <button
                                      key={w}
                                      onClick={() => {
                                        const newLayout = [...dashboardLayout];
                                        newLayout[index].width = w;
                                        setDashboardLayout(newLayout);
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black transition-all",
                                        widget.width === w ? "bg-blue-500 text-white" : "bg-white/5 text-gray-500 hover:bg-white/10"
                                      )}
                                    >
                                      {w}/3
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              disabled={index === 0}
                              onClick={() => {
                                const newLayout = [...dashboardLayout];
                                [newLayout[index], newLayout[index - 1]] = [newLayout[index - 1], newLayout[index]];
                                setDashboardLayout(newLayout);
                              }}
                              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button 
                              disabled={index === dashboardLayout.length - 1}
                              onClick={() => {
                                const newLayout = [...dashboardLayout];
                                [newLayout[index], newLayout[index + 1]] = [newLayout[index + 1], newLayout[index]];
                                setDashboardLayout(newLayout);
                              }}
                              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                              <ArrowDown size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : settingsSubPage === 'notifications' ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSettingsSubPage(null)}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div>
                        <h2 className="text-3xl font-black tracking-tight">Notifications</h2>
                        <p className="text-gray-500">Manage how you receive alerts.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-[#141414] border border-white/10 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                          <h3 className="font-bold text-white flex items-center gap-2">
                            <Bell size={18} className="text-blue-500" />
                            Notification Types
                          </h3>
                        </div>
                        <div className="p-6 space-y-4">
                          {[
                            { id: 'news', label: 'News Alerts', desc: 'Get notified about breaking news' },
                            { id: 'weather', label: 'Weather Warnings', desc: 'Severe weather and daily forecasts' },
                            { id: 'stocks', label: 'Market Updates', desc: 'Price movements and stock alerts' },
                            { id: 'system', label: 'System Status', desc: 'Dashboard and account notifications' },
                          ].map((type) => (
                            <div key={type.id} className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-white">{type.label}</h4>
                                <p className="text-xs text-gray-500">{type.desc}</p>
                              </div>
                              <button 
                                onClick={() => setNotificationSettings(prev => ({ ...prev, [type.id]: !prev[type.id as keyof typeof prev] }))}
                                className={cn(
                                  "w-12 h-6 rounded-full transition-all relative",
                                  notificationSettings[type.id as keyof typeof notificationSettings] ? "bg-blue-500" : "bg-white/10"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                  notificationSettings[type.id as keyof typeof notificationSettings] ? "left-7" : "left-1"
                                )} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-[#141414] border border-white/10 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                          <h3 className="font-bold text-white flex items-center gap-2">
                            <Volume2 size={18} className="text-blue-500" />
                            Alert Sound
                          </h3>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-3">
                          {[
                            { id: 'none', label: 'Silent', icon: <BellOff size={16} /> },
                            { id: 'chime', label: 'Chime', icon: <Music size={16} /> },
                            { id: 'pulse', label: 'Pulse', icon: <Zap size={16} /> },
                            { id: 'ping', label: 'Ping', icon: <MessageSquare size={16} /> },
                          ].map((sound) => (
                            <button 
                              key={sound.id}
                              onClick={() => setNotificationSettings(prev => ({ ...prev, sound: sound.id }))}
                              className={cn(
                                "p-4 rounded-2xl border transition-all flex items-center justify-between",
                                notificationSettings.sound === sound.id 
                                  ? "bg-blue-500/10 border-blue-500 text-blue-500" 
                                  : "bg-white/5 border-white/5 text-gray-500 hover:border-white/10"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {sound.icon}
                                <span className="text-sm font-bold">{sound.label}</span>
                              </div>
                              {notificationSettings.sound === sound.id && <Check size={16} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* AI Chat Panel Overlay */}
      <AnimatePresence>
        {showAIChat && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAIChat(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-[#0a0a0a] border-l border-white/10 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Sparkles className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Gemini Assistant</h2>
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Powered by AI</p>
                  </div>
                </div>
                <button onClick={() => setShowAIChat(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-blue-500 animate-pulse">
                      <Bot size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">How can I help you today?</h3>
                      <p className="text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                        I can summarize your news, check the weather, or provide personal dashboard insights.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 w-full max-w-[300px]">
                      {[
                        "Summarize today's top news",
                        "What's the weather like?",
                        "Give me a productivity tip",
                      ].map((suggestion) => (
                        <button 
                          key={suggestion}
                          onClick={() => {
                            setAiInput(suggestion);
                            // We can't easily trigger the submit here without a ref or moving the logic
                          }}
                          className="p-3 text-xs text-gray-400 bg-white/5 border border-white/5 rounded-xl hover:border-blue-500/30 hover:text-white transition-all text-left"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-4",
                        msg.role === 'user' ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                        msg.role === 'user' ? "bg-white/10 text-white" : "bg-blue-500 text-white"
                      )}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={cn(
                        "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' ? "bg-white/5 text-white rounded-tr-none" : "bg-blue-500/10 text-gray-200 border border-blue-500/20 rounded-tl-none"
                      )}>
                        <div className="prose prose-invert prose-xs max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
                {isAiLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 mt-1">
                      <Bot size={16} />
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl rounded-tl-none">
                      <Loader2 className="animate-spin text-blue-500" size={16} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleAISubmit} className="p-6 border-t border-white/10 bg-[#0d0d0d]">
                <div className="relative">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask Gemini anything..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                  />
                  <button 
                    type="submit"
                    disabled={!aiInput.trim() || isAiLoading}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-xl transition-all flex items-center justify-center"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="text-[9px] text-gray-600 mt-3 text-center font-bold uppercase tracking-widest">
                  AI can make mistakes. Verify important info.
                </p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating AI Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-500 rounded-2xl shadow-2xl shadow-blue-500/40 flex items-center justify-center text-white z-50 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <Sparkles size={28} />
      </motion.button>

      {/* Notifications Panel Overlay */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="fixed top-0 right-0 h-full w-full md:w-96 bg-[#0a0a0a] border-l border-white/10 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="text-blue-500" size={20} />
                  <h2 className="text-lg font-black tracking-tight">Notifications</h2>
                </div>
                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-600">
                      <BellOff size={32} />
                    </div>
                    <p className="text-gray-500 font-medium italic">All caught up! No new notifications.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-2xl border transition-all relative group",
                        notif.read ? "bg-white/5 border-white/5" : "bg-blue-500/5 border-blue-500/20"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          notif.type === 'success' ? "bg-green-500/20 text-green-500" :
                          notif.type === 'warning' ? "bg-orange-500/20 text-orange-500" :
                          notif.type === 'error' ? "bg-red-500/20 text-red-500" :
                          "bg-blue-500/20 text-blue-500"
                        )}>
                          {notif.type === 'success' ? <CheckCircle size={16} /> :
                           notif.type === 'warning' ? <Zap size={16} /> :
                           notif.type === 'error' ? <X size={16} /> :
                           <Info size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-white mb-1">{notif.title}</h4>
                          <p className="text-[10px] text-gray-400 leading-relaxed">{notif.message}</p>
                          <p className="text-[8px] text-gray-600 font-bold mt-2 uppercase tracking-widest">
                            {new Date(notif.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {!notif.read && (
                        <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5 grid grid-cols-2 gap-3">
                <button 
                  onClick={markAllAsRead}
                  className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Mark Read
                </button>
                <button 
                  onClick={clearNotifications}
                  className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
