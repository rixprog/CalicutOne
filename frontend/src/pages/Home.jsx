import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
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

// --- Tour Mode Components ---
const TourToggle = ({ isEnabled, onToggle }) => (
    <div className="flex items-center gap-2 mb-2 px-1">
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isEnabled} onChange={onToggle} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-700">Tour Mode</span>
        </label>
    </div>
);

const TourFormModal = ({ isOpen, onClose, onSubmit, placeholderDest }) => {
    if (!isOpen) return null;
    const [formData, setFormData] = useState({
        destination: placeholderDest || "",
        duration: "2 Days",
        group_type: "Couple",
        budget: "5000",
        food_pref: "Non-Veg",
        activity_types: "Sightseeing, relaxing"
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>🌍</span> Plan Your Tour
                </h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Destination</label>
                        <input name="destination" value={formData.destination} onChange={handleChange} className="w-full p-2 border rounded-lg" placeholder="e.g. Kozhikode" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Duration</label>
                            <input name="duration" value={formData.duration} onChange={handleChange} className="w-full p-2 border rounded-lg" placeholder="e.g. 2 Days" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Group</label>
                            <select name="group_type" value={formData.group_type} onChange={handleChange} className="w-full p-2 border rounded-lg">
                                <option>Solo</option>
                                <option>Couple</option>
                                <option>Family</option>
                                <option>Friends</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Budget (₹)</label>
                            <input name="budget" type="number" value={formData.budget} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Food</label>
                            <select name="food_pref" value={formData.food_pref} onChange={handleChange} className="w-full p-2 border rounded-lg">
                                <option>Veg</option>
                                <option>Non-Veg</option>
                                <option>Both</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Activities</label>
                        <input name="activity_types" value={formData.activity_types} onChange={handleChange} className="w-full p-2 border rounded-lg" placeholder="e.g. Beach, Adventure, History" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={() => onSubmit(formData)} className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700">Generate Plan</button>
                </div>
            </div>
        </div>
    );
};

const Home = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [travelState, setTravelState] = useState(null);
    const [sessionId, setSessionId] = useState(null);

    // Tour Mode State
    const [isTourMode, setIsTourMode] = useState(false);
    const [showTourForm, setShowTourForm] = useState(false);
    const [activeTab, setActiveTab] = useState('timeline');
    const [selectedDay, setSelectedDay] = useState(null);

    // Route State
    const [routePath, setRoutePath] = useState([]);
    const [routeSteps, setRouteSteps] = useState([]);
    const [currentInstruction, setCurrentInstruction] = useState(null);
    const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
    const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
    const [userPosition, setUserPosition] = useState(null);

    const handleSendMessage = async (tourFormData = null) => {
        if (isTourMode && inputMessage.trim() && !tourFormData) {
            setShowTourForm(true);
            return;
        }

        if (!inputMessage.trim() && !tourFormData) return;

        const textToSend = tourFormData ? `Plan a tour for ${tourFormData.destination}` : inputMessage;
        const userMsg = { text: textToSend, sender: 'user' };

        setMessages(prev => [...prev, userMsg]);
        setInputMessage("");
        setShowTourForm(false);
        setIsLoading(true);

        try {
            const body = {
                message: userMsg.text,
                session_id: sessionId
            };

            if (tourFormData) {
                body.tour_data = tourFormData;
            }

            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            setSessionId(data.session_id);
            setTravelState(data.response);

            if (data.response.segments && data.response.segments.length > 0) {
                let fullPath = [];
                let allSteps = [];
                let globalIndexOffset = 0;

                data.response.segments.forEach(seg => {
                    if (seg.route_geometry) {
                        fullPath = [...fullPath, ...seg.route_geometry];
                    } else {
                        fullPath.push([seg.start.latitude, seg.start.longitude]);
                        fullPath.push([seg.end.latitude, seg.end.longitude]);
                    }

                    if (seg.steps) {
                        seg.steps.forEach(step => {
                            allSteps.push({
                                ...step,
                                globalStartIndex: globalIndexOffset + (step.way_points ? step.way_points[0] : 0),
                                globalEndIndex: globalIndexOffset + (step.way_points ? step.way_points[1] : 0)
                            });
                        });
                    }

                    globalIndexOffset += (seg.route_geometry ? seg.route_geometry.length : 2);
                });

                if (!userPosition || data.response.starting_point) {
                    if (data.response.starting_point) {
                        setUserPosition([data.response.starting_point.latitude, data.response.starting_point.longitude]);
                    } else if (fullPath.length > 0) {
                        setUserPosition(fullPath[0]);
                    }
                }

                setRoutePath(fullPath);
                setRouteSteps(allSteps);
                setCurrentRouteIndex(0);
                setActiveSegmentIdx(0);
            }

            if (data.response.tour_plan) {
                setActiveTab('timeline');
            }

            const responseText = data.response.status_message ||
                (data.response.tour_plan ? "Tour plan generated! Check the timeline." : "Plan updated! Use Arrow Keys (↑/↓) to simulate travel.");

            setMessages(prev => [...prev, {
                text: responseText,
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

    const onTourFormSubmit = (data) => {
        handleSendMessage(data);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
            return;
        }

        if (routePath.length === 0) return;

        let newIndex = currentRouteIndex;

        if (e.key === 'ArrowUp') {
            newIndex = Math.min(currentRouteIndex + 1, routePath.length - 1);
        } else if (e.key === 'ArrowDown') {
            newIndex = Math.max(currentRouteIndex - 1, 0);
        } else {
            return;
        }

        setCurrentRouteIndex(newIndex);
        const newPos = routePath[newIndex];
        setUserPosition(newPos);

        checkArrival(newPos);
    };

    const checkArrival = (currentPos) => {
        if (!travelState || !travelState.segments) return;

        const segment = travelState.segments[activeSegmentIdx];
        if (!segment) return;

        const destLat = segment.end.latitude;
        const destLon = segment.end.longitude;

        const dist = Math.sqrt(
            Math.pow(currentPos[0] - destLat, 2) +
            Math.pow(currentPos[1] - destLon, 2)
        );

        if (dist < 0.001) {
            if (activeSegmentIdx < travelState.segments.length) {
                const nextIdx = activeSegmentIdx + 1;
                setActiveSegmentIdx(nextIdx);

                if (nextIdx >= travelState.segments.length) {
                    console.log("Trip Completed. Resetting state...");
                    fetch(`${API_BASE_URL}/reset`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: "RESET", session_id: sessionId })
                    }).catch(err => console.error("Reset failed", err));
                }
            }
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [routePath, currentRouteIndex, activeSegmentIdx, inputMessage]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const msg = `Current Location: ${latitude}, ${longitude}`;
                    handleSendMessageInternal(msg);
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        }
    }, []);

    const getMapCenter = () => {
        if (selectedDay) {
            const dayActs = travelState?.tour_plan?.days?.find(d => d.day_number === selectedDay)?.activities || [];
            const firstLoc = dayActs.find(a => a.geo_location);
            if (firstLoc) return [firstLoc.geo_location.latitude, firstLoc.geo_location.longitude];
        }

        if (userPosition) return userPosition;
        if (travelState?.starting_point) {
            return [travelState.starting_point.latitude, travelState.starting_point.longitude];
        }
        return [11.2588, 75.7804];
    };

    const calculateDistance = (coord1, coord2) => {
        if (!coord1 || !coord2) return 0;
        const R = 6371e3;
        const φ1 = coord1[0] * Math.PI / 180;
        const φ2 = coord2[0] * Math.PI / 180;
        const Δφ = (coord2[0] - coord1[0]) * Math.PI / 180;
        const Δλ = (coord2[1] - coord1[1]) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    useEffect(() => {
        if (!routeSteps.length || !routePath.length) return;

        const currentStep = routeSteps.find(step =>
            currentRouteIndex >= step.globalStartIndex && currentRouteIndex < step.globalEndIndex
        );

        if (currentStep) {
            const endCoord = routePath[currentStep.globalEndIndex];
            const currentPosStr = routePath[currentRouteIndex];

            const dist = calculateDistance(currentPosStr, endCoord);

            let icon = "⬆️";
            const instr = currentStep.instruction || "Continue ahead";

            if (instr.toLowerCase().includes("left")) icon = "⬅️";
            else if (instr.toLowerCase().includes("right")) icon = "➡️";
            else if (instr.toLowerCase().includes("u-turn")) icon = "🔄";
            else if (instr.toLowerCase().includes("destination")) icon = "🏁";

            setCurrentInstruction({
                icon: icon,
                text: instr,
                distance: Math.round(dist)
            });
        }
    }, [currentRouteIndex, routeSteps, routePath]);

    const visibleSegments = travelState?.segments?.slice(activeSegmentIdx) || [];
    const showRecommendations = travelState?.suggestions && travelState.suggestions.length > 0;

    const handleAddSuggestion = (suggestion) => {
        const msg = `Add ${suggestion.name} (near my current location) to my plan`;
        setInputMessage(msg);
        handleSendMessageInternal(msg);

        if (travelState) {
            setTravelState(prev => ({
                ...prev,
                suggestions: []
            }));
        }
    };

    const handleDismissRecommendations = () => {
        if (travelState) {
            setTravelState(prev => ({
                ...prev,
                suggestions: []
            }));
        }
    };

    const handleSendMessageInternal = async (text) => {
        const userMsg = { text: text, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
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

            if (data.response.segments && data.response.segments.length > 0) {
                let fullPath = [];
                data.response.segments.forEach(seg => {
                    if (seg.route_geometry) {
                        fullPath = [...fullPath, ...seg.route_geometry];
                    } else {
                        fullPath.push([seg.start.latitude, seg.start.longitude]);
                        fullPath.push([seg.end.latitude, seg.end.longitude]);
                    }
                });

                if (!userPosition || data.response.starting_point) {
                    if (data.response.starting_point && !userPosition) {
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
        <div className="h-full flex flex-col p-4 lg:p-6 overflow-hidden relative" tabIndex={0}>

            <TourFormModal
                isOpen={showTourForm}
                onClose={() => setShowTourForm(false)}
                onSubmit={onTourFormSubmit}
                placeholderDest={inputMessage}
            />

            {/* Recommendations Sidebar (Pop-out) */}
            {showRecommendations && (
                <div className="absolute top-6 left-6 z-[2000] w-[350px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col animate-in slide-in-from-left-10 duration-300">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <div>
                            <h3 className="font-bold text-primary-800 text-lg">Top Recommendations</h3>
                            <p className="text-xs text-primary-600">Based on your route</p>
                        </div>
                        <button
                            onClick={handleDismissRecommendations}
                            className="p-1 hover:bg-primary-50 rounded-full transition-colors text-primary-400 hover:text-primary-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3 h-full">
                        {travelState.suggestions.map((place, idx) => (
                            <div key={idx} className="bg-white border border-primary-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-gray-800 text-base">{place.name}</h4>
                                    <span className="text-xs font-semibold bg-primary-50 px-2 py-0.5 rounded text-primary-700">
                                        {place.budget || '$$'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2 truncate">{place.address}</p>

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
                                    className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
                                >
                                    Add to Route
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* =============================================
                MAIN LAYOUT: Plans (left) | Map+Chat (right)
                Plans column spans FULL height on desktop
                ============================================= */}
            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

                {/* ── LEFT: Plans Panel (full height) ── */}
                <div className="lg:w-[40%] flex flex-col min-h-0 h-[500px] lg:h-full">
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 bg-gray-50/50 rounded-xl p-2 relative">

                        {travelState?.tour_plan ? (
                            <div className="absolute inset-0 flex flex-col">
                                <div className="flex gap-2 p-2 bg-white rounded-t-xl border-b sticky top-0 z-10">
                                    {['timeline', 'hotels', 'restaurants'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${activeTab === tab ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    {activeTab === 'timeline' && (
                                        <div className="space-y-4">
                                            <div className="bg-primary-50 p-3 rounded-xl border border-primary-100">
                                                <h3 className="font-bold text-primary-900">{travelState.tour_plan.title || "Tour Plan"}</h3>
                                                <p className="text-xs text-primary-700 mt-1">{travelState.tour_plan.overview || "No overview available."}</p>
                                                <div className="mt-2 text-xs font-mono bg-white/50 p-1.5 rounded">{travelState.tour_plan.budget_summary || "Budget TBD"}</div>

                                                {(travelState.tour_plan.avg_hotel_cost || travelState.tour_plan.avg_meal_cost) && (
                                                    <div className="mt-2 flex gap-2 text-[10px] text-primary-800">
                                                        {travelState.tour_plan.avg_hotel_cost && (
                                                            <span className="bg-white/50 px-2 py-1 rounded border border-primary-100">
                                                                🏨 Avg: {travelState.tour_plan.avg_hotel_cost}
                                                            </span>
                                                        )}
                                                        {travelState.tour_plan.avg_meal_cost && (
                                                            <span className="bg-white/50 px-2 py-1 rounded border border-primary-100">
                                                                🍽️ Avg: {travelState.tour_plan.avg_meal_cost}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-[10px] text-gray-400 text-center italic">Click a Day to see its route on map</div>

                                            {travelState.tour_plan.days?.map((day, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`relative pl-4 border-l-2 cursor-pointer transition-all hover:bg-gray-50 p-2 rounded-r-lg ${selectedDay === day.day_number ? 'border-primary-600 bg-primary-50' : 'border-primary-200'}`}
                                                    onClick={() => setSelectedDay(selectedDay === day.day_number ? null : day.day_number)}
                                                >
                                                    <div className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 border-white ${selectedDay === day.day_number ? 'bg-primary-700 scale-125' : 'bg-primary-500'}`}></div>
                                                    <h4 className="font-bold text-gray-800 mb-2 flex justify-between">
                                                        <span>Day {day.day_number}</span>
                                                        {selectedDay === day.day_number && <span className="text-xs text-primary-600">Active Route</span>}
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {day.activities?.map((act, aIdx) => (
                                                            <div key={aIdx} className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm text-sm">
                                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                                    <span>{act.time}</span>
                                                                    <span>{act.cost_estimate}</span>
                                                                </div>
                                                                <div className="font-semibold text-gray-800">{act.activity}</div>
                                                                <div className="text-xs text-gray-500">{act.location_name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'hotels' && (
                                        <div className="space-y-2">
                                            {travelState.tour_plan.hotels?.map((h, i) => (
                                                <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                    <div className="flex justify-between">
                                                        <h4 className="font-bold text-sm">{h.name}</h4>
                                                        <span className="text-xs bg-yellow-100 px-1.5 py-0.5 rounded">⭐ {h.rating}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">{h.description}</p>
                                                    <div className="mt-2 text-xs font-semibold text-gray-600">{h.budget}</div>
                                                </div>
                                            ))}
                                            {!travelState.tour_plan.hotels?.length && <div className="text-center text-gray-400 p-4">No hotels suggested.</div>}
                                        </div>
                                    )}

                                    {activeTab === 'restaurants' && (
                                        <div className="space-y-2">
                                            {travelState.tour_plan.restaurants?.map((r, i) => (
                                                <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                    <div className="flex justify-between">
                                                        <h4 className="font-bold text-sm">{r.name}</h4>
                                                        <span className="text-xs bg-yellow-100 px-1.5 py-0.5 rounded">⭐ {r.rating}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                                                    <div className="mt-2 text-xs font-semibold text-gray-600">{r.budget}</div>
                                                </div>
                                            ))}
                                            {!travelState.tour_plan.restaurants?.length && <div className="text-center text-gray-400 p-4">No restaurants suggested.</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : visibleSegments.length === 0 && !travelState?.destinations?.length ? (
                            travelState && activeSegmentIdx > 0 ? (
                                <div className="h-full flex items-center justify-center bg-green-50 rounded-2xl border border-green-100">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🎉</div>
                                        <h3 className="text-xl font-bold text-green-700">Trip Completed!</h3>
                                        <p className="text-green-600">You have reached all destinations.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="bg-primary-50 p-4 border-b border-primary-100">
                                        <h3 className="text-lg font-bold text-primary-800">Plans</h3>
                                    </div>
                                    <div className="flex-1 bg-gray-50/30"></div>
                                </div>
                            )
                        ) : (
                            <>
                                {travelState.starting_point && activeSegmentIdx === 0 && (
                                    <div className="bg-green-100 border border-green-200 rounded-xl p-4 shadow-sm mb-3">
                                        <div className="text-xs font-bold text-green-600 uppercase mb-1">Start Point</div>
                                        <div className="font-bold text-gray-800 text-lg">{travelState.starting_point.name}</div>
                                    </div>
                                )}

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
                </div>

                {/* ── RIGHT: Map + Chat stacked (full height) ── */}
                <div className="lg:w-[60%] flex flex-col gap-4 min-h-0 lg:h-full">

                    {/* Map (flex-1 — takes remaining space after chat) */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg saturate-150 overflow-hidden border border-gray-200 relative z-0 h-[300px] lg:h-auto min-h-0">
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

                            {routePath.length > 0 && (
                                <Polyline
                                    positions={routePath}
                                    color="#00008B"
                                    weight={5}
                                    opacity={0.8}
                                    dashArray="10, 10"
                                />
                            )}

                            {travelState?.starting_point && (
                                <Marker position={[travelState.starting_point.latitude, travelState.starting_point.longitude]}>
                                    <Popup>Start: {travelState.starting_point.name}</Popup>
                                </Marker>
                            )}

                            {travelState?.destinations?.map((dest, i) => (
                                <Marker key={i} position={[dest.latitude, dest.longitude]}>
                                    <Popup>Stop {i + 1}: {dest.name}</Popup>
                                </Marker>
                            ))}

                            {travelState?.tour_plan?.days?.flatMap(d => d.activities)
                                ?.filter(a => a.geo_location && (!selectedDay || travelState.tour_plan.days.find(day => day.day_number === selectedDay).activities.includes(a)))
                                ?.map((act, i) => (
                                    <Marker key={`tour-${i}`} position={[act.geo_location.latitude, act.geo_location.longitude]}>
                                        <Popup>
                                            <b>{act.activity}</b><br />{act.time}
                                        </Popup>
                                    </Marker>
                                ))}

                            {selectedDay && (() => {
                                const day = travelState?.tour_plan?.days?.find(d => d.day_number === selectedDay);
                                if (!day) return null;
                                const points = day.activities
                                    .filter(a => a.geo_location)
                                    .map(a => [a.geo_location.latitude, a.geo_location.longitude]);

                                if (points.length < 2) return null;

                                return (
                                    <Polyline
                                        positions={points}
                                        color="#dc2626"
                                        weight={4}
                                        opacity={0.9}
                                        dashArray="5, 5"
                                    />
                                );
                            })()}

                            {userPosition && (
                                <Marker position={userPosition} icon={CarIcon} zIndexOffset={1000}>
                                    <Popup>You are here</Popup>
                                </Marker>
                            )}
                        </MapContainer>

                        {routePath.length > 0 && (
                            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-[500]">
                                Use ⬆️ ⬇️ keys to move
                            </div>
                        )}

                        {currentInstruction && routePath.length > 0 && (
                            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary-900/90 backdrop-blur text-white px-6 py-3 rounded-2xl shadow-xl z-[1000] flex items-center gap-4 border border-primary-700/50 min-w-[300px]">
                                <div className="text-4xl">{currentInstruction.icon}</div>
                                <div className="flex-1">
                                    <div className="text-2xl font-bold">{currentInstruction.distance}m</div>
                                    <div className="text-sm text-primary-100 font-medium leading-tight">{currentInstruction.text}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat (fixed height) */}
                    <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col border border-gray-100 h-[300px] shrink-0">
                        {/* Chat History */}
                        <div className="flex-1 bg-gray-50/50 rounded-xl mb-4 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-0">
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
                        <div className="flex flex-col gap-2 w-full">
                            <TourToggle isEnabled={isTourMode} onToggle={() => setIsTourMode(!isTourMode)} />

                            <div className="flex gap-2 w-full">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isLoading}
                                    placeholder={isTourMode ? "Enter Tour Destination (e.g., Munnar)..." : "Type plan e.g., 'Start from Kozhikode to Cyberpark'"}
                                    className={`flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50 ${isTourMode ? 'ring-2 ring-primary-100 bg-primary-50' : ''}`}
                                />
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={isLoading}
                                    className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                                >
                                    {isTourMode ? 'Plan' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
                {/* ── END RIGHT ── */}

            </div>
            {/* ── END MAIN LAYOUT ── */}

        </div>
    );
};

export default Home;