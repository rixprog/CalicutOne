import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ShieldCheck, ShieldAlert, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = 'http://localhost:5000';

interface Video {
    id: string;
    filename: string;
    name: string;
}

interface CameraState {
    label: string;
    confidence: number;
    last_update: number;
}

export function ViolenceDetection() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [cameraStates, setCameraStates] = useState<Record<string, CameraState>>({});
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        // Fetch video list
        fetch(`${API_BASE_URL}/api/videos`)
            .then(res => res.json())
            .then(data => {
                setVideos(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching videos:", err);
                setLoading(false);
            });

        // Setup SSE for real-time events
        const eventSource = new EventSource(`${API_BASE_URL}/api/events`);

        eventSource.onopen = () => {
            console.log("SSE Connected");
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setCameraStates(data);
            } catch (e) {
                console.error("Failed to parse event data", e);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Error:", err);
        };

        return () => {
            eventSource.close();
        };
    }, []);



    const isDanger = (label?: string) => {
        if (!label) return false;
        const l = label.toLowerCase();
        return l.includes('fight') || l.includes('fire') || l.includes('crash') || l.includes('violence');
    };

    return (
        <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden font-sans w-full">
            <div className="flex-1 flex flex-col h-full overflow-hidden">


                <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
                    {loading && <p className="text-gray-500 mb-4">Initializing feeds...</p>}

                    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full w-full min-h-0">
                        {videos.map((video) => {
                            const state = cameraStates[video.id];
                            const dangerous = isDanger(state?.label);

                            return (
                                <Card key={video.id} className={cn(
                                    "overflow-hidden border transition-all bg-white h-full shadow-sm hover:shadow-md",
                                    dangerous ? "border-red-500 ring-4 ring-red-500/10" : "border-gray-200"
                                )}>
                                    <CardContent className="p-0 h-full relative group bg-black flex items-center justify-center">
                                        <img
                                            src={`${API_BASE_URL}/api/video_feed/${video.filename}`}
                                            alt={`Feed ${video.name}`}
                                            className="w-full h-full object-contain bg-black"
                                            loading="lazy"
                                        />

                                        {/* Overlay for ID only */}
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded text-[10px] font-mono text-gray-900 border border-gray-200 shadow-sm">
                                            {video.name}
                                        </div>

                                        {/* Danger Indicator Overlay */}
                                        {dangerous && (
                                            <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none"></div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sidebar - Right Panel */}
            <div className="w-96 bg-white border-l border-primary-100 flex flex-col shrink-0 z-10 shadow-xl">
                <div className="p-4 border-b border-primary-100 bg-primary-50/80 backdrop-blur">
                    <h2 className="text-sm font-semibold text-primary-900 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary-600" />
                        Live Status Feed
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {videos.map((video) => {
                        const state = cameraStates[video.id];
                        const hasData = !!state;
                        const dangerous = isDanger(state?.label);

                        return (
                            <div key={video.id} className={cn(
                                "p-3 rounded-lg border flex flex-col gap-2 transition-colors shadow-sm",
                                dangerous ? "bg-red-50 border-red-200" : "bg-white border-primary-100"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Camera className="h-3 w-3 text-primary-400" />
                                        <span className="text-sm font-mono font-medium text-slate-700">{video.name}</span>
                                    </div>
                                    {hasData && (
                                        dangerous
                                            ? <ShieldAlert className="h-4 w-4 text-red-500 animate-pulse" />
                                            : <ShieldCheck className="h-4 w-4 text-green-600" />
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                    {hasData ? (
                                        <>
                                            <span className={cn(
                                                "text-xs font-bold px-2 py-0.5 rounded-full border",
                                                dangerous
                                                    ? "bg-red-100 text-red-700 border-red-200"
                                                    : "bg-green-100 text-green-700 border-green-200"
                                            )}>
                                                {state.label}
                                            </span>
                                            <span className="text-xs font-mono text-gray-500">
                                                {(state.confidence * 100).toFixed(0)}%
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Connecting...</span>
                                    )}
                                </div>

                                {/* Mini confidence bar */}
                                {hasData && (
                                    <div className="h-1 w-full bg-gray-100 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className={cn("h-full transition-all duration-300",
                                                dangerous ? "bg-red-500" : "bg-green-500")}
                                            style={{ width: `${state.confidence * 100}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
