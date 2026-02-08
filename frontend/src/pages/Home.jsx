import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Custom Car Icon for User
const CarIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png', // Simple car icon
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Icons for modes
const ModeIcon = ({ mode }) => {
    const icons = {
        car: "🚗",
        bike: "🏍️",
        walk: "🚶",
        public_bus: "🚌"
    };
    return <span className="text-xl">{icons[mode] || "🚗"}</span>;
};

// Component to handle map view updates
function MapViewUpdater({ center, routePoints }) {
    const map = useMap();
    useEffect(() => {
        if (routePoints && routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center) {
            map.flyTo(center, 13);
        }
    }, [center, routePoints, map]);
    return null;
}

const Home = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [travelState, setTravelState] = useState(null);
    const [sessionId, setSessionId] = useState(null);

    // Navigation State
    const [userPosition, setUserPosition] = useState(null);
    const [routePath, setRoutePath] = useState([]);
    const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
    const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMsg = { text: inputMessage, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInputMessage("");
        setIsLoading(true);

        try {
            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.text,
                    session_id: sessionId
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            setSessionId(data.session_id);
            setTravelState(data.response);

            // Process Route Geometry
            if (data.response.segments && data.response.segments.length > 0) {
                // Combine all segment geometries into one long path
                let fullPath = [];
                data.response.segments.forEach(seg => {
                    if (seg.route_geometry) {
                        fullPath = [...fullPath, ...seg.route_geometry];
                    } else {
                        // Fallback: straight line
                        fullPath.push([seg.start.latitude, seg.start.longitude]);
                        fullPath.push([seg.end.latitude, seg.end.longitude]);
                    }
                });

                // If it's a new route or start point changed, reset user position
                if (!userPosition || data.response.starting_point) {
                    if (data.response.starting_point) {
                        setUserPosition([data.response.starting_point.latitude, data.response.starting_point.longitude]);
                    } else if (fullPath.length > 0) {
                        setUserPosition(fullPath[0]);
                    }
                }

                setRoutePath(fullPath);
                setCurrentRouteIndex(0);
                setActiveSegmentIdx(0);
            }

            setMessages(prev => [...prev, {
                text: "Plan updated! Use Arrow Keys (↑/↓) to simulate travel.",
                sender: 'bot'
            }]);

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, {
                text: "Sorry, I couldn't process that. Please try again.",
                sender: 'bot'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
            return;
        }

        // Navigation Logic
        if (routePath.length === 0) return;

        let newIndex = currentRouteIndex;

        if (e.key === 'ArrowUp') {
            newIndex = Math.min(currentRouteIndex + 1, routePath.length - 1);
        } else if (e.key === 'ArrowDown') {
            newIndex = Math.max(currentRouteIndex - 1, 0);
        } else {
            return; // Ignore other keys
        }

        setCurrentRouteIndex(newIndex);
        const newPos = routePath[newIndex];
        setUserPosition(newPos);

        // Check arrival at destinations
        checkArrival(newPos);
    };

    const checkArrival = (currentPos) => {
        if (!travelState || !travelState.segments) return;

        // Find if we are close to the end of the ACTIVE segment
        const segment = travelState.segments[activeSegmentIdx];
        if (!segment) return;

        const destLat = segment.end.latitude;
        const destLon = segment.end.longitude;

        // Simple distance check (e.g., 0.001 degrees approx 100m)
        const dist = Math.sqrt(
            Math.pow(currentPos[0] - destLat, 2) +
            Math.pow(currentPos[1] - destLon, 2)
        );

        if (dist < 0.001) { // Arrived!
            // Move to next segment
            if (activeSegmentIdx < travelState.segments.length) {
                const nextIdx = activeSegmentIdx + 1;
                setActiveSegmentIdx(nextIdx);

                // Check if ALL segments are done
                if (nextIdx >= travelState.segments.length) {
                    console.log("Trip Completed. Resetting state...");
                    // Call backend to reset state
                    fetch('http://127.0.0.1:8000/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "RESET", session_id: sessionId })
                    }).catch(err => console.error("Reset failed", err));

                    // Optional: Clear local map route after a delay or keep it as "History"?
                    // User said "all div diaaspeared", implying UI cleanup. 
                    // But maybe we keep the "Trip Completed" card.
                }
            }
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [routePath, currentRouteIndex, activeSegmentIdx, inputMessage]); // Dependencies for closure

    // Get Live Location on Mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    console.log("Got user location:", latitude, longitude);
                    // Automatically set as start point
                    // We send a specially formatted message that the Agent recognizes
                    const msg = `Current Location: ${latitude}, ${longitude}`;
                    handleSendMessageInternal(msg);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    // Fallback or just do nothing (let user type)
                }
            );
        }
    }, []); // Run once on mount

    // Calculate center
    const getMapCenter = () => {
        if (userPosition) return userPosition;
        if (travelState?.starting_point) {
            return [travelState.starting_point.latitude, travelState.starting_point.longitude];
        }
        return [11.2588, 75.7804];
    };

    // Filter segments based on arrival
    const visibleSegments = travelState?.segments?.slice(activeSegmentIdx) || [];

    // Derived state for suggestions sidebar
    const showRecommendations = travelState?.suggestions && travelState.suggestions.length > 0;

    const handleAddSuggestion = (suggestion) => {
        // Send message to add using natural language
        // We add context "near my route" to help the agent contextually, though the backend now checks suggestions explicitly.
        const msg = `Add ${suggestion.name} (near my current location) to my plan`;
        setInputMessage(msg); // Optional: prepopulate input
        // Or directly call
        handleSendMessageInternal(msg);

        // Auto-close: Clear suggestions locally to hide the sidebar immediately
        // The backend state will update eventually, but for UI responsiveness:
        if (travelState) {
            setTravelState(prev => ({
                ...prev,
                suggestions: []
            }));
        }
    };

    const handleDismissRecommendations = () => {
        // Just clear the suggestions locally to close the sidebar
        // We do NOT want to send a message that might be interpreted as "Clear Route"
        if (travelState) {
            setTravelState(prev => ({
                ...prev,
                suggestions: []
            }));
        }
    };

    // Helper to send message directly without input field
    const handleSendMessageInternal = async (text) => {
        const userMsg = { text: text, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.text,
                    session_id: sessionId
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            setSessionId(data.session_id);
            setTravelState(data.response);

            // ... (Same route logic as main handleSendMessage)
            if (data.response.segments && data.response.segments.length > 0) {
                // Combine all segment geometries into one long path
                let fullPath = [];
                data.response.segments.forEach(seg => {
                    if (seg.route_geometry) {
                        fullPath = [...fullPath, ...seg.route_geometry];
                    } else {
                        fullPath.push([seg.start.latitude, seg.start.longitude]);
                        fullPath.push([seg.end.latitude, seg.end.longitude]);
                    }
                });

                // Reset position only if new plan/start
                if (!userPosition || data.response.starting_point) {
                    if (data.response.starting_point && !userPosition) { // Update logic slightly to avoid jump if just adding stop
                        setUserPosition([data.response.starting_point.latitude, data.response.starting_point.longitude]);
                    } else if (fullPath.length > 0 && !userPosition) {
                        setUserPosition(fullPath[0]);
                    }
                }
                setRoutePath(fullPath);
            }
            setMessages(prev => [...prev, {
                text: "Updated!",
                sender: 'bot'
            }]);

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden lg:overflow-hidden overflow-y-auto relative" tabIndex={0} onClick={() => { }}>

            {/* Recommendations Sidebar (Pop-out) */}
            {showRecommendations && (
                <div className="absolute top-6 left-6 z-[2000] w-[350px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col animate-in slide-in-from-left-10 duration-300">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Top Recommendations</h3>
                            <p className="text-xs text-gray-500">Based on your route</p>
                        </div>
                        <button
                            onClick={handleDismissRecommendations}
                            className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                        {travelState.suggestions.map((place, idx) => (
                            <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-gray-800 text-base">{place.name}</h4>
                                    <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                        {place.budget || '$$'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2 truncate">{place.address}</p>

                                {/* Tags */}
                                <div className="flex gap-2 mb-3 flex-wrap">
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded flex items-center gap-1">
                                        <span>⭐</span> {place.rating || 4.5}
                                    </span>
                                    {place.price_level && (
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                            {place.price_level}
                                        </span>
                                    )}
                                    {place.tags && place.tags.map((tag, tIdx) => (
                                        <span key={tIdx} className={`text-xs px-2 py-0.5 rounded border ${tag.toLowerCase().includes('veg') && !tag.toLowerCase().includes('non')
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : 'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleAddSuggestion(place)}
                                    className="w-full bg-black text-white py-2 rounded-lg text-sm font-semibold opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                                >
                                    Add to Route
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Section: Split 4:6 on desktop */}
            <div className="flex flex-col lg:flex-row gap-4 lg:h-[55%] shrink-0 lg:shrink">

                {/* Left Column: Dynamic Travel Cards & Directions (4/10 width) */}
                <div className="lg:w-[40%] flex flex-col gap-3 h-[300px] lg:h-auto min-h-0">

                    {/* Top Part: Cards (60%) */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 bg-gray-50/50 rounded-xl p-2">
                        {visibleSegments.length === 0 && !travelState?.destinations?.length ? (
                            travelState && activeSegmentIdx > 0 ? (
                                <div className="h-full flex items-center justify-center bg-green-50 rounded-2xl border border-green-100">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🎉</div>
                                        <h3 className="text-xl font-bold text-green-700">Trip Completed!</h3>
                                        <p className="text-green-600">You have reached all destinations.</p>
                                    </div>
                                </div>
                            ) : (
                                // Default View
                                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 h-full">
                                    <div className="bg-primary-100 rounded-2xl p-4 flex items-center justify-center text-primary-800 font-semibold text-lg">Traffic Updates</div>
                                    <div className="bg-primary-200 rounded-2xl p-4 flex items-center justify-center text-primary-900 font-semibold text-lg">Public Transport</div>
                                    <div className="bg-primary-500 rounded-2xl p-4 flex items-center justify-center text-white font-semibold text-lg">Weather Info</div>
                                    <div className="bg-primary-600 rounded-2xl p-4 flex items-center justify-center text-white font-semibold text-lg">Announcements</div>
                                </div>
                            )
                        ) : (
                            // Dynamic Travel Plan Cards
                            <>
                                {/* Start Point (Only show if calculated) */}
                                {travelState.starting_point && activeSegmentIdx === 0 && (
                                    <div className="bg-green-100 border border-green-200 rounded-xl p-4 shadow-sm mb-3">
                                        <div className="text-xs font-bold text-green-600 uppercase mb-1">Start Point</div>
                                        <div className="font-bold text-gray-800 text-lg">{travelState.starting_point.name}</div>
                                    </div>
                                )}

                                {/* Segments */}
                                {visibleSegments.map((seg, idx) => (
                                    <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative mb-3">
                                        <div className="absolute top-4 right-4 bg-primary-50 p-2 rounded-full">
                                            <ModeIcon mode={seg.mode} />
                                        </div>
                                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">
                                            {activeSegmentIdx + idx === 0 ? "Next Stop" : `Stop ${activeSegmentIdx + idx + 1}`}
                                        </div>
                                        <div className="font-bold text-gray-800 text-lg mb-2">{seg.end.name}</div>

                                        <div className="flex gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <span>📏</span> {seg.distance_km} km
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span>⏱️</span> {seg.duration_minutes} min
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Bottom Part: Dynamic Directions (40%) */}
                    {visibleSegments.length > 0 && (
                        <div className="h-[40%] bg-blue-50 rounded-xl border border-blue-100 shadow-md p-6 flex flex-col justify-center items-center min-h-0 animate-in slide-in-from-bottom-6 text-center">
                            {(() => {
                                // Find current instruction based on global index
                                let activeStep = null;
                                // We need to calculate the global index offset for the visibleSegments[0]
                                // But routePath is global. 
                                // Let's iterate ALL segments to find where we are globally
                                if (!travelState?.segments) return null;

                                let offset = 0;
                                let found = false;

                                for (let seg of travelState.segments) {
                                    // If this segment has geometry, it contributes to the global path
                                    // But fallback segments (straight lines) have 2 points.
                                    const segLen = seg.route_geometry ? seg.route_geometry.length : 2;

                                    // Check if user is within this segment's range in the global path
                                    if (currentRouteIndex >= offset && currentRouteIndex < offset + segLen) {
                                        const localIdx = currentRouteIndex - offset;

                                        // Find step within this segment
                                        if (seg.steps) {
                                            activeStep = seg.steps.find(s => {
                                                // s is { instruction, way_points: [start, end] }
                                                const wp = s.way_points;
                                                // allow some buffer or exact match
                                                return wp && localIdx >= wp[0] && localIdx <= wp[1];
                                            });
                                        }

                                        // If no step found (maybe in between steps?), show the NEXT step if possible
                                        if (!activeStep && seg.steps) {
                                            activeStep = seg.steps.find(s => {
                                                const wp = s.way_points;
                                                return wp && localIdx < wp[0]; // Approaching this step
                                            });
                                        }

                                        found = true;
                                        break;
                                    }
                                    offset += segLen;
                                }

                                return activeStep ? (
                                    <>
                                        <div className="text-4xl mb-4 text-blue-600">
                                            {activeStep.instruction.toLowerCase().includes('left') ? '⬅️' :
                                                activeStep.instruction.toLowerCase().includes('right') ? '➡️' :
                                                    activeStep.instruction.toLowerCase().includes('arri') ? '📍' :
                                                        activeStep.instruction.toLowerCase().includes('head') ? '⬆️' : '🚗'}
                                        </div>
                                        <h3 className="text-xl font-bold text-blue-900 leading-snug">
                                            {activeStep.instruction}
                                        </h3>
                                        <p className="text-blue-500 text-sm mt-2 font-medium">Current Instruction</p>
                                    </>
                                ) : (
                                    <div className="text-gray-400 font-medium">
                                        {found ? "Continue on route..." : "Follow the route line..."}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Right Column: Map (6/10 width) */}
                <div className="lg:w-[60%] bg-white rounded-2xl shadow-lg saturate-150 overflow-hidden border border-gray-200 relative z-0 h-[300px] lg:h-auto">
                    <MapContainer
                        center={getMapCenter()}
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0 outline-none"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapViewUpdater center={getMapCenter()} routePoints={routePath} />

                        {/* Route Line */}
                        {routePath.length > 0 && (
                            <Polyline
                                positions={routePath}
                                color="#00008B"
                                weight={5}
                                opacity={0.8}
                                dashArray="10, 10"
                            />
                        )}

                        {/* Start Marker */}
                        {travelState?.starting_point && (
                            <Marker position={[travelState.starting_point.latitude, travelState.starting_point.longitude]}>
                                <Popup>Start: {travelState.starting_point.name}</Popup>
                            </Marker>
                        )}

                        {/* Destination Markers */}
                        {travelState?.destinations?.map((dest, i) => (
                            <Marker key={i} position={[dest.latitude, dest.longitude]}>
                                <Popup>Stop {i + 1}: {dest.name}</Popup>
                            </Marker>
                        ))}

                        {/* User Position Marker */}
                        {userPosition && (
                            <Marker position={userPosition} icon={CarIcon} zIndexOffset={1000}>
                                <Popup>You are here</Popup>
                            </Marker>
                        )}
                    </MapContainer>

                    {/* Navigation Hint Overlay */}
                    {routePath.length > 0 && (
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-[500]">
                            Use ⬆️ ⬇️ keys to move
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Chat & SOS */}
            <div className="flex flex-col lg:flex-row gap-4 lg:flex-1 min-h-0">

                {/* Chat Section */}
                <div className="lg:w-[70%] bg-white rounded-2xl shadow-lg p-4 flex flex-col border border-gray-100 h-[300px] lg:h-auto">
                    {/* Chat History */}
                    <div className="flex-1 bg-gray-50/50 rounded-xl mb-4 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <span className="text-4xl mb-2">💬</span>
                                <p>Plan your trip via chat...</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`p-3 rounded-lg max-w-[80%] ${msg.sender === 'user' ? 'bg-primary-100 self-end text-primary-900' : 'bg-gray-100 self-start text-gray-800'}`}>
                                {msg.text}
                            </div>
                        ))}
                        {isLoading && <div className="text-gray-400 text-sm italic self-start ml-2">Thinking...</div>}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2 w-full">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={handleKeyDown} // This also handles nav but prevents default if handled
                            disabled={isLoading}
                            placeholder="Type plan e.g., 'Start from Kozhikode to Cyberpark'"
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isLoading}
                            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                        >
                            Send
                        </button>
                    </div>
                </div>

                {/* SOS Button */}
                <div className="lg:w-[30%] bg-red-50 rounded-2xl shadow-lg flex items-center justify-center border border-red-100 h-[200px] lg:h-auto">
                    <button className="w-[80%] aspect-square max-h-48 max-w-48 bg-gradient-to-br from-red-500 to-red-600 rounded-full text-white text-3xl font-bold shadow-red-200 shadow-xl hover:shadow-red-300 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all animate-pulse border-4 border-red-400/30">
                        SOS
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;
