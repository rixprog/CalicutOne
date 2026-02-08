import os
import requests
import json
from typing import List, Optional, Dict
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class RouteGeometry:
    coordinates: List[List[float]] # [[lon, lat], [lon, lat], ...]
    distance_m: float
    duration_sec: float
    steps: List[str] = None # Turn-by-turn instructions

class OpenRouteService:
    def __init__(self):
        self.raw_key = os.getenv("OPEN_ROUTE_SERVICE")
        self.api_key = self.raw_key # Use raw key directly as requested
        self.base_url = "https://api.openrouteservice.org/v2/directions"
        self.profile_map = {
            "car": "driving-car",
            "bike": "cycling-regular",
            "walk": "foot-walking",
            "public_bus": "driving-car" # Fallback for bus
        }
        
    def get_route(self, start_coords: List[float], end_coords: List[float], mode: str = "driving-car") -> Optional[RouteGeometry]:
        """
        Get route geometry between two points using GET request
        start_coords: [lat, lon]
        end_coords: [lat, lon]
        mode: driving-car, cycling-regular, foot-walking (or simple car, bike, walk)
        """
        if not self.api_key:
            print("ORS Key missing")
            return None

        # Map simple mode to ORS profile
        ors_profile = self.profile_map.get(mode.lower(), mode) 
        # If mode is already correct (e.g. driving-car), it stays. 
        # If unknown, it keeps as is, but we should probably default to car if unknown.
        if ors_profile not in self.profile_map.values() and ors_profile not in self.profile_map:
             # Basic validation
             if ors_profile not in ["driving-car", "cycling-regular", "foot-walking", "driving-hgv", "wheelchair"]:
                 ors_profile = "driving-car"

        # ORS uses [lon, lat] for URL params
        # Format: start=lon,lat&end=lon,lat
        start_str = f"{start_coords[1]},{start_coords[0]}"
        end_str = f"{end_coords[1]},{end_coords[0]}"
        
        try:
            # Construct URL with query params
            url = f"{self.base_url}/{ors_profile}"
            params = {
                "api_key": self.api_key,
                "start": start_str,
                "end": end_str
            }
            
            # Allow requests to handle encoding
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'features' in data and len(data['features']) > 0:
                    feature = data['features'][0]
                    geometry = feature.get('geometry', {}).get('coordinates', [])
                    props = feature.get('properties', {})
                    summary = props.get('summary', {})
                    segments = props.get('segments', [])
                    
                    steps = []
                    for seg in segments:
                        for step in seg.get('steps', []):
                            steps.append(step.get('instruction', ''))
                    
                    # Convert coordinates to [lat, lon] for Leaflet
                    route_points = [[p[1], p[0]] for p in geometry]
                    
                    return RouteGeometry(
                        coordinates=route_points,
                        distance_m=summary.get('distance', 0),
                        duration_sec=summary.get('duration', 0),
                        steps=steps
                    )
            else:
                print(f"ORS API Error: {response.text}")
                
        except Exception as e:
            print(f"ORS Request Error: {e}")
            
        return None

if __name__ == "__main__":
    ors = OpenRouteService()
    # Test Calicut to Cyberpark
    route = ors.get_route([11.2588, 75.7804], [11.2330, 75.8450])
    if route:
        print(f"Route found! Points: {len(route.coordinates)}, Dist: {route.distance_m}m")
