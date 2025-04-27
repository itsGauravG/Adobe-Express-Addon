import React, { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", 
  thumbnailUrl,
  onTimeUpdate 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const togglePlayback = () => {
    if (isPlaying) {
      // Pause video
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Play video
      if (videoRef.current) {
        videoRef.current.play()
          .then(() => {
            console.log('Video playing');
          })
          .catch(err => {
            console.error('Error playing video:', err);
            // Fallback to timer-based animation if video can't play
            startTimerAnimation();
          });
      } else {
        // Fallback if video element is not available
        startTimerAnimation();
      }
      setIsPlaying(true);
    }
  };

  const startTimerAnimation = () => {
    // Use a timer to simulate video playback if actual video can't play
    timerRef.current = setInterval(() => {
      setCurrentTime(prevTime => {
        const newTime = prevTime + 1;
        // Loop back to beginning when reaching 60 seconds
        const updatedTime = newTime > 60 ? 0 : newTime;
        
        // Call the onTimeUpdate callback if provided
        if (onTimeUpdate) {
          onTimeUpdate(updatedTime);
        }
        
        return updatedTime;
      });
    }, 1000);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const newTime = Math.floor(videoRef.current.currentTime);
      setCurrentTime(newTime);
      
      // Call the onTimeUpdate callback if provided
      if (onTimeUpdate) {
        onTimeUpdate(newTime);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`video-placeholder ${isPlaying ? 'playing' : ''}`} onClick={togglePlayback}>
      <video
        ref={videoRef}
        src={videoUrl}
        style={{ width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        playsInline
      />
      
      {isPlaying ? (
        <div className="pause-icon">⏸</div>
      ) : (
        <div className="play-icon">▶</div>
      )}
      
      <div className="video-time-indicator">{formatTime(currentTime)}</div>
    </div>
  );
};

export default VideoPlayer;
