import React, { useRef, useState, useEffect } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Camera, Upload, Play, Pause, Download, History, BarChart2, Shield, Info, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  count: number;
  image?: string;
}

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCount, setCurrentCount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [source, setSource] = useState<'camera' | 'upload' | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Загрузка модели...');

  // Load Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setLoading(false);
        setStatus('Модель готова');
      } catch (err) {
        console.error("Failed to load model", err);
        setStatus('Ошибка загрузки модели');
      }
    };
    loadModel();
  }, []);

  const detectFrame = async () => {
    if (!model || !videoRef.current || !isProcessing) return;

    const predictions = await model.detect(videoRef.current);
    
    // Filter for bikes and motorcycles (often bikes are detected as motorcycles in COCO-SSD)
    const bikes = predictions.filter((p: any) => p.class === 'bicycle' || p.class === 'motorcycle');
    setCurrentCount(bikes.length);
    
    drawPredictions(bikes);
    
    if (isProcessing) {
      requestAnimationFrame(detectFrame);
    }
  };

  const drawPredictions = (predictions: Detection[]) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !videoRef.current) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#22c55e';

    predictions.forEach((prediction: Detection) => {
      const [x, y, width, height] = prediction.bbox;
      ctx.strokeRect(x, y, width, height);
      ctx.fillText(
        `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
        x,
        y > 20 ? y - 5 : 10
      );
    });
  };

  const startCamera = async () => {
    setSource('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSource('upload');
      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = url;
      }
    }
  };

  const toggleProcessing = () => {
    if (!isProcessing) {
      setIsProcessing(true);
      // Logic to start detecting
    } else {
      setIsProcessing(false);
      // Save to history when stopping
      saveToHistory();
    }
  };

  useEffect(() => {
    if (isProcessing) {
      detectFrame();
    }
  }, [isProcessing]);

  const saveToHistory = () => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      count: currentCount,
    };
    setHistory((prev: HistoryItem[]) => [newItem, ...prev].slice(0, 10));
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Bike Detection Report", 10, 10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 10, 20);
    doc.text(`Current Count: ${currentCount}`, 10, 30);
    
    let y = 50;
    doc.text("History Logs:", 10, 40);
    history.forEach((item: HistoryItem, i: number) => {
      doc.text(`${item.timestamp}: ${item.count} bikes detected`, 15, y + (i * 10));
    });
    
    doc.save("bike-report.pdf");
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(history);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detection History");
    XLSX.writeFile(wb, "bike-data.xlsx");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">BikePark AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${loading ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {status}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Viewport */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl relative aspect-video group">
            <video 
              ref={videoRef}
              className="w-full h-full object-contain"
              muted
              playsInline
            />
            <canvas 
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              width={640}
              height={480}
            />
            
            {!source && !loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-opacity group-hover:bg-slate-900/60">
                <div className="flex gap-4">
                  <button 
                    onClick={startCamera}
                    className="flex flex-col items-center gap-2 bg-white/10 hover:bg-white/20 p-6 rounded-xl transition-all border border-white/10"
                  >
                    <Camera className="w-8 h-8 text-white" />
                    <span className="text-white font-medium text-sm">Камера</span>
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 bg-white/10 hover:bg-white/20 p-6 rounded-xl transition-all border border-white/10"
                  >
                    <Upload className="w-8 h-8 text-white" />
                    <span className="text-white font-medium text-sm">Загрузить</span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="video/*,image/*"
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex gap-4">
              <button 
                disabled={!source || loading}
                onClick={toggleProcessing}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                  isProcessing 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50'
                }`}
              >
                {isProcessing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isProcessing ? 'Остановить' : 'Начать анализ'}
              </button>
              <button 
                onClick={() => {
                  setSource(null);
                  setIsProcessing(false);
                  if (videoRef.current) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream?.getTracks().forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                    videoRef.current.src = '';
                  }
                }}
                className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Сброс
              </button>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase font-bold">Велосипедов</p>
                <p className="text-3xl font-black text-blue-600">{currentCount}</p>
              </div>
            </div>
          </div>

          {/* Analytics Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-lg">Динамика заполненности</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...history].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#2563eb' }} 
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-lg">История</h2>
              </div>
            </div>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">История пуста</p>
              ) : (
                history.map((item: HistoryItem) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500">{item.timestamp}</p>
                      <p className="font-bold text-slate-700">Найдено: {item.count}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${item.count > 0 ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-lg">Экспорт данных</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={exportPDF}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 transition-all"
              >
                <Download className="w-4 h-4" /> PDF Отчёт
              </button>
              <button 
                onClick={exportExcel}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-all"
              >
                <Download className="w-4 h-4" /> Excel Таблица
              </button>
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5" />
              <h2 className="font-bold">Методология</h2>
            </div>
            <p className="text-sm text-blue-100 leading-relaxed">
              Система использует предобученную модель <strong>COCO-SSD</strong> на базе TensorFlow.js для обнаружения объектов в реальном времени. Классификация выполняется по 80 категориям, среди которых выделяются велосипеды для учета парковки.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-slate-200 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>© 2024 Система мониторинга велопарковок у метро</p>
          <div className="flex gap-6">
            <span>Классификация</span>
            <span>Детектирование</span>
            <span>Сегментация</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
