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
        - SET_START: User defines/changes start point
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
                        "category": "hotel/restaurant/gas", 
                        "suggestion_index": 1, 
                        "mode": "car/bus/bike/walk"
                    }}
                }},
                ...
            ]
        }}
        
        Example: "Start from Calicut and go to Kochi" -> 
        {{ "actions": [ {{ "action": "SET_START", "params": {{ "location_name": "Calicut" }} }}, {{ "action": "ADD_DESTINATION", "params": {{ "location_name": "Kochi" }} }} ] }}
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
                loc_name = params.get("location_name")
                loc = self.geo_service.geocode(loc_name)
                if loc: 
                    state.starting_point = loc
                    
            elif action == "ADD_DESTINATION":
                loc_name = params.get("location_name")
                loc = self.geo_service.geocode(loc_name)
                if loc:
                    state.destinations.append(loc)

            elif action == "INSERT_DESTINATION":
                loc_name = params.get("location_name")
                loc = self.geo_service.geocode(loc_name)
                if loc:
                    # simple logic: insert at the beginning of destinations list (after start)
                    # or try to find optimal order? For now, just prepend to destinations
                    # so it becomes Start -> Inserted -> Old Dest
                    state.destinations.insert(0, loc)
                    
            elif action == "CHANGE_MODE":
                state.transport_mode = params.get("mode", "car")
                
            elif action == "SEARCH_SUGGESTIONS":
                category = params.get("category", "amenity")
                loc_name = params.get("location_name")
                radius = 5000
                
                search_center = None
                
                # 1. Try explicit location in query
                if loc_name:
                    # Check if it matches start or dest
                    if state.starting_point and loc_name.lower() in state.starting_point.name.lower():
                        search_center = state.starting_point
                    else:
                        # Check destinations
                        for d in state.destinations:
                            if loc_name.lower() in d.name.lower():
                                search_center = d
                                break
                        # If still not found, geocode it
                        if not search_center:
                            search_center = self.geo_service.geocode(loc_name)
                
                # 2. Fallback to last known point
                if not search_center:
                    search_center = state.destinations[-1] if state.destinations else state.starting_point
                
                if search_center:
                    # Map logical categories to Geoapify categories
                    geo_cat = "amenity"
                    if "hotel" in category or "stay" in category: geo_cat = "accommodation.hotel"
                    elif "food" in category or "restaurant" in category: geo_cat = "catering.restaurant"
                    elif "gas" in category or "pump" in category or "fuel" in category: geo_cat = "service.vehicle.fuel"
                    elif "hospital" in category: geo_cat = "healthcare.hospital"
                    
                    places = self.geoapify.search_places_near(
                        search_center.latitude, search_center.longitude, 
                        categories=geo_cat, 
                        radius_m=radius, 
                        limit=5
                    )
                    
                    new_suggestions = []
                    for idx, p in enumerate(places):
                        # Clean rating logic
                        # Generate a budget string randomly if missing (Demo purposes as Geoapify free often explicitly lacks this)
                        import random
                        fake_budget = random.choice(["$", "$$", "$$$"]) 
                        fake_rating = round(random.uniform(3.5, 4.9), 1)
                        
                        s = Suggestion(
                            id=idx+1,
                            name=p.get('name', 'Unknown'),
                            type=category,
                            description=p.get('address', ''),
                            rating=fake_rating, # Placeholder for demo
                            budget=fake_budget, # Placeholder
                            distance=f"{int(p.get('distance_m') or 0)}m",
                            address=p.get('address'),
                            link=p.get('website'),
                            location=Location(p['name'], p['latitude'], p['longitude'])
                        )
                        new_suggestions.append(s)
                    state.current_suggestions = new_suggestions
                    
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
                dist = 10.0 # Placeholder
                dur = 20    # Placeholder
                
            new_segments.append(TripSegment(
                start=start, end=end, mode=state.transport_mode,
                distance_km=dist, duration_minutes=dur
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
