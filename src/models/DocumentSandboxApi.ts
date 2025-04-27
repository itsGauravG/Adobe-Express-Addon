// This interface declares all the APIs that the document sandbox runtime ( i.e. code.ts ) exposes to the UI/iframe runtime
export interface DocumentSandboxApi {
    createRectangle(): void;
    detectVideos(): Promise<VideoInfo[]>;
    analyzeVideo(videoId: string): Promise<AnalysisResult>;
    insertViralClip(videoId: string, startTime: number, endTime: number): Promise<boolean>;
    setOpenAIApiKey(apiKey: string): Promise<boolean>;
    setAssemblyAIApiKey(apiKey: string): Promise<boolean>;
    getDebugInfo(): Promise<DebugInfo>;
    uploadAndAnalyzeVideo(videoData: string, fileName: string): Promise<AnalysisResult>;
}

export interface DebugInfo {
    transcript: string;
    timestamps: any[];
    analysisResult: any;
    error: string | null;
    transcriptInfo?: {
        segmentCount: number;
        totalDuration: number;
        generatedAt: string;
    };
}

export interface VideoInfo {
    id: string;
    name: string;
    duration: number;
    thumbnailUrl?: string;
}

export interface AnalysisResult {
    status: 'success' | 'processing' | 'error';
    viralSegment?: {
        startTime: number;
        endTime: number;
        reasoning: string;
    };
    error?: string;
}
