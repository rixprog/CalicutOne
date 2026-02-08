import React from 'react';
import type { Video, CameraState } from '../types';
import { Camera, ShieldAlert, ShieldCheck, Activity, X } from 'lucide-react';
import { cn } from "@/lib/utils";

interface CameraFeedModalProps {
    video: Video;
    state?: CameraState;
    onClose: () => void;
    locationName: string;
}

const API_BASE_URL = 'http://localhost:5000';

export const CameraFeedModal: React.FC<CameraFeedModalProps> = ({ video, state, onClose, locationName }) => {
    const isDanger = (label?: string) => {
        if (!label) return false;
        const l = label.toLowerCase();
        return l.includes('fight') || l.includes('fire') || l.includes('crash') || l.includes('violence');
    };

    const dangerous = isDanger(state?.label);
    const hasData = !!state;

    return (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Video Feed Section */}
                <div className="flex-1 bg-black relative min-h-[300px] flex items-center justify-center group">
                    <img
                        src={`${API_BASE_URL}/api/video_feed/${video.filename}`}
                        alt={video.name}
                        className="max-w-full max-h-full object-contain"
                    />

                    {/* Overlay for Location */}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 backdrop-blur-md rounded text-white text-sm font-medium border border-white/10">
                        {locationName}
                    </div>

                    {dangerous && (
                        <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none"></div>
                    )}
                </div>

                {/* Sidebar Stats Section */}
                <div className="w-full md:w-80 bg-slate-50 border-l border-slate-100 flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary-600" />
                            Live Analysis
                        </h3>
                        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        <div className={cn(
                            "p-4 rounded-xl border flex flex-col gap-3 shadow-sm",
                            dangerous ? "bg-red-50 border-red-200" : "bg-white border-primary-100"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Camera className="h-4 w-4 text-primary-400" />
                                    <span className="text-sm font-mono font-medium text-slate-700">{video.name}</span>
                                </div>
                                {hasData && (
                                    dangerous
                                        ? <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
                                        : <ShieldCheck className="h-5 w-5 text-green-600" />
                                )}
                            </div>

                            <div className="flex flex-col gap-2 mt-2">
                                <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Detected Event</span>
                                {hasData ? (
                                    <div className="flex items-center justify-between">
                                        <span className={cn(
                                            "text-sm font-bold px-3 py-1 rounded-full border inline-block",
                                            dangerous
                                                ? "bg-red-100 text-red-700 border-red-200"
                                                : "bg-green-100 text-green-700 border-green-200"
                                        )}>
                                            {state.label}
                                        </span>
                                        <span className="text-sm font-mono font-bold text-slate-600">
                                            {(state.confidence * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-400 italic">Analyzing feed...</span>
                                )}
                            </div>

                            {/* Confidence Bar */}
                            {hasData && (
                                <div className="space-y-1 mt-2">
                                    <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                                        <span>Confidence Score</span>
                                        <span>100%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full transition-all duration-300",
                                                dangerous ? "bg-red-500" : "bg-green-500")}
                                            style={{ width: `${state.confidence * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-800 text-xs leading-relaxed">
                            <p className="font-semibold mb-1">System Status</p>
                            Location data provided by Kerala MVD.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
