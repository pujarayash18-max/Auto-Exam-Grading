'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, CheckCircle, Clock } from 'lucide-react';

export default function StudentExamView({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [exam, setExam] = useState<any>(null);
  const [status, setStatus] = useState('waiting'); // waiting, in_progress, completed
  const [transcript, setTranscript] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + ' ';
          }
          setTranscript(text.trim());
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Poll real exam and student session status from backend
  useEffect(() => {
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        // Fetch real session state from backend
        const res = await fetch(`http://localhost:8000/api/v1/viva/student-session/${params.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setStatus(data.status || 'waiting');
          if (data.subject_name) {
            setExam((prev: any) => ({ ...prev, subject_name: data.subject_name }));
          }
          if (data.active_question) {
            setCurrentQuestion(data.active_question);
          } else if (data.status === 'completed') {
            setCurrentQuestion(null);
          }
        }
      } catch (err) {
        console.error("Session polling error:", err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [params.id, router]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
    } else {
      setTranscript('');
      setFeedback(null);
      setScore(null);
      audioChunksRef.current = [];

      // Start MediaRecorder for audio capture
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn('MediaRecorder not available, continuing without audio capture:', err);
      }

      // Start Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          setIsRecording(true);
        }
      } else {
        setIsRecording(true);
      }
    }
  };

  const handleSubmitAnswer = async () => {
    if (!transcript.trim()) {
      alert("Please speak or write an answer first.");
      return;
    }
    if (!currentQuestion?.id) return;

    setEvaluating(true);
    setFeedback("Ollama (Llama-3) is evaluating your oral response...");
    
    // Convert recorded audio to base64
    let audioBase64: string | null = null;
    if (audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioBase64 = btoa(binary);
      } catch (err) {
        console.warn('Error encoding audio:', err);
      }
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/viva/student-session/${params.id}/submit-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          transcript: transcript.trim(),
          audio_data: audioBase64
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Submission failed");
      }

      const data = await res.json();
      setScore(data.score);
      setFeedback(data.feedback);
    } catch (err: any) {
      setFeedback("Error submitting answer: " + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleLeave = () => {
    router.push('/student/dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 selection:bg-primary/30 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Oral Viva</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-medium border border-primary/20">
                {exam?.subject_name || `Exam #${params.id}`}
              </span>
              <span className="text-xs text-muted-foreground font-medium">AI Graded</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wider uppercase border
              ${status === 'waiting' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 
                status === 'in_progress' ? 'bg-primary/10 text-primary border-primary/20' : 
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
              {status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {status === 'waiting' && (
          <div className="glass-panel p-12 rounded-2xl border border-border flex flex-col items-center justify-center text-center h-[50vh]">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse border border-amber-500/30">
              <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">Exam Waiting Room</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              You are in the waiting room for this viva. As soon as your faculty examiner admits and starts your session, the question will appear here automatically.
            </p>
            <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Polling Active (Every 3s)
            </div>
          </div>
        )}

        {status === 'in_progress' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Question & Controls */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm relative min-h-[200px] flex flex-col justify-center">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Question {currentQuestion?.question_index || 1} of {currentQuestion?.total_questions || 5}
                  </h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Active</span>
                </div>
                <p className="text-xl text-foreground font-medium leading-relaxed">
                  {currentQuestion?.question_text || "Waiting for question..."}
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center min-h-[200px] gap-6">
                <button 
                  onClick={handleToggleRecording} 
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isRecording 
                      ? 'bg-destructive/10 border-4 border-destructive text-destructive animate-pulse' 
                      : 'bg-primary/10 border-4 border-primary text-primary hover:bg-primary/20 hover:scale-105'
                  }`}
                >
                  <div className="text-center flex flex-col items-center">
                    {isRecording ? <Square className="w-10 h-10 mb-2 fill-current" /> : <Mic className="w-10 h-10 mb-2" />}
                    <span className="font-bold">{isRecording ? 'STOP' : 'SPEAK'}</span>
                  </div>
                </button>
                <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
                  {isRecording ? 'Recording Speech...' : 'Click to Speak (or Type below)'}
                </p>
              </div>
            </div>

            {/* Right Column: Transcript & Feedback */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col h-64">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Your Spoken Answer</h2>
                  <span className="text-xs text-muted-foreground">Live Voice Transcription</span>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your oral answer will appear here in real-time as you speak..."
                  className="flex-1 w-full bg-muted/50 rounded-xl p-3 font-mono text-sm text-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={evaluating || !transcript.trim()}
                    className="h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-40"
                  >
                    {evaluating ? 'Grading...' : 'Submit Answer ➔'}
                  </button>
                </div>
              </div>

              {feedback && (
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Evaluation</h4>
                    {score !== null && (
                      <span className="bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-md text-xs border border-primary/20">
                        Score: {score}/100
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{feedback}</p>
                </div>
              )}
            </div>
            
          </div>
        )}

        {status === 'completed' && (
          <div className="glass-panel p-12 rounded-2xl border border-border flex flex-col items-center shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Viva Completed!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your viva has been successfully recorded and evaluated. Your faculty will review and publish your final grade shortly.
            </p>
            <button
              onClick={handleLeave}
              className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        <div className="glass-panel p-4 rounded-2xl border border-border shadow-sm flex justify-end">
          <button 
            onClick={handleLeave}
            className="px-6 py-3 bg-muted hover:bg-muted/80 border border-border rounded-xl font-medium transition-colors text-muted-foreground hover:text-foreground"
          >
            Leave Exam
          </button>
        </div>

      </div>
    </div>
  );
}
