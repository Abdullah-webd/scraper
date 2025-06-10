import React, { useState, useEffect, useRef } from 'react';
import { Play, Database, CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface Subject {
  name: string;
  slug: string;
}

interface LogMessage {
  type: 'info' | 'success' | 'warning' | 'error' | 'connected';
  message: string;
  totalScraped?: number;
  completed?: boolean;
}

function App() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isScrapingActive, setIsScrapingActive] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [totalScraped, setTotalScraped] = useState(0);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch subjects on component mount
    fetchSubjects();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchSubjects = async () => {
    try {
      const response = await fetch('/api/subjects');
      const data = await response.json();
      setSubjects(data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const startScraping = async () => {
    if (!selectedSubject) return;

    setIsScrapingActive(true);
    setLogs([]);
    setTotalScraped(0);

    // Set up Server-Sent Events
    eventSourceRef.current = new EventSource(`/api/scraping-events/${sessionId}`);
    
    eventSourceRef.current.onmessage = (event) => {
      const data: LogMessage = JSON.parse(event.data);
      setLogs(prev => [...prev, data]);
      
      if (data.totalScraped !== undefined) {
        setTotalScraped(data.totalScraped);
      }
      
      if (data.completed) {
        setIsScrapingActive(false);
        eventSourceRef.current?.close();
      }
    };

    eventSourceRef.current.onerror = () => {
      setIsScrapingActive(false);
      setLogs(prev => [...prev, {
        type: 'error',
        message: '❌ Connection to server lost'
      }]);
    };

    // Start scraping
    try {
      const response = await fetch('/api/start-scraping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectName: selectedSubject.name,
          subjectSlug: selectedSubject.slug,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scraping');
      }
    } catch (error) {
      console.error('Failed to start scraping:', error);
      setIsScrapingActive(false);
      setLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Failed to start scraping: ${error}`
      }]);
    }
  };

  const stopScraping = () => {
    setIsScrapingActive(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setLogs(prev => [...prev, {
      type: 'warning',
      message: '⏹️ Scraping stopped by user'
    }]);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Database className="w-12 h-12 text-blue-600 mr-3" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                WAEC/NECO/JAMB Scraper
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              Extract past questions from examination databases with real-time progress tracking
            </p>
          </div>

          {/* Control Panel */}
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6 mb-8">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Subject Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Subject
                </label>
                <select
                  value={selectedSubject?.slug || ''}
                  onChange={(e) => {
                    const subject = subjects.find(s => s.slug === e.target.value);
                    setSelectedSubject(subject || null);
                  }}
                  className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 backdrop-blur-sm"
                  disabled={isScrapingActive}
                >
                  <option value="">Choose a subject...</option>
                  {subjects.map((subject) => (
                    <option key={subject.slug} value={subject.slug}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col justify-end">
                <div className="flex gap-3">
                  {!isScrapingActive ? (
                    <button
                      onClick={startScraping}
                      disabled={!selectedSubject}
                      className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Scraping
                    </button>
                  ) : (
                    <button
                      onClick={stopScraping}
                      className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Stop Scraping
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Stats */}
            {(isScrapingActive || totalScraped > 0) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${isScrapingActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium text-gray-700">
                        Status: {isScrapingActive ? 'Active' : 'Idle'}
                      </span>
                    </div>
                    <div className="bg-blue-100 px-3 py-1 rounded-full">
                      <span className="text-sm font-semibold text-blue-800">
                        Total Scraped: {totalScraped}
                      </span>
                    </div>
                  </div>
                  {selectedSubject && (
                    <div className="text-sm text-gray-600">
                      Subject: <span className="font-semibold">{selectedSubject.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logs Display */}
          {logs.length > 0 && (
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Info className="w-5 h-5 mr-2 text-blue-600" />
                  Scraping Logs
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${getLogBgColor(log.type)}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 break-words font-mono">
                        {log.message}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Empty State */}
          {logs.length === 0 && !isScrapingActive && (
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-12 text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Ready to Start Scraping
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Select a subject above and click "Start Scraping" to begin extracting past questions. 
                Progress will be displayed here in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;