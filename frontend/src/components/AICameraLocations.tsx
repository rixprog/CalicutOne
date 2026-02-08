import React, { useState, useEffect } from 'react';
import { CameraMap } from './CameraMap';
import { CameraFeedModal } from './CameraFeedModal';
import type { CameraLocation } from '../data/cameras';
import { CAMERAS } from '../data/cameras';
import type { Video, CameraState } from '../types';

const API_BASE_URL = 'http://localhost:5000';

export const AICameraLocations: React.FC = () => {
    const [selectedCamera, setSelectedCamera] = useState<CameraLocation | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    const [cameraStates, setCameraStates] = useState<Record<string, CameraState>>({});

    useEffect(() => {
        // Fetch video list
        fetch(`${API_BASE_URL}/api/videos`)
            .then(res => res.json())
            .then(data => {
                setVideos(data);
            })
            .catch(err => {
                console.error("Error fetching videos:", err);
            });

        // Setup SSE for real-time events
        const eventSource = new EventSource(`${API_BASE_URL}/api/events`);
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setCameraStates(data);
            } catch (e) {
                console.error("Failed to parse event data", e);
            }
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const handleCameraClick = (camera: CameraLocation) => {
        // Pick a random video to simulate the feed for this camera
        // If videos are not loaded, we can't show a feed, so we might want to handle that.
        // For now, we assume videos will load quickly or we can show a loader in modal.
        if (videos.length > 0) {
            const randomVideo = videos[Math.floor(Math.random() * videos.length)];
            setSelectedVideo(randomVideo);
        }

        setSelectedCamera(camera);
    };

    const handleCloseModal = () => {
        setSelectedCamera(null);
        setSelectedVideo(null);
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 relative">
            <div className="flex-1 w-full h-full relative z-0">
                <CameraMap
                    cameras={CAMERAS}
                    onCameraClick={handleCameraClick}
                />
            </div>

            {selectedCamera && selectedVideo && (
                <CameraFeedModal
                    video={selectedVideo}
                    locationName={selectedCamera.name}
                    state={cameraStates[selectedVideo.id]}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};
