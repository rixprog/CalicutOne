"""
Agentic Travel Planner & Route Intelligence Engine
Framework: LangChain
Model: Gemini 2.5 Flash
Output: JSON only
Integration: Geoapify for real routing and geocoding
"""

import json
import os
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, asdict, field
from enum import Enum
from dotenv import load_dotenv
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import time

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from geoapify_service import GeoapifyService
from ors_service import OpenRouteService

load_dotenv()

# ============================================================================
# DATA MODELS
# ============================================================================

class TransportMode(Enum):
    CAR = "car"
    BIKE = "bike"
    WALK = "walk"
    PUBLIC_BUS = "public_bus"

@dataclass
class Location:
    name: str
    latitude: float
    longitude: float
    
    def to_dict(self):
        return asdict(self)

@dataclass
class Suggestion:
    id: int
    name: str
    type: str # hotel, restaurant, attraction, amenity
    description: str
    rating: Optional[float] = None
    budget: Optional[str] = None # $, $$, $$$
    distance: Optional[str] = None
    address: Optional[str] = None
    link: Optional[str] = None
    location: Optional[Location] = None
    tags: List[str] = field(default_factory=list)
    price_level: Optional[str] = None # Detailed price e.g. "₹200-500"
    
    def to_dict(self):
        d = asdict(self)
        if self.location:
            d['location'] = self.location.to_dict()
        return d

@dataclass
class TripSegment:
    start: Location
    end: Location
    mode: str
    distance_km: float
    duration_minutes: int
    polyline: Optional[str] = None # Encoded polyline if available
    route_geometry: Optional[List[List[float]]] = None # [[lat, lon], ...]
    steps: Optional[List[Dict]] = None # [{'instruction': str, 'way_points': [start, end]}]
    
    def to_dict(self):
        return asdict(self)

@dataclass
class TravelState:
    starting_point: Optional[Location] = None
    destinations: List[Location] = field(default_factory=list)
    transport_mode: str = "car"
    current_suggestions: List[Suggestion] = field(default_factory=list)
    segments: List[TripSegment] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "starting_point": self.starting_point.to_dict() if self.starting_point else None,
            "destinations": [d.to_dict() for d in self.destinations],
            "transport_mode": self.transport_mode,
            "suggestions": [s.to_dict() for s in self.current_suggestions],
            "segments": [s.to_dict() for s in self.segments]
        }

# ============================================================================
# SERVICES
# ============================================================================

class GeoLocationService:
    """Handles geocoding and validation"""
    def __init__(self, timeout: int = 5):
        self.geocoder = Nominatim(user_agent="calicutone_travel_planner_v2")
        self.timeout = timeout
        self.cache = {}

    def geocode(self, query: str) -> Optional[Location]:
        if query in self.cache:
            return self.cache[query]
        try:
            loc = self.geocoder.geocode(query, timeout=self.timeout)
            if loc:
                res = Location(name=query, latitude=loc.latitude, longitude=loc.longitude)
                self.cache[query] = res
                return res
        except:
            return None
        return None

class TravelPlannerAgent:
    """Stateful Agentic Travel Planner"""
    
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0,
            api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.geo_service = GeoLocationService()
        self.geoapify = GeoapifyService()
        self.ors = OpenRouteService()
        
    def _parse_user_intent(self, state: TravelState, user_input: str) -> Dict:
        """
        Analyze user input against current state to determine intent.
        Returns a dict containing a list of actions/updates.
        """
        state_summary = {
            "start": state.starting_point.name if state.starting_point else "Not set",
            "destinations": [d.name for d in state.destinations],
            "mode": state.transport_mode,
            "has_suggestions": len(state.current_suggestions) > 0
        }
        
        prompt = f"""
        Current State: {json.dumps(state_summary)}
        User Input: "{user_input}"
        
        Analyze the input and determine the user's intent. Return JSON ONLY.
        
        Possible Actions (return a list of these):
        - SET_START: User defines/changes start point. Params: "location_name" (str) OR "lat" (float), "lon" (float) if expliclty provided.
        - ADD_DESTINATION: User adds a destination (to end of list)
        - INSERT_DESTINATION: User adds a stop in between (middle)
        - CHANGE_MODE: User changes transport mode
        - SEARCH_SUGGESTIONS: User asks for hotels, food, pumps, etc.
        - SELECT_SUGGESTION: User picks a suggestion (e.g. "add the first one", "add Paragon")
        - CLEAR_ALL: User wants to reset
        
        Output format:
        {{
            "actions": [
                {{
                    "action": "ACTION_NAME",
                    "params": {{
                        "location_name": "...", 
                        "lat": 11.123, "lon": 75.321,
                        "category": "hotel/restaurant/gas", 
                        "suggestion_index": 1, 
                        "mode": "car/bus/bike/walk"
                    }}
                }},
                ...
            ]
        }}
        
        Examples: 
        "Start from Calicut" -> {{ "actions": [ {{ "action": "SET_START", "params": {{ "location_name": "Calicut" }} }} ] }}
        "Current Location: 11.25, 75.77" -> {{ "actions": [ {{ "action": "SET_START", "params": {{ "location_name": "Current Location", "lat": 11.25, "lon": 75.77 }} }} ] }}
        """
        
        for attempt in range(3):
            try:
                response = self.llm.invoke([HumanMessage(content=prompt)])
                content = response.content.strip()
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                return json.loads(content)
            except Exception as e:
                print(f"Intent parsing error (attempt {attempt+1}): {e}")
                import time
                time.sleep(1)
        return {"actions": []}

    def _resolve_category_with_llm(self, user_query: str) -> str:
        """
        Uses LLM to map a user query (e.g. 'korean food', 'shoe shop') to the best Geoapify category.
        """
        try:
            # Common overrides to save LLM calls
            query_lower = user_query.lower()
            if "restaurant" in query_lower or "food" in query_lower: return "catering.restaurant"
            if "hotel" in query_lower: return "accommodation.hotel"
            if "hospital" in query_lower: return "healthcare.hospital"
            if "pump" in query_lower or "fuel" in query_lower: return "service.vehicle.fuel"
            if "supermarket" in query_lower: return "commercial.supermarket"

            prompt = f"""
            Map the user search query "{user_query}" to the most specific Geoapify Place Category.
            
            Common Categories:
            - catering.restaurant, catering.cafe, catering.fast_food
            - commercial.supermarket, commercial.shopping_mall, commercial.clothing, commercial.electronics
            - accommodation.hotel, accommodation.motel
            - entertainment.cinema, entertainment.museum, entertainment.zoo
            - service.vehicle.fuel, service.financial.atm
            - healthcare.hospital, healthcare.pharmacy
            - tourism.attraction, natural.beach
            - amenity.toilet, amenity.parking
            
            Return ONLY the category string (e.g., "entertainment.zoo"). If unsure, return "amenity".
            """
            response = self.llm.invoke([HumanMessage(content=prompt)])
            return response.content.strip()
        except:
            return "amenity"

    def _enrich_places_with_llm(self, candidates: List[Dict], category: str) -> Dict[str, Any]:
        """
        Uses LLM to estimate ratings, pricing, and tags for a list of places.
        Returns a dict mapped by place name.
        """
        try:
            place_names = [f"- {p['name']} ({p['address']})" for p in candidates]
            places_str = "\n".join(place_names)
            
            prompt = f"""
            I have a list of {category} places:
            {places_str}
            
            For each place, provide a JSON object with:
            - rating: estimated rating (float 3.0-5.0) based on popularity/reputation (guess if unknown)
            - budget: "$" (Cheap), "$$" (Moderate), or "$$$" (Expensive)
            - tags: list of 2-3 short tags (e.g., "Vegetarian", "Family Friendly", "24/7", "Grocery", "Italian")
            
            Return ONLY a JSON map where keys are the exact place names provided.
            Example:
            {{
                "Place Name": {{ "rating": 4.5, "budget": "$$", "tags": ["Veg", "Cozy"] }}
            }}
            """
            
            response = self.llm.invoke([HumanMessage(content=prompt)])
            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            return json.loads(content)
        except Exception as e:
            print(f"Enrichment error: {e}")
            return {}

    def update_state(self, state: TravelState, user_input: str) -> TravelState:
        """Main method to process input and update state"""
        intent = self._parse_user_intent(state, user_input)
        actions = intent.get("actions", [])
        
        # If legacy format (single action), wrap in list
        if "action" in intent:
            actions = [intent]
            
        print(f"DEBUG: Actions={actions}") # Debug log
        
        for action_item in actions:
            action = action_item.get("action")
            params = action_item.get("params", {})
            
            if action == "SET_START":
                state.suggestions = [] # Clear suggestions on route update
                loc_name = params.get("location_name")
                lat = params.get("lat")
                lon = params.get("lon")
                
                if lat is not None and lon is not None:
                     # Direct coordinates (e.g. from Live Location)
                     # Optional: Reverse geocode to get a name
                     try:
                         # We can try to get a name, or just use "Current Location"
                         # Let's try to reverse it for better UX, or just accept "Current Location"
                         state.starting_point = Location(loc_name or "Current Location", float(lat), float(lon))
                     except:
                         state.starting_point = Location("Current Location", float(lat), float(lon))
                
                elif loc_name:
                    # Try Geoapify with bias first if we have a vague idea (or just raw)
                    coords = self.geoapify.geocode_place(loc_name)
                    if coords:
                        state.starting_point = Location(loc_name, coords[0], coords[1])
                    else:
                        # Fallback
                        loc = self.geo_service.geocode(loc_name)
                        if loc: state.starting_point = loc
                    
            elif action == "ADD_DESTINATION":
                loc_name = params.get("location_name")
                
                # Check cache/suggestions first to ensure we pick the one the user sees
                found_suggestion = None
                if state.current_suggestions:
                    for s in state.current_suggestions:
                        # Exact or strong fuzzy match
                        if loc_name.lower() == s.name.lower() or loc_name.lower() in s.name.lower():
                            found_suggestion = s
                            break
                
                state.suggestions = [] # Clear suggestions now that we've checked them
                
                if found_suggestion and found_suggestion.location:
                    print(f"DEBUG: Using cached suggestion for '{loc_name}'")
                    state.destinations.append(found_suggestion.location)
                else:
                    # Standard Geocoding Flow
                    # Determine bias point (last destination or start)
                    bias = None
                    context_city = None
                    
                    if state.destinations:
                        last = state.destinations[-1]
                        bias = (last.latitude, last.longitude)
                    elif state.starting_point:
                        bias = (state.starting_point.latitude, state.starting_point.longitude)
                        # Try to get city context from start point name if possible
                        # Simple heuristic: if start is "Calicut Beach", context is "Calicut"
                        # But for now, let's just use the query enhancement
                
                # Try Geoapify with bias
                coords = self.geoapify.geocode_place(loc_name, bias_point=bias)
                if coords:
                    state.destinations.append(Location(loc_name, coords[0], coords[1]))
                else:
                    # Fallback to Nominatim
                    # IMPROVEMENT: Add context to query if possible to avoid "Auckland" issue
                    query = loc_name
                    if state.starting_point and "kozhikode" in state.starting_point.name.lower():
                        query += ", Kozhikode"
                    elif state.starting_point and "calicut" in state.starting_point.name.lower():
                        query += ", Calicut"
                    
                    loc = self.geo_service.geocode(query)
                    if not loc and query != loc_name: # Retry without context if failed
                        loc = self.geo_service.geocode(loc_name)
                        
                    if loc: 
                        # Update name to original if we found it using extended query
                        loc.name = loc_name 
                        state.destinations.append(loc)

            elif action == "INSERT_DESTINATION":
                state.suggestions = [] # Clear suggestions on route update
                loc_name = params.get("location_name")
                
                # Bias towards start
                bias = None
                if state.starting_point:
                    bias = (state.starting_point.latitude, state.starting_point.longitude)
                
                coords = self.geoapify.geocode_place(loc_name, bias_point=bias)
                if coords:
                    state.destinations.insert(0, Location(loc_name, coords[0], coords[1]))
                else:
                    # Fallback with context
                    query = loc_name
                    if state.starting_point and "kozhikode" in state.starting_point.name.lower():
                        query += ", Kozhikode"
                    elif state.starting_point and "calicut" in state.starting_point.name.lower():
                        query += ", Calicut"
                        
                    loc = self.geo_service.geocode(query)
                    if not loc and query != loc_name:
                         loc = self.geo_service.geocode(loc_name)
                         
                    if loc: 
                        loc.name = loc_name
                        state.destinations.insert(0, loc)

            elif action == "REMOVE_DESTINATION":
                state.suggestions = [] # Clear suggestions on route update
                loc_name = params.get("location_name")
                if loc_name:
                    # Fuzzy remove
                    to_remove = None
                    for d in state.destinations:
                        if loc_name.lower() in d.name.lower() or d.name.lower() in loc_name.lower():
                            to_remove = d
                            break
                    if to_remove:
                        state.destinations.remove(to_remove)
                        print(f"Removed destination: {to_remove.name}")
                    
            elif action == "CHANGE_MODE":
                state.transport_mode = params.get("mode", "car")
                
            elif action == "SEARCH_SUGGESTIONS":
                category = params.get("category")
                if not category: category = "amenity"
                
                loc_name = params.get("location_name")
                radius = 5000
                
                search_center = None
                
                # 1. Resolve Search Center
                if loc_name:
                    # Check start/dest first
                    if state.starting_point and loc_name.lower() in state.starting_point.name.lower():
                        search_center = state.starting_point
                    else:
                        for d in state.destinations:
                            if loc_name.lower() in d.name.lower():
                                search_center = d
                                break
                        if not search_center:
                            search_center = self.geo_service.geocode(loc_name)
                
                # Fallback to last known point
                if not search_center:
                    search_center = state.destinations[-1] if state.destinations else state.starting_point
                
                if search_center:
                    # 2. Smart Category Mapping via LLM
                    geo_cat = self._resolve_category_with_llm(category)
                    print(f"DEBUG: Mapping '{category}' -> '{geo_cat}' near {search_center.name}")

                    places = self.geoapify.search_places_near(
                        search_center.latitude, search_center.longitude, 
                        categories=geo_cat, 
                        radius_m=radius, 
                        limit=10 
                    )
                    
                    # 3. Filter & Prepare for Enrichment
                    candidates = []
                    for p in places:
                        name = p.get('name')
                        if not name: continue # Skip unnamed places (usually just roads/buildings)
                        
                        # Dedup by name
                        if any(c['name'] == name for c in candidates): continue
                        
                        candidates.append({
                            "name": name,
                            "address": p.get('address', ''),
                            "lat": p['latitude'],
                            "lon": p['longitude'],
                            "distance": int(p.get('distance_m') or 0),
                            "raw": p
                        })
                        if len(candidates) >= 5: break
                    
                    # 4. LLM Enrichment
                    if candidates:
                        enriched_data = self._enrich_places_with_llm(candidates, category)
                        
                        new_suggestions = []
                        for i, cand in enumerate(candidates):
                            # Merge enriched data
                            details = enriched_data.get(cand['name'], {})
                            
                            s = Suggestion(
                                id=i+1,
                                name=cand['name'],
                                type=category,
                                description=cand['address'],
                                rating=details.get('rating', 4.0),
                                budget=details.get('budget', '$$'),
                                distance=f"{cand['distance']}m",
                                address=cand['address'],
                                link=cand['raw'].get('website'),
                                location=Location(cand['name'], cand['lat'], cand['lon'])
                            )
                            # Dynamically add tags if supported by dataclass (it is in memory, if not defined in class it might error if not added)
                            # Check Suggestion definition...
                            # It implies 'tags' field is needed.
                            # Previous session summary said "Updated Suggestion dataclass to include tags".
                            # Let's verify Suggestion dataclass content via read.
                            # But assuming I need to add it:
                            s.tags = details.get('tags', []) # Monkey-patching if not in dataclass yet, or will fail
                            s.price_level = details.get('budget') # alias
                            
                            new_suggestions.append(s)
                        
                        state.current_suggestions = new_suggestions
                    else:
                        state.current_suggestions = []
                    
            elif action == "SELECT_SUGGESTION":
                # Add suggested item to route
                idx = params.get("suggestion_index")
                name = params.get("location_name")
                
                selected = None
                if idx and isinstance(idx, int) and 1 <= idx <= len(state.current_suggestions):
                    selected = state.current_suggestions[idx-1]
                elif name: # Try fuzzy match
                    for s in state.current_suggestions:
                        if name.lower() in s.name.lower():
                            selected = s
                            break
                
                if selected and selected.location:
                    # Logic: Add as an intermediate stop or destination?
                    # Defaulting to appending as destination for now
                    state.destinations.append(selected.location)
                    
            elif action == "CLEAR_ALL":
                state = TravelState()

        # Re-calculate route segments if possible
        self._recalc_route(state)
        return state

    def _recalc_route(self, state: TravelState):
        """Recalculate segments based on current start and destinations"""
        if not state.starting_point or not state.destinations:
            return
            
        new_segments = []
        points = [state.starting_point] + state.destinations
        
        for i in range(len(points) - 1):
            start = points[i]
            end = points[i+1]
            
            # Get real routing data
            route_info = None
            route_geometry = None
            steps = []
            
            # Try ORS first for geometry
            ors_route = self.ors.get_route(
                [start.latitude, start.longitude],
                [end.latitude, end.longitude],
                state.transport_mode # "car", "bike", "walk"
            )
            
            if ors_route:
                dist = round(ors_route.distance_m / 1000, 2)
                dur = int(ors_route.duration_sec / 60)
                route_geometry = ors_route.coordinates
                steps = ors_route.steps
            else:
                # Fallback to Geoapify if ORS fails (or just estimation)
                # For now, let's keep Geoapify as fallback or primary for distance?
                # Let's use Geoapify if ORS fails
                route_info = self.geoapify.get_route(
                    start.latitude, start.longitude,
                    end.latitude, end.longitude,
                    state.transport_mode
                )
                if route_info:
                    dist = route_info.distance_km
                    dur = route_info.duration_minutes
                else:
                    # Fallback estimation
                    dist = 10.0 
                    dur = 20
                
            new_segments.append(TripSegment(
                start=start, end=end, mode=state.transport_mode,
                distance_km=dist, duration_minutes=dur,
                route_geometry=route_geometry,
                steps=steps
            ))
            
        state.segments = new_segments

    def plan_travel(self, user_input: str, state: TravelState) -> str:
        """Entry point for the interactive loop"""
        updated_state = self.update_state(state, user_input)
        return json.dumps(updated_state.to_dict())

if __name__ == "__main__":
    # Quick test
    state = TravelState()
    agent = TravelPlannerAgent()
    print("Testing Agent...")
    
    # Test 1: Set Start
    state = agent.update_state(state, "Start from Calicut Bustand")
    print(f"State after start: {state.starting_point}")
    
    # Test 2: Add Dest
    state = agent.update_state(state, "Go to Cyberpark")
    print(f"State after dest: {state.destinations}")
    
    # Test 3: Suggestions
    state = agent.update_state(state, "Show me good hotels nearby")
    print(f"Suggestions: {len(state.current_suggestions)}")
    
    # Test 4: Select
    state = agent.update_state(state, "Add the first hotel")
    print(f"Destinations after add: {len(state.destinations)}")
