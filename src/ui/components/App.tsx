// To support: system="express" scale="medium" color="light"
// import these spectrum web components modules:
import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";

// To learn more about using "swc-react" visit:
// https://opensource.adobe.com/spectrum-web-components/using-swc-react/
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import { ProgressCircle } from "@swc-react/progress-circle";
import React, { useEffect, useState, useRef } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import "./App.css";

import { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

// Define app state type
type AppState = 'INITIAL' | 'LOADING_VIDEOS' | 'VIDEO_SELECTION' | 'ANALYZING' | 'TRANSCRIPT_GENERATED' | 'TRANSCRIPT_ERROR' | 'API_KEY_INPUT' | 'VIRAL_SEGMENT_FOUND' | 'ASSEMBLY_API_KEY_INPUT' | 'UPLOAD_VIDEO';

// Define the debug information interface
interface DebugInfo {
  transcript: string;
  timestamps: any[];
  analysisResult: any;
  transcriptInfo?: {
    segmentCount: number;
    totalDuration: number;
    generatedAt: string;
  };
  error: string | null;
}

// Define video interface
interface Video {
  id: string;
  name: string;
  duration: number;
  url: string;
}

const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
  // State variables
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [openAIApiKey, setOpenAIApiKey] = useState<string>('');
  const [assemblyAIApiKey, setAssemblyAIApiKey] = useState<string>('aadd1462e8824ed584a6cb8466e1f17e');
  const [isOpenAIApiKeyValid, setIsOpenAIApiKeyValid] = useState<boolean>(false);
  const [isAssemblyAIApiKeyValid, setIsAssemblyAIApiKeyValid] = useState<boolean>(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentPreviewTime, setCurrentPreviewTime] = useState<number>(0);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>("");
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const videoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize with empty API keys - user will need to provide them
    const demoOpenAIApiKey = '';
    
    // Initialize OpenAI with empty key
    sandboxProxy.setOpenAIApiKey(demoOpenAIApiKey);
    setOpenAIApiKey(demoOpenAIApiKey);
    setIsOpenAIApiKeyValid(false);
    
    // Initialize AssemblyAI with empty key
    const assemblyAIKey = '';
    sandboxProxy.setAssemblyAIApiKey(assemblyAIKey);
    setAssemblyAIApiKey(assemblyAIKey);
    setIsAssemblyAIApiKeyValid(false);
    
    // Set the app state to initial since we already have the API keys
    setAppState('INITIAL');
  }, [sandboxProxy]);

  const handleSetAssemblyAIApiKey = async () => {
    if (!assemblyAIApiKey || assemblyAIApiKey.trim() === '') {
      setError('Please enter a valid AssemblyAI API key');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setError('');
      
      // Set the AssemblyAI API key
      const success = await sandboxProxy.setAssemblyAIApiKey(assemblyAIApiKey);
      
      if (success) {
        setIsAssemblyAIApiKeyValid(true);
        setAppState('INITIAL');
        console.log('AssemblyAI API key set successfully');
      } else {
        setError('Failed to set AssemblyAI API key');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred setting the AssemblyAI API key');
      console.error('AssemblyAI API key error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleAnalyzeClick = async () => {
    try {
      if (!isAssemblyAIApiKeyValid) {
        setAppState('ASSEMBLY_API_KEY_INPUT');
        return;
      }
      
      // If we have an uploaded video, use that instead of document videos
      if (uploadedVideo) {
        await handleUploadedVideoAnalysis();
        return;
      }
      
      setIsAnalyzing(true);
      setError("");
      setAppState('ANALYZING');
      
      // Call the sandbox API to analyze the video
      const result = await sandboxProxy.analyzeVideo('video1');
      console.log('Analysis result:', result);
      
      if (result.status === 'success') {
        setAppState('TRANSCRIPT_GENERATED');
      } else {
        setAppState('TRANSCRIPT_ERROR');
        setError(result.error || 'Failed to analyze video');
      }
      
      // Get debug info
      const debug = await sandboxProxy.getDebugInfo();
      console.log('Debug info:', debug);
      
      setDebugInfo(debug);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      console.error('Analysis error:', err);
      setAppState('TRANSCRIPT_ERROR');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check if the file is a video
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file');
      return;
    }
    
    // Create a URL for the video
    const videoUrl = URL.createObjectURL(file);
    
    setUploadedVideo(file);
    setUploadedVideoUrl(videoUrl);
    setError('');
    console.log(`Video uploaded: ${file.name} (${file.size} bytes)`);
  };
  
  // Handle analysis of uploaded video
  const handleUploadedVideoAnalysis = async () => {
    if (!uploadedVideo) {
      setError('Please upload a video first');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setError("");
      setAppState('ANALYZING');
      
      // Convert the video file to base64
      const base64Video = await convertFileToBase64(uploadedVideo);
      
      // Call the sandbox API to analyze the uploaded video
      const result = await sandboxProxy.uploadAndAnalyzeVideo(base64Video, uploadedVideo.name);
      console.log('Analysis result:', result);
      
      if (result.status === 'success') {
        setAppState('TRANSCRIPT_GENERATED');
        setAnalysisResult(result);
      } else {
        setAppState('TRANSCRIPT_ERROR');
        setError(result.error || 'Failed to analyze uploaded video');
      }
      
      // Get debug info
      const debug = await sandboxProxy.getDebugInfo();
      console.log('Debug info:', debug);
      
      setDebugInfo(debug);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      console.error('Analysis error:', err);
      setAppState('TRANSCRIPT_ERROR');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Convert file to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g., "data:video/mp4;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  // Function to toggle video playback
  // Cleanup timers on unmount
  useEffect(() => {    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
      }
    };
  }, []);
  
  // Function to start timer animation for simulating video playback
  const startTimerAnimation = () => {
    // Use a timer to simulate video playback
    timerRef.current = window.setInterval(() => {
      setCurrentTime(prevTime => {
        const newTime = prevTime + 1;
        return newTime > 60 ? 0 : newTime;
      });
    }, 1000) as unknown as number;
  };
  
  // Function to handle video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(Math.floor(videoRef.current.currentTime));
    }
  };
  
  // Function to toggle video playback
  const toggleVideoPlayback = () => {
    if (isVideoPlaying) {
      // Pause video
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsVideoPlaying(false);
    } else {
      // Play video
      setIsVideoPlaying(true);
      if (videoRef.current) {
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
          startTimerAnimation();
        });
      } else {
        startTimerAnimation();
      }
    }
  };
  
  
  // Function to set the OpenAI API key
  const submitOpenAIApiKey = async () => {
    if (!openAIApiKey.trim()) {
      setError("Please enter a valid OpenAI API key");
      return;
    }
    
    try {
      const success = await sandboxProxy.setOpenAIApiKey(openAIApiKey.trim());
      if (success) {
        setIsOpenAIApiKeyValid(true);
        setError("");
        // Proceed to detect videos
        detectVideos();
      } else {
        setError("Failed to set OpenAI API key. Please try again.");
      }
    } catch (err) {
      setError("An error occurred while setting the OpenAI API key.");
    }
  };
  
  // Function to detect videos in the document
  const detectVideos = async () => {
    try {
      setAppState('LOADING_VIDEOS');
      
      // Simulate fetching videos from the document
      // Using a mock implementation since getVideosInDocument doesn't exist
      const mockVideos = [
        { id: 'video1', name: 'Sample Video', duration: 60 }
      ];
      
      // Add url property to each video to match the Video interface
      const videosWithUrl = mockVideos.map(v => ({
        ...v,
        url: `video://${v.id}`
      }));
      
      setVideos(videosWithUrl);
      
      if (videosWithUrl.length === 0) {
        setAppState('VIDEO_SELECTION');
        setError("No videos found in the document. Please add a video and try again.");
      } else if (videosWithUrl.length === 1) {
        // If only one video, select it automatically
        setSelectedVideo(videosWithUrl[0]);
        setAppState('VIDEO_SELECTION');
      } else {
        // Multiple videos found, let user select
        setAppState('VIDEO_SELECTION');
      }
    } catch (err) {
      setError("Error detecting videos: " + String(err));
      setAppState('INITIAL');
    }
  };
  
  // Function to analyze the selected video
  const analyzeVideo = async () => {
    if (!selectedVideo) return;
    
    try {
      setAppState('ANALYZING');
      setIsAnalyzing(true);
      
      // Call the sandbox API to analyze the video
      const result = await sandboxProxy.analyzeVideo(selectedVideo.id);
      setAnalysisResult(result);
      
      // Assuming the result has a status property instead of success
      if (result && result.status === 'success') {
        setAppState('TRANSCRIPT_GENERATED');
        setCurrentPreviewTime(0);
      } else {
        setAppState('TRANSCRIPT_ERROR');
      }
    } catch (err) {
      setError("Error analyzing video: " + String(err));
      setAppState('TRANSCRIPT_ERROR');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Function to fetch debug information
  const fetchDebugInfo = async () => {
    try {
      const info = await sandboxProxy.getDebugInfo();
      setDebugInfo(info);
    } catch (err) {
      console.error('Error fetching debug info:', err);
    }
  };
  
  // Function to insert the viral clip
  const insertViralClip = async () => {
    if (!selectedVideo || !analysisResult || !analysisResult.viralSegment) return;
    
    try {
      setAppState('ANALYZING');
      
      // Extract the viral segment from the video
      const success = await sandboxProxy.insertViralClip(
        selectedVideo.id,
        analysisResult.viralSegment.start,
        analysisResult.viralSegment.end
      );
      
      if (success) {
        setAppState('VIRAL_SEGMENT_FOUND');
      } else {
        setAppState('TRANSCRIPT_ERROR');
        setError("Failed to insert viral clip.");
      }
    } catch (err) {
      setError("Error inserting viral clip: " + String(err));
      setAppState('TRANSCRIPT_ERROR');
    }
  };
  
  // Function to format time in mm:ss format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Call fetchDebugInfo after analyzing video
  useEffect(() => {
    if (appState === 'TRANSCRIPT_GENERATED') {
      fetchDebugInfo();
    }
  }, [appState, sandboxProxy]);

  return (
    <Theme system="express" scale="medium" color="light">
      <div className="container">
        <header className="app-header">
          <h1>Viral Byte Detector</h1>
          <p className="subtitle">Find the most viral segment in your video for TikTok</p>
          <p className="version-info">Version 1.3.0 - Real transcription with AssemblyAI</p>
        </header>
        
        <div className="app-content">
          {appState === 'ASSEMBLY_API_KEY_INPUT' ? (
            <div className="api-key-input-container" style={{ marginBottom: '20px' }}>
              <h3>Enter your AssemblyAI API Key</h3>
              <p>We need your AssemblyAI API key to transcribe your videos. You can get a free API key from <a href="https://www.assemblyai.com/" target="_blank" rel="noopener noreferrer">AssemblyAI</a>.</p>
              
              <div style={{ marginBottom: '10px' }}>
                <input 
                  type="password" 
                  value={assemblyAIApiKey} 
                  onChange={(e) => setAssemblyAIApiKey(e.target.value)}
                  placeholder="Enter your AssemblyAI API key"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                />
              </div>
              
              <Button variant="accent" onClick={handleSetAssemblyAIApiKey} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <ProgressCircle size="s" indeterminate /> 
                    <span style={{ marginLeft: '8px' }}>Setting API Key...</span>
                  </>
                ) : 'Set AssemblyAI API Key'}
              </Button>
            </div>
          ) : (
            <>
              {uploadedVideoUrl ? (
                <div className="video-container" style={{ marginBottom: '20px' }}>
                  <video 
                    ref={videoRef}
                    src={uploadedVideoUrl} 
                    controls 
                    style={{ width: '100%', maxHeight: '200px' }}
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
              ) : (
                <div 
                  className="video-placeholder" 
                  style={{ height: '200px', backgroundColor: '#f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', cursor: 'pointer' }}
                >
                  <div className="play-icon" style={{ marginBottom: '10px' }}>▶</div>
                  <div>Upload a video to analyze</div>
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileUpload}
                    style={{ marginTop: '15px' }}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <Button variant="accent" onClick={handleAnalyzeClick} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <ProgressCircle size="s" indeterminate /> 
                      <span style={{ marginLeft: '8px' }}>Analyzing with AssemblyAI & OpenAI...</span>
                    </>
                  ) : 'Generate Transcript'}
                </Button>
                
                {uploadedVideoUrl && (
                  <Button variant="secondary" onClick={() => {
                    setUploadedVideo(null);
                    setUploadedVideoUrl("");
                  }}>
                    Clear Video
                  </Button>
                )}
              </div>
            </>
          )}
          
          {error && (
            <div className="error-message" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff0f0', borderRadius: '4px', color: '#d00' }}>
              <span style={{ marginRight: '8px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          <div className="button-row" style={{ marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => setShowDebugPanel(!showDebugPanel)}>
              {showDebugPanel ? 'Hide Debug Info' : 'Show Debug Info'}
            </Button>
          </div>
          
          {showDebugPanel && (
            <div className="debug-panel">
              <h3>Debug Information</h3>
              
              <div className="debug-section">
                <h4>Transcript Generated by AssemblyAI</h4>
                <div className="debug-content transcript">
                  {debugInfo?.transcript ? (
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                      {debugInfo.transcript}
                    </pre>
                  ) : 'No transcript available - Click "Generate Transcript" to create one'}
                </div>
              </div>
              
              {debugInfo?.transcriptInfo && (
                <div className="debug-section">
                  <h4>Transcript Info:</h4>
                  <div className="debug-content">
                    <p><strong>Segments:</strong> {debugInfo.transcriptInfo.segmentCount}</p>
                    <p><strong>Total Duration:</strong> {formatTime(debugInfo.transcriptInfo.totalDuration)}</p>
                    <p><strong>Generated:</strong> {new Date(debugInfo.transcriptInfo.generatedAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
              
              <div className="debug-section">
                <h4>Timestamps:</h4>
                <div className="debug-content timestamps-container">
                  {debugInfo?.timestamps && debugInfo.timestamps.length > 0 ? (
                    <div className="timestamps-grid">
                      {debugInfo.timestamps.map((ts, index) => (
                        <div key={index} className="timestamp-item">
                          {typeof ts === 'number' ? (
                            <span>{formatTime(ts)}</span>
                          ) : (
                            <div>
                              <span>{formatTime(ts.start)} - {formatTime(ts.end)}</span>
                              {ts.duration && <span className="duration"> ({ts.duration})</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : 'No timestamps available'}
                </div>
              </div>
              
              <div className="debug-section">
                <h4>OpenAI Analysis Result:</h4>
                <div className="debug-content">
                  {debugInfo?.analysisResult ? (
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                      {JSON.stringify(debugInfo.analysisResult, null, 2)}
                    </pre>
                  ) : 'No analysis result available'}
                </div>
              </div>
              
              {debugInfo?.error && (
                <div className="debug-section error">
                  <h4>Error:</h4>
                  <div className="debug-content">
                    {debugInfo.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Theme>
  );
};

export default App;
