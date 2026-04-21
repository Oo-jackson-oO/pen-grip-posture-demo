import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Target, ShieldAlert, CheckCircle, Fingerprint, Activity, Zap, Scan, Crosshair, MonitorPlay, Volume2, VolumeX } from 'lucide-react';

import { postureKeypoints } from './poseData';

type PostureId = 'thumb_wrap' | 'wrist_flip' | 'wrist_hook' | 'finger_straight' | 'four_finger_wrap' | 'grip_too_low' | 'index_bend' | 'head_down' | 'correct';

interface PostureDef {
  id: PostureId;
  name: string;
  isCorrect: boolean;
  advice: string;
}

const postureData: PostureDef[] = [
  { id: 'correct', name: '正确握法', isCorrect: true, advice: '握笔姿势非常标准！请继续保持，手指距离笔尖约一寸，身体坐直，保持良好的书写习惯。' },
  { id: 'thumb_wrap', name: '拇指包笔', isCorrect: false, advice: '大拇指包在食指外面。这样会限制运笔范围，影响书写灵活性。请将大拇指与食指相对，轻轻捏住笔杆。' },
  { id: 'wrist_flip', name: '翻腕', isCorrect: false, advice: '手腕向外翻转，掌心向内侧。这样书写容易疲劳。请调整手腕角度，尽量保持手腕平直，舒适地贴合桌面。' },
  { id: 'wrist_hook', name: '勾腕', isCorrect: false, advice: '手腕过度向内弯曲。这样容易导致手腕疲劳僵硬，视野受限。请将手腕放平，与小臂保持自然直线。' },
  { id: 'finger_straight', name: '手指过直', isCorrect: false, advice: '手指直挺挺地压在笔杆上，过度僵硬。请让手指所有的关节自然弯曲，靠指腹传力而非骨节死压。' },
  { id: 'four_finger_wrap', name: '四指围笔', isCorrect: false, advice: '除大拇指外，其余四指紧贴甚至并拢围握笔杆。请保持食指、中指和拇指的固定，无名指和小指放松顺势弯曲垫在下方。' },
  { id: 'grip_too_low', name: '握笔过低', isCorrect: false, advice: '握笔位置太靠近笔尖，导致手部遮挡视线，引起低头。请将手指上移，保持距离笔尖约3厘米（一寸）的距离。' },
  { id: 'index_bend', name: '食指弯曲', isCorrect: false, advice: '手指过度向掌心弯曲抠笔，关节突出。请放松手指，保持自然的弧度曲线，不要用力死攥笔杆惹致酸痛。' },
  { id: 'head_down', name: '埋头', isCorrect: false, advice: '握姿使手部遮挡笔尖导致头部极低。请调整握笔方向，挺直腰背，保持胸口距离桌子一拳，眼睛距离纸面约一尺。' }
];

// Synth Audio Engine for Real-Time Feedback
let audioCtx: AudioContext | null = null;
const playFeedbackSound = (isCorrect: boolean) => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (isCorrect) {
      // Success: Techy high-pitched chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Error: Soft low buzz warning
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gainNode);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.error("Audio playback error:", e);
  }
};

// Helper to generate the 21 keypoints for different postures
const getHandPose = (type: PostureId): number[][] => {
  return postureKeypoints[type]?.points || postureKeypoints['correct'].points;
};

// SVG Hand Rendering Component
function MockVisualizer({ postureId, isCorrect, name }: { postureId: PostureId, isCorrect: boolean, name: string }) {
  const currentKeypoints = postureKeypoints[postureId] || postureKeypoints['correct'];
  const { width: w, height: h, image } = currentKeypoints;

  const [basePts, setBasePts] = useState(getHandPose(postureId));
  const basePtsRef = React.useRef(basePts);
  basePtsRef.current = basePts;

  useEffect(() => {
    const targetPts = getHandPose(postureId);
    const startPts = basePtsRef.current;
    let startTime: number | null = null;
    let rafId: number;

    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / 600, 1); // 600ms transition
      
      // easeInOutCubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const nextPts = startPts.map((pt, i) => [
        pt[0] + (targetPts[i][0] - pt[0]) * ease,
        pt[1] + (targetPts[i][1] - pt[1]) * ease
      ]);

      setBasePts(nextPts);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [postureId]);

  const [noise, setNoise] = useState([...Array(21)].map(() => [0, 0]));

  useEffect(() => {
    // Add jitter slightly representing CV camera processing
    const t = setInterval(() => {
      setNoise(n => n.map(() => [(Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008]));
    }, 150);
    return () => clearInterval(t);
  }, []);

  const pts = useMemo(() => {
    return basePts.map((p, i) => [p[0] + noise[i][0], p[1] + noise[i][1]]);
  }, [basePts, noise]);

  const conn = [
    [0,1], [1,2], [2,3], [3,4], // Thumb
    [0,5], [5,6], [6,7], [7,8], // Index
    [5,9], [9,10], [10,11], [11,12], // Middle
    [9,13], [13,14], [14,15], [15,16], // Ring
    [13,17], [17,18], [18,19], [19,20], // Pinky
    [0,17] // Palm
  ];

  const minX = Math.min(...pts.map(p => p[0])) - 0.05;
  const maxX = Math.max(...pts.map(p => p[0])) + 0.05;
  const minY = Math.min(...pts.map(p => p[1])) - 0.05;
  const maxY = Math.max(...pts.map(p => p[1])) + 0.05;

  const boxColor = isCorrect ? '#22c55e' : '#f43f5e';
  const boxClass = isCorrect ? 'stroke-green-500/80 shadow-green-500' : 'stroke-rose-500/80 shadow-rose-500';

  return (
    <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Background ambient match */}
      <div className="absolute inset-0 opacity-20 blur-2xl transition-all duration-700" style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', transform: 'scale(1.1)' }} />
      
      <svg className="w-full h-full relative z-10 drop-shadow-lg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <style>{`
          @keyframes glow-pulse-green {
            0%, 100% { filter: drop-shadow(0 0 5px rgba(74, 222, 128, 0.4)); }
            50% { filter: drop-shadow(0 0 15px rgba(74, 222, 128, 0.9)); }
          }
          .posture-correct-glow {
            animation: glow-pulse-green 2.5s ease-in-out infinite;
          }
          .color-transition {
            transition: stroke 400ms ease, fill 400ms ease, color 400ms ease;
          }
        `}</style>
        
        {/* Source Image */}
        <image href={image} x="0" y="0" width={w} height={h} />
        
        {/* Darken overlay for contrast */}
        <rect x="0" y="0" width={w} height={h} fill="rgba(0,0,0,0.15)" className="pointer-events-none" />

        {/* Bounding Box */}
        <rect
          x={minX * w} y={minY * h}
          width={(maxX - minX) * w} height={(maxY - minY) * h}
          className={`fill-none stroke-[3px] border-dashed color-transition ${boxClass}`}
          strokeDasharray="12 8"
        />
        
        {/* Label Tag */}
        <g style={{ transform: `translate(${minX * w}px, ${(minY * h)}px)` }}>
          <rect x="0" y="-36" width="220" height="36" fill={boxColor} opacity="0.9" className="color-transition" />
          <text x="12" y="-12" className="fill-white text-[16px] font-mono tracking-wider font-bold color-transition">
            {isCorrect ? `POSE: PASS (98.4%)` : `ERR: ${name}`}
          </text>
        </g>

        {/* Skeleton Group */}
        <g className={isCorrect ? "posture-correct-glow" : ""}>
          {/* Hand Bones */}
          {conn.map(([start, end], idx) => (
            <line
              key={`line-${idx}`}
              x1={pts[start][0] * w}
              y1={pts[start][1] * h}
              x2={pts[end][0] * w}
              y2={pts[end][1] * h}
              className={isCorrect ? "stroke-green-400 opacity-90 stroke-[5px] color-transition" : "stroke-[#165DFF] opacity-90 stroke-[5px] color-transition"}
            />
          ))}

          {/* Hand Joints */}
          {pts.map((p, idx) => (
            <circle
              key={`pt-${idx}`}
              cx={p[0] * w}
              cy={p[1] * h}
              r={idx === 0 ? "8" : "6"}
              className={
                (idx === 0 
                  ? (isCorrect ? "fill-white stroke-green-500 stroke-[3px]" : "fill-white stroke-[#165DFF] stroke-[3px]")
                  : (isCorrect ? "fill-slate-900 stroke-green-300 stroke-[3px]" : "fill-slate-900 stroke-cyan-400 stroke-[3px]"))
                + " color-transition"
              }
            />
          ))}
        </g>
      </svg>


      {/* Aesthetic Scanning Line overlay */}
      <motion.div
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
        className="absolute left-0 right-0 h-1 bg-[#165DFF]/30 shadow-[0_0_20px_#165DFF] z-20 pointer-events-none"
      />
    </div>
  );
}

export default function App() {
  const [activePostureId, setActivePostureId] = useState<PostureId>('correct');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [logs, setLogs] = useState<{msg: string, level: 'INFO' | 'WARN'}[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const activeData = useMemo(() => postureData.find(p => p.id === activePostureId)!, [activePostureId]);

  const addLog = (msg: string, level: 'INFO'|'WARN' = 'INFO') => {
    setLogs(curr => {
      const timeStr = new Date().toISOString().substring(11, 23);
      const newLogs = [...curr, { msg: `[${timeStr}] [${level}] ${msg}`, level }];
      if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
      return newLogs;
    });
  };

  // Mock Terminal Logs
  useEffect(() => {
    const msgs = [
      "[WARN] 视频流部分帧丢失，尝试恢复解码缓冲",
      "[WARN] YOLOv8-pose 节点 GPU 负载瞬时过高",
      "[WARN] 光线抖动异常，关键点跟踪反馈轻微误差"
    ];
    setLogs([{ msg: "[INIT] 系统启动完成，加载核心神经网络...", level: 'INFO'}]);
    
    // Sparse random warnings
    const t = setInterval(() => {
      if (Math.random() > 0.8) {
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        addLog(msg, 'WARN');
      }
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const handlePostureChange = (newId: PostureId, name: string, isCorrect: boolean) => {
    if (newId === activePostureId) return;
    if (soundEnabled) playFeedbackSound(isCorrect);
    setActivePostureId(newId);
    addLog(`用户输入覆盖: 已无缝切换至姿态预设【${name}】视图`, isCorrect ? 'INFO' : 'WARN');
  };

  return (
    <div className="min-h-screen font-sans tracking-wide selection:bg-[#165DFF]/30 overflow-x-hidden relative flex flex-col">

      {/* Header */}
      <header className="flex justify-between items-center px-4 md:px-8 mb-2 shrink-0 sticky top-0 z-50 pt-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-[#165DFF] to-cyan-500 rounded-xl shadow-[0_0_20px_rgba(22,93,255,0.3)]">
            <Scan className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-[#165DFF] bg-clip-text text-transparent">
              握笔姿势识别矫正系统
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 tracking-widest uppercase">智能可视化分析核心 v2.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-all ${soundEnabled ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800/80 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
            title={soundEnabled ? "关闭提示音" : "开启声音反馈"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <div className="hidden md:flex gap-6 text-xs text-cyan-300/80 font-mono bg-slate-900/80 px-4 py-2 rounded-lg border border-[#165DFF]/20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              LIVE FLux
            </div>
            <div className="w-[1px] bg-cyan-800/50" />
            <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> 29 FPS</div>
            <div className="w-[1px] bg-cyan-800/50" />
            <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> LAT: 32ms</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex items-stretch justify-center w-full max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 w-full h-full pb-4 auto-rows-max">
          
          {/* 1. Camera View Area (Bento: Large Primary) */}
          <div className="md:col-span-2 lg:col-span-7 xl:col-span-8 lg:row-span-2 flex-1 min-h-[400px] md:min-h-[500px] relative glass-card overflow-hidden group border border-slate-700/50 shadow-2xl">
            {/* Camera Tech Accents */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <div className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC
              </div>
              <div className="px-2 py-1 bg-slate-800/80 backdrop-blur-sm text-cyan-300 text-[10px] font-mono rounded border border-cyan-500/30">
                CAMERA 01 (1920x1080)
              </div>
            </div>

            {/* Grid Background Mocking Real World tracking surface */}
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] bg-[size:40px_40px]" />
            
            {/* Hand Visualizer Engine */}
            <MockVisualizer postureId={activePostureId} isCorrect={activeData.isCorrect} name={activeData.name} />

            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 m-4 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 m-4 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 m-4 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 m-4 rounded-br-lg" />
          </div>

          {/* 2. Detection Result Card (Bento: Top Right) */}
          <div className="md:col-span-1 lg:col-span-5 xl:col-span-4 glass-card p-5 md:p-6 relative overflow-hidden flex flex-col justify-center border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-900/20 to-transparent">
            {/* Glow Behind */}
            <div className={`absolute -right-12 -top-12 w-40 h-40 blur-[50px] rounded-full opacity-30 ${activeData.isCorrect ? 'bg-green-500' : 'bg-rose-500'}`} />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <h3 className="text-slate-300 font-medium text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-[#165DFF]" /> 实时智能诊断
              </h3>
              <span className="text-xs font-mono text-cyan-400 px-2 py-1 bg-cyan-400/10 rounded border border-cyan-500/20">
                置信度 {(Math.random() * 0.04 + 0.94).toFixed(3)}
              </span>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeData.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 relative z-10 flex-1 flex flex-col justify-center"
              >
                <div className="flex items-end gap-3 mb-1">
                  <span className={`text-3xl xl:text-4xl font-black tracking-widest ${activeData.isCorrect ? 'text-green-400' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]'}`}>
                    {activeData.name}
                  </span>
                </div>
                <span className={`text-sm font-medium ${activeData.isCorrect ? 'text-green-500/70' : 'text-rose-500/70'}`}>
                  {activeData.isCorrect ? 'STATUS: 体态正常' : 'STATUS: 检测到肌肉借力异常'}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 3. Correction Advice Card (Bento: Middle Right) */}
          <div className={`md:col-span-1 lg:col-span-5 xl:col-span-4 glass-card p-5 md:p-6 transition-colors duration-500 relative overflow-hidden flex flex-col justify-center ${activeData.isCorrect ? 'bg-[rgba(34,197,94,0.08)]' : 'bg-[rgba(245,158,11,0.08)]'}`}>
            <div className={`absolute left-0 top-0 w-1 h-full ${activeData.isCorrect ? 'bg-green-500' : 'bg-amber-500'} opacity-80`} />
            
            <h3 className={`text-sm font-medium mb-4 flex items-center gap-2 ${activeData.isCorrect ? 'text-green-400' : 'text-amber-400'}`}>
              {activeData.isCorrect ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              {activeData.isCorrect ? 'AI 表现评估' : 'AI 矫正处方'}
            </h3>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeData.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-slate-300 leading-relaxed text-sm flex-1 flex items-center"
              >
                {activeData.advice}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 4. Demo Control Panel (Bento: Bottom Left) */}
          <div className="md:col-span-2 lg:col-span-7 xl:col-span-8 glass-card p-5 md:p-6 flex-1 flex flex-col">
            <div className="mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-slate-200 font-bold text-sm flex items-center gap-2 mb-1">
                <Fingerprint className="w-4 h-4 text-[#165DFF]" />
                异常姿态注入控制台 
                <span className="text-[10px] ml-2 font-mono px-1.5 py-0.5 bg-[#165DFF]/20 text-[#165DFF] rounded">DEMO MODE</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">点击下方按钮可快速强制注入测试案例，用于演示系统的骨骼描绘与响应匹配能力。</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 flex-1 auto-rows-max">
              {postureData.map((p) => {
                const isActive = activePostureId === p.id;
                let baseStyle = "px-1 md:px-2 py-2 md:py-3 rounded-xl items-center justify-center flex text-xs font-semibold transition-all duration-300 border backdrop-blur-sm cursor-pointer select-none text-center ";
                
                if (isActive) {
                  baseStyle += p.isCorrect 
                    ? "bg-green-500/20 border-green-400 text-green-300 shadow-[0_0_15px_rgba(74,222,128,0.25)]" 
                    : "bg-rose-500/20 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(251,113,133,0.25)]";
                } else {
                  baseStyle += "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.1)] text-slate-400 hover:text-slate-200 hover:border-slate-400";
                }

                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePostureChange(p.id, p.name, p.isCorrect)}
                    className={baseStyle}
                  >
                    {p.name}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 5. Terminal Logs (Bento: Bottom Right) */}
          <div className="md:col-span-2 lg:col-span-5 xl:col-span-4 glass-card flex flex-col shadow-inner overflow-hidden transition-all duration-300 relative border-t-2 border-t-slate-800">
            {/* Header / Toggle */}
            <div 
              onClick={() => setLogsExpanded(!logsExpanded)}
              className="px-4 md:px-5 py-3 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <MonitorPlay className="w-4 h-4 text-[#165DFF]" />
                [终端] VISION.AI_CORE/LOGS
              </div>
              <div className="text-[10px] text-slate-500 font-mono flex gap-2">
                <span>FILTER: WARNING+</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">{logsExpanded ? 'COLLAPSE (-)' : 'EXPAND (+)'}</span>
              </div>
            </div>

            {/* Log Body */}
            <div 
              className={`px-4 md:px-5 pb-4 font-mono text-[11px] leading-relaxed flex flex-col-reverse overflow-y-auto transition-all duration-500 ${logsExpanded ? 'max-h-[300px]' : 'max-h-[140px]'}`}
            >
              {(logsExpanded ? logs : logs.slice(-5)).map((logObj, i) => (
                <div key={i} className={`mt-1 hover:brightness-125 transition-all text-shadow-sm ${logObj.level === 'WARN' ? 'text-amber-400' : 'text-cyan-300/80'}`}>
                  {logObj.msg}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
