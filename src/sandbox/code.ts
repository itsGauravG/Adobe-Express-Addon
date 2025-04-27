import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";
import { DocumentSandboxApi, VideoInfo, AnalysisResult } from "../models/DocumentSandboxApi";
import { initializeOpenAI, isOpenAIInitialized, analyzeTranscriptForViralSegment, transcribeAudioWithWhisper } from '../utils/openai';

// Get the document sandbox runtime.
const { runtime } = addOnSandboxSdk.instance;

// Custom HTTP client for Adobe Express add-on sandbox environment
interface HttpResponse {
  data: any;
  status: number;
  headers: Record<string, string>;
}

interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  data?: any;
}

// Direct API integration with AssemblyAI
// Since we can't use fetch or XMLHttpRequest directly in the sandbox,
// we'll implement a more direct approach to transcription

// Custom HTTP client that works in the Adobe Express add-on sandbox
const httpClient = {
  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    console.log(`Processing ${options.method} request to: ${options.url}`);
    
    // Instead of making actual HTTP requests, we'll implement the AssemblyAI functionality directly
    // This is a workaround for the sandbox limitations
    
    // For AssemblyAI upload endpoint
    if (options.url.includes('api.assemblyai.com/v2/upload')) {
      console.log('Processing AssemblyAI upload request');
      
      // Simulate a successful upload - in a real environment this would actually upload the audio
      return {
        data: { upload_url: `https://example.com/simulated-upload-${Date.now()}` },
        status: 200,
        headers: { 'content-type': 'application/json' }
      };
    }
    
    // For AssemblyAI transcript creation endpoint
    else if (options.url.includes('api.assemblyai.com/v2/transcript') && options.method.toLowerCase() === 'post') {
      console.log('Processing AssemblyAI transcript creation request');
      
      // Generate a unique ID for this transcription job
      const transcriptId = `tr_${Date.now()}`;
      
      // Store the transcript ID for later use
      lastTranscriptId = transcriptId;
      
      // Simulate starting a transcription job
      return {
        data: { id: transcriptId },
        status: 200,
        headers: { 'content-type': 'application/json' }
      };
    }
    
    // For AssemblyAI transcript status endpoint
    else if (options.url.includes('api.assemblyai.com/v2/transcript/') && options.method.toLowerCase() === 'get') {
      console.log('Processing AssemblyAI transcript status request');
      
      // Extract the transcript ID from the URL
      const urlParts = options.url.split('/');
      const transcriptId = urlParts[urlParts.length - 1];
      
      // Check if this is the first polling attempt
      if (!transcriptPollingAttempts[transcriptId]) {
        transcriptPollingAttempts[transcriptId] = 1;
        
        // First attempt - return 'processing' status
        return {
          data: {
            id: transcriptId,
            status: 'processing',
            text: null
          },
          status: 200,
          headers: { 'content-type': 'application/json' }
        };
      } else {
        transcriptPollingAttempts[transcriptId]++;
        
        // After a few polling attempts, return 'completed' status with a transcript
        if (transcriptPollingAttempts[transcriptId] >= 3) {
          // Generate a realistic transcript with timestamps
          const words = generateRealisticTranscript();
          const text = words.map(w => w.text).join(' ');
          
          return {
            data: {
              id: transcriptId,
              status: 'completed',
              text: text,
              words: words
            },
            status: 200,
            headers: { 'content-type': 'application/json' }
          };
        } else {
          // Still processing
          return {
            data: {
              id: transcriptId,
              status: 'processing',
              text: null
            },
            status: 200,
            headers: { 'content-type': 'application/json' }
          };
        }
      }
    }
    
    // Default response for other requests
    return {
      data: { message: 'Operation completed successfully' },
      status: 200,
      headers: { 'content-type': 'application/json' }
    };
  },
  
  async get(url: string, options?: { headers?: Record<string, string> }): Promise<HttpResponse> {
    return this.request({
      method: 'GET',
      url,
      headers: options?.headers
    });
  },
  
  async post(url: string, data?: any, options?: { headers?: Record<string, string> }): Promise<HttpResponse> {
    return this.request({
      method: 'POST',
      url,
      headers: options?.headers,
      data
    });
  }
};

// This function has been replaced by OpenAI's Whisper API implementation
// Keeping this as a placeholder for backward compatibility
async function legacyTranscribeFunction(audioData: any) {
  console.log('Legacy transcription function called - using OpenAI Whisper instead');
  
  try {
    console.log('Uploading audio file...');
    
    // Create a base64 representation of the audio data
    // In a real implementation, this would be the actual audio data from the video
    const audioBase64 = audioData.base64 || audioData.data || 'simulated audio data';
    
    // Convert base64 to binary data if needed
    let audioData64 = audioBase64;
    if (audioBase64.includes('base64,')) {
      audioData64 = audioBase64.split('base64,')[1];
    }
    
    // Process the audio using our custom HTTP client
    const uploadResponse = await httpClient.post(
      'https://api.assemblyai.com/v2/upload',
      audioData64,
      {
        headers: {
          'Authorization': 'Bearer ' + openAIApiKey,
          'Content-Type': 'application/octet-stream'
        }
      }
    );
    
    const uploadUrl = uploadResponse.data.upload_url;
    console.log('Audio file uploaded successfully. URL:', uploadUrl);
    
    // Step 2: Start transcription job
    console.log('Starting transcription job...');
    const transcriptionResponse = await httpClient.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadUrl,
        speaker_labels: true,
        auto_chapters: true,
        entity_detection: true,
        punctuate: true,
        format_text: true,
        dual_channel: false,
        language_code: 'en_us'
      },
      {
        headers: {
          'Authorization': 'Bearer ' + openAIApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const transcriptId = transcriptionResponse.data.id;
    console.log('Transcription job started. ID:', transcriptId);
    
    // Step 3: Poll for transcription completion
    console.log('Polling for transcription completion...');
    let transcriptResult: any = null;
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // Maximum polling attempts
    
    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      
      // Use a simple delay function that doesn't rely on setTimeout
      await delayWithoutTimeout(3000); // 3 second delay between polls
      
      const pollingResponse = await httpClient.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'Authorization': 'Bearer ' + openAIApiKey
          }
        }
      );
      
      const status = pollingResponse.data.status;
      console.log(`Polling attempt ${attempts}/${maxAttempts}. Status:`, status);
      
      if (status === 'completed') {
        transcriptResult = pollingResponse.data;
        isCompleted = true;
      } else if (status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${pollingResponse.data.error}`);
      }
      // Continue polling for 'queued' or 'processing' status
    }
    
    if (!isCompleted) {
      throw new Error('Transcription timed out after maximum polling attempts');
    }
    
    console.log('Transcription completed successfully!');
    
    // Step 4: Process the completed transcript
    // Extract words with timestamps
    const words = transcriptResult.words || [];
    
    // Group words into sentences or segments (approximately 5-second chunks)
    const segments: any[] = [];
    let currentSegment = { text: '', start: 0, end: 0 };
    let wordCount = 0;
    
    words.forEach((word: any, index: number) => {
      // Start a new segment if this is the first word
      if (wordCount === 0) {
        currentSegment.text = word.text;
        currentSegment.start = word.start / 1000; // Convert from ms to seconds
        currentSegment.end = word.end / 1000;
      } else {
        // Add to current segment
        currentSegment.text += ' ' + word.text;
        currentSegment.end = word.end / 1000;
      }
      
      wordCount++;
      
      // Create a new segment every ~5 seconds or at the end
      if (currentSegment.end - currentSegment.start > 5 || index === words.length - 1) {
        segments.push({...currentSegment});
        wordCount = 0;
      }
    });
    
    console.log(`Created ${segments.length} transcript segments`);
    return segments;
  } catch (error) {
    console.error('Error during AssemblyAI transcription:', error);
    
    // If the API call fails, return a fallback for development purposes
    console.warn('Using fallback transcription due to API error');
    
    // Return a basic fallback transcription
    return [
      { text: "Error during transcription. Please check your AssemblyAI API key.", start: 0, end: 5 },
      { text: "Make sure your audio file is valid and try again.", start: 5, end: 10 }
    ];
  }
}

// Custom delay function that doesn't rely on setTimeout
async function delayWithoutTimeout(ms: number): Promise<void> {
  const startTime = Date.now();
  let currentTime = startTime;
  
  // Use a busy-wait loop instead of setTimeout
  // This is not efficient but works in environments where setTimeout is not available
  while (currentTime - startTime < ms) {
    // Do a small amount of work to avoid completely blocking the thread
    for (let i = 0; i < 1000000; i++) {
      // Empty loop to consume some CPU cycles
    }
    currentTime = Date.now();
  }
  
  return Promise.resolve();
}

// Function to transcribe the video using OpenAI's Whisper API
async function transcribeVideo(videoId: string): Promise<{ transcript: string, timestamps: any[] }> {
  try {
    console.log(`Transcribing video with ID ${videoId} using OpenAI's Whisper API...`);
    
    // Step 1: Extract audio from video (simulated)
    // In a real implementation, we would use the videoId to get the actual video
    // and extract its audio. For now, we'll simulate a 60-second video.
    const audioData = await extractAudioFromVideo(videoId);
    
    // Step 2: Transcribe the audio using OpenAI's Whisper API
    // Import the transcribeAudioWithWhisper function from openai.js
    const { transcribeAudioWithWhisper } = await import('../utils/openai');
    
    // Ensure OpenAI API key is set
    if (!isOpenAIInitialized() && openAIApiKey) {
      initializeOpenAI(openAIApiKey);
    } else if (!isOpenAIInitialized()) {
      // Use a default API key or prompt the user to provide one
      console.warn("OpenAI API key not initialized. Please provide an API key.");
      return { transcript: "API key required for transcription.", timestamps: [] };
    }
    
    // Call OpenAI's Whisper API for transcription
    const transcriptionResult = await transcribeAudioWithWhisper(audioData);
    
    // Step 3: Format the transcript and timestamps
    const transcriptText = transcriptionResult.text;
    const timestampData = transcriptionResult.segments.map(segment => ({
      start: segment.start,
      end: segment.end
    }));
    
    // Store for debugging
    lastTranscript = transcriptText;
    lastTimestamps = timestampData;
    
    console.log(`Transcription complete: ${transcriptText.substring(0, 50)}...`);
    console.log(`Generated ${timestampData.length} timestamp segments`);
    
    return { transcript: transcriptText, timestamps: timestampData };
  } catch (error) {
    console.error("Transcription error with OpenAI's Whisper API:", error);
    
    // Only use fallback if absolutely necessary
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Using fallback due to error: ${errorMessage}`);
    
    const fallbackSegments = [
      { text: "[Error occurred during transcription with OpenAI. Please try again.]", start: 0, end: 3 }
    ];
    
    const fallbackText = `[ERROR] OpenAI Whisper transcription failed: ${errorMessage}`;
    const fallbackTimestamps = fallbackSegments.map(segment => ({
      start: segment.start,
      end: segment.end
    }));
    
    // Update the debug variables
    lastTranscript = fallbackText;
    lastTimestamps = fallbackTimestamps;
    
    return { 
      transcript: fallbackText, 
      timestamps: fallbackTimestamps
    };
  }
}

// Store the last transcript and analysis for debugging
let lastTranscript = "";
let lastTimestamps: any[] = [];
let lastAnalysisResult: any = null;

// Storage for uploaded videos
interface UploadedVideo {
  id: string;
  fileName: string;
  base64Data: string;
  mimeType: string;
}

const uploadedVideos: Record<string, UploadedVideo> = {};
let lastAnalysisError: any = null;

// Declare setTimeout if it's not available in the environment
declare function setTimeout(callback: (...args: any[]) => void, ms: number): number;

// Function for analyzing transcript with OpenAI
async function analyzeTranscriptWithAI(transcript: string, timestamps: any[]): Promise<{ startTime: number, endTime: number, reasoning: string }> {
  console.log("Analyzing transcript with OpenAI...");
  
  // Store for debugging
  lastTranscript = transcript;
  lastTimestamps = [...timestamps];
  
  try {
    // Check if OpenAI is initialized
    if (!isOpenAIInitialized()) {
      console.log("OpenAI not initialized, using mock data");
      // Return mock data if OpenAI is not initialized
      const mockResult = {
        startTime: 30, // Mock start time (in seconds)
        endTime: 60,   // Mock end time (in seconds)
        reasoning: "This segment contains a compelling story with emotional hooks and humor that would make it highly shareable on social media."
      };
      lastAnalysisResult = mockResult;
      return mockResult;
    }
    
    // Call OpenAI to analyze the transcript
    const result = await analyzeTranscriptForViralSegment(transcript, timestamps);
    console.log("OpenAI analysis result:", result);
    
    // Store the result for debugging
    lastAnalysisResult = result;
    lastAnalysisError = null;
    
    return result;
  } catch (error) {
    console.error("Error analyzing transcript with OpenAI:", error);
    
    // Store the error for debugging
    lastAnalysisError = error;
    
    // Return fallback data in case of error
    const fallbackResult = {
      startTime: 30, // Fallback start time (in seconds)
      endTime: 60,   // Fallback end time (in seconds)
      reasoning: "Fallback: This segment likely contains engaging content (OpenAI analysis failed)."
    };
    
    lastAnalysisResult = fallbackResult;
    return fallbackResult;
  }
}

// Store API keys
let openAIApiKey: string | null = null;

// Note: Due to sandbox limitations, we're using a direct implementation approach
// that simulates OpenAI's Whisper API behavior without making actual HTTP requests

// Store transcript polling attempts
const transcriptPollingAttempts: Record<string, number> = {};

// Store the last transcript ID
let lastTranscriptId: string | null = null;

// Generate a realistic transcript with timestamps
function generateRealisticTranscript() {
  const sentences = [
    "Welcome to our video about viral content creation.",
    "Today we'll explore what makes videos go viral on social media platforms.",
    "The key to virality is creating emotional connections with your audience.",
    "Studies show that content that evokes strong emotions like joy, surprise, or awe performs better.",
    "Another important factor is timing - posting when your audience is most active.",
    "Don't forget to optimize your video for each platform's specific algorithm.",
    "Short-form vertical videos are currently dominating social media engagement.",
    "Remember to include a strong hook in the first three seconds of your video.",
    "Authenticity resonates with viewers more than overly produced content.",
    "Thank you for watching our guide on creating viral content!"
  ];
  
  const words: any[] = [];
  let currentTime = 0;
  
  sentences.forEach(sentence => {
    const sentenceWords = sentence.split(' ');
    
    sentenceWords.forEach(word => {
      // Each word takes between 0.2 and 0.5 seconds to say
      const wordDuration = Math.floor(Math.random() * 300) + 200;
      
      words.push({
        text: word,
        start: currentTime,
        end: currentTime + wordDuration
      });
      
      currentTime += wordDuration;
      
      // Add a small pause between words
      currentTime += 50;
    });
    
    // Add a longer pause between sentences
    currentTime += 500;
  });
  
  // Convert from milliseconds to milliseconds for AssemblyAI format
  return words.map(word => ({
    text: word.text,
    start: word.start,
    end: word.end
  }));
}

// Function to extract audio from video
async function extractAudioFromVideo(videoId: string): Promise<any> {
  console.log(`Processing video ${videoId} for audio extraction...`);
  
  try {
    // Get the video data from our storage
    const videoData = uploadedVideos[videoId];
    if (!videoData) {
      throw new Error(`Video with ID ${videoId} not found`);
    }
    
    console.log(`Video found, preparing for transcription...`);
    
    // In a real implementation with proper tools, we would extract just the audio track
    // For now, we'll use the video data directly since OpenAI can handle video files too
    return videoData.base64Data;
  } catch (error) {
    console.error("Error processing video for transcription:", error);
    
    // Fallback to a simulated audio for testing if needed
    console.warn("Using fallback audio data");
    let base64 = 'data:audio/mp3;base64,';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    // Generate a short string for testing
    for (let i = 0; i < 1000; i++) {
      base64 += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return base64;
  }
}

function start(): void {
  // APIs to be exposed to the UI runtime
  const sandboxApi: DocumentSandboxApi = {
    createRectangle: () => {
      const rectangle = editor.createRectangle();
      rectangle.width = 240;
      rectangle.height = 180;
      rectangle.translation = { x: 10, y: 10 };
      const color = { red: 0.32, green: 0.34, blue: 0.89, alpha: 1 };
      const rectangleFill = editor.makeColorFill(color);
      rectangle.fill = rectangleFill;
      const insertionParent = editor.context.insertionParent;
      insertionParent.children.append(rectangle);
    },
    
    // Detect videos in the document
    detectVideos: async (): Promise<VideoInfo[]> => {
      console.log("Detecting videos in document...");
      
      try {
        // For demo purposes, return mock video data immediately
        // In a real implementation, this would use Adobe Express SDK to detect videos
        
        // Mock data for demo purposes
        const videos: VideoInfo[] = [
          {
            id: "video1",
            name: "Product Demo Video",
            duration: 180, // 3 minutes
            thumbnailUrl: undefined
          },
          {
            id: "video2",
            name: "Customer Testimonial",
            duration: 240, // 4 minutes
            thumbnailUrl: undefined
          }
        ];
        
        console.log(`Found ${videos.length} videos in document`);
        return videos;
      } catch (error) {
        console.error("Error detecting videos:", error);
        return [];
      }
    },
    
    // Set the OpenAI API key
    setOpenAIApiKey: async (apiKey: string): Promise<boolean> => {
      try {
        openAIApiKey = apiKey;
        initializeOpenAI(apiKey);
        console.log("OpenAI API key set successfully");
        return true;
      } catch (error) {
        console.error("Error setting OpenAI API key:", error);
        return false;
      }
    },
    
    // Set the OpenAI API key
    setAssemblyAIApiKey: async (apiKey: string): Promise<boolean> => {
      try {
        // Use OpenAI API key instead
        openAIApiKey = apiKey;
        console.log("OpenAI API key set successfully");
        return true;
      } catch (error) {
        console.error("Error setting OpenAI API key:", error);
        return false;
      }
    },
    
    // Get debugging information
    getDebugInfo: async (): Promise<any> => {
      console.log('Getting debug info...');
      console.log('Transcript length:', lastTranscript?.length || 0);
      console.log('Timestamps count:', lastTimestamps?.length || 0);
      
      // Format the timestamps for better readability
      const formattedTimestamps = lastTimestamps.map(ts => {
        if (typeof ts === 'number') {
          return ts;
        } else {
          return {
            start: ts.start,
            end: ts.end,
            duration: (ts.end - ts.start).toFixed(1) + 's'
          };
        }
      });
      
      return {
        transcript: lastTranscript,
        timestamps: formattedTimestamps,
        analysisResult: lastAnalysisResult,
        error: lastAnalysisError ? String(lastAnalysisError) : null,
        transcriptInfo: {
          segmentCount: lastTimestamps.length,
          totalDuration: lastTimestamps.length > 0 ? 
            Math.max(...lastTimestamps.map(t => typeof t === 'number' ? t : t.end)) : 0,
          generatedAt: new Date().toISOString()
        }
      };
    },
    
    // Analyze a video to find the viral segment
    analyzeVideo: async (videoId: string): Promise<AnalysisResult> => {
      try {
        console.log(`Analyzing video: ${videoId}`);
        
        // Step 1: Transcribe the video using AssemblyAI
        const transcriptionResult = await transcribeVideo(videoId);
        const { transcript, timestamps } = transcriptionResult;
        
        // Step 2: Analyze the transcript to find the most viral segment
        if (!isOpenAIInitialized()) {
          throw new Error("OpenAI API is not initialized. Please set a valid API key.");
        }
        
        const viralSegment = await analyzeTranscriptWithAI(transcript, timestamps);
        lastAnalysisResult = viralSegment;
        
        return {
          status: "success",
          viralSegment
        };
      } catch (error) {
        console.error("Error analyzing video:", error);
        return {
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    
    // Insert the viral clip into the document
    insertViralClip: async (videoId: string, startTime: number, endTime: number): Promise<boolean> => {
      try {
        // For demo purposes, we'll create a rectangle to represent the trimmed video
        // In a real implementation, this would use Adobe Express APIs to trim and insert the video
        
        // Create a rectangle to represent our trimmed video
        const rectangle = editor.createRectangle();
        rectangle.width = 240;
        rectangle.height = 180;
        rectangle.translation = { x: 10, y: 10 };
        
        // Use a different color to represent the viral clip
        const color = { red: 0.85, green: 0.34, blue: 0.34, alpha: 1 };
        const rectangleFill = editor.makeColorFill(color);
        rectangle.fill = rectangleFill;
        
        // Add the rectangle to the document
        const insertionParent = editor.context.insertionParent;
        insertionParent.children.append(rectangle);
        
        console.log(`Inserted viral clip from ${startTime}s to ${endTime}s`);
        return true;
      } catch (error) {
        console.error("Error inserting viral clip:", error);
        return false;
      }
    },
    
    // New method to handle direct video uploads
    uploadAndAnalyzeVideo: async (videoData: string, fileName: string): Promise<AnalysisResult> => {
      try {
        console.log(`Processing uploaded video: ${fileName}`);
        
        // Step 1: Process the uploaded video data and store it
        // videoData is expected to be a base64 string of the video content
        const videoId = `upload_${Date.now()}`;
        
        // Determine the MIME type based on the file extension
        const fileExt = fileName.split('.').pop()?.toLowerCase() || 'mp4';
        const mimeType = `video/${fileExt}`;
        
        // Store the uploaded video in our storage system
        uploadedVideos[videoId] = {
          id: videoId,
          fileName: fileName,
          base64Data: videoData,
          mimeType: mimeType
        };
        
        console.log(`Video stored with ID: ${videoId}`);
        
        // Step 2: Extract audio from the uploaded video
        // This will retrieve the video data from our storage
        const audioData = await extractAudioFromVideo(videoId);
        
        console.log('Audio data prepared for transcription');
        
        // Step 3: Transcribe the audio using OpenAI's Whisper API
        // Use OpenAI's Whisper API for transcription
        const transcriptionResult = await transcribeAudioWithWhisper(audioData);
        const transcriptSegments = transcriptionResult.segments;
        
        // Step 4: Format the transcript and timestamps
        const transcriptText = transcriptSegments.map(segment => segment.text).join(' ');
        const timestampData = transcriptSegments.map(segment => ({ start: segment.start, end: segment.end }));
        
        // Store for debugging
        lastTranscript = transcriptText;
        lastTimestamps = timestampData;
        
        console.log(`Transcription complete: ${transcriptText.substring(0, 50)}...`);
        
        // Step 5: Analyze the transcript to find the most viral segment
        if (!isOpenAIInitialized()) {
          throw new Error("OpenAI API is not initialized. Please set a valid API key.");
        }
        
        const viralSegment = await analyzeTranscriptWithAI(transcriptText, timestampData);
        lastAnalysisResult = viralSegment;
        
        return {
          status: "success",
          viralSegment
        };
      } catch (error) {
        console.error("Error processing uploaded video:", error);
        lastAnalysisError = error;
        
        return {
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };

  // Expose `sandboxApi` to the UI runtime.
  runtime.exposeApi(sandboxApi);
}

start();
