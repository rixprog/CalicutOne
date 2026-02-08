"""
Geoapify Integration Service - Real routing, geocoding, and distance/time data
"""

import os
import json
import requests
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class RouteInfo:
    """Real route information from Geoapify"""
    distance_m: float
    distance_km: float
    duration_sec: float
    duration_minutes: float
    duration_hours: float
    route_points: List[Tuple[float, float]] = None  # List of (lat, lon)


class GeoapifyService:
    """Geoapify API service for routing and geocoding"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEOAPIFY_API_KEY")
        self.base_url = "https://api.geoapify.com"
        self.geocode_url = f"{self.base_url}/v1/geocode"
        self.routing_url = f"{self.base_url}/v1/routing"
        self.enabled = bool(self.api_key)
        
        if not self.enabled:
            print("⚠️  GEOAPIFY_API_KEY not set. Will use fallback distance estimation.")
    
    def geocode_place(self, place_name: str, city: Optional[str] = None, bias_point: Optional[Tuple[float, float]] = None) -> Optional[Tuple[float, float]]:
        """
        Geocode a place name to (latitude, longitude)
        
        Args:
            place_name: Name of the place
            city: Optional city name for context
            bias_point: Optional (lat, lon) to bias the search (proximity)
            
        Returns:
            (latitude, longitude) tuple or None if not found
        """
        if not self.enabled:
            return None
        
        try:
            query = f"{place_name}, {city}" if city else place_name
            params = {
                "text": query,
                "apiKey": self.api_key,
                "limit": 1
            }
            
            # Add proximity bias if available
            if bias_point:
                lat, lon = bias_point
                params["bias"] = f"proximity:{lon},{lat}" # Geoapify format: lon,lat
                
            response = requests.get(self.geocode_url, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            if data.get("results"):
                result = data["results"][0]
                return (result["lat"], result["lon"])
            # Try features if results missing (GeoJSON style)
            elif data.get("features"):
                feat = data["features"][0]
                coords = feat.get("geometry", {}).get("coordinates")
                if coords: return (coords[1], coords[0]) # lat, lon
                
        except Exception as e:
            print(f"Geocoding error for '{place_name}': {e}")
        
        return None
    
    def get_route(self, start_lat: float, start_lon: float,
                 end_lat: float, end_lon: float,
                 mode: str = "drive") -> Optional[RouteInfo]:
        """
        Get real route information between two points using Geoapify Routing API
        
        Args:
            start_lat, start_lon: Starting coordinates
            end_lat, end_lon: Ending coordinates
            mode: "car", "bike", "walk", or "public_bus"
            
        Returns:
            RouteInfo with distance and time, or None if API fails
        """
        if not self.enabled:
            return None
        
        # Map our transport modes to Geoapify routing modes
        mode_map = {
            "car": "drive",
            "bike": "bicycle",  # Geoapify uses 'bicycle' not 'bike'
            "walk": "walk",
            "public_bus": "bus"
        }
        geoapify_mode = mode_map.get(mode, "drive")
        
        try:
            # Format: waypoints=lat,lon|lat,lon&mode=drive&format=json&apiKey=KEY
            waypoints = f"{start_lat},{start_lon}|{end_lat},{end_lon}"
            params = {
                "waypoints": waypoints,
                "mode": geoapify_mode,
                "format": "json",
                "apiKey": self.api_key
            }
            
            response = None
            for attempt in range(3):
                try:
                    response = requests.get(self.routing_url, params=params, timeout=15)
                    response.raise_for_status()
                    break
                except Exception as e:
                    if attempt == 2: raise e
                    import time
                    time.sleep(1)
            
            data = response.json()
            # API returns results array with first element containing route info
            if data.get("results") and len(data["results"]) > 0:
                result = data["results"][0]
                
                distance_m = result.get("distance", 0)  # distance in meters
                duration_sec = result.get("time", 0)    # time in seconds
                
                # Extract route points from legs if available
                route_points = None
                if result.get("legs"):
                    route_points = []
                    for leg in result["legs"]:
                        if leg.get("steps"):
                            for step in leg["steps"]:
                                if step.get("lat") and step.get("lon"):
                                    route_points.append((step["lat"], step["lon"]))
                
                return RouteInfo(
                    distance_m=distance_m,
                    distance_km=round(distance_m / 1000, 1),
                    duration_sec=duration_sec,
                    duration_minutes=int(duration_sec / 60),
                    duration_hours=round(duration_sec / 3600, 2),
                    route_points=route_points
                )
        except Exception as e:
            print(f"Routing error for {geoapify_mode} mode: {e}")
        
        return None
    
    def get_multiple_routes(self, start_lat: float, start_lon: float,
                           end_lat: float, end_lon: float) -> Dict[str, RouteInfo]:
        """
        Get route information for all transport modes
        
        Returns:
            Dictionary mapping mode -> RouteInfo
        """
        modes = ["car", "bike", "walk", "public_bus"]
        results = {}
        
        for mode in modes:
            route = self.get_route(start_lat, start_lon, end_lat, end_lon, mode)
            if route:
                results[mode] = route
        
        return results
    
    def is_enabled(self) -> bool:
        """Check if Geoapify is configured and available"""
        return self.enabled
    
    def test_connection(self) -> bool:
        """Test if API is reachable and key is valid"""
        if not self.enabled:
            return False
        
        try:
            # Test with a simple geocoding request
            params = {
                "text": "New York",
                "apiKey": self.api_key,
                "limit": 1
            }
            response = requests.get(self.geocode_url, params=params, timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def search_places_near(self, lat: float, lon: float, categories: str = "accommodation.hotels", radius_m: int = 5000, limit: int = 5) -> List[Dict]:
        """Search for POIs near a point using Geoapify Places API.

        Args:
            lat, lon: Center point (latitude, longitude)
            categories: Geoapify category string (e.g. 'accommodation.hotel')
            radius_m: Search radius in meters
            limit: Max results

        Returns:
            List of place dicts with keys: name, latitude, longitude, address, distance_m (optional)
        """
        if not self.enabled:
            return []

        places_url = f"{self.base_url}/v2/places"
        try:
            # Geoapify expects filter circle using lon,lat
            params = {
                "categories": categories,
                "filter": f"circle:{lon},{lat},{radius_m}",
                "limit": limit,
                "apiKey": self.api_key
            }
            
            # Retry loop
            for attempt in range(3):
                try:
                    resp = requests.get(places_url, params=params, timeout=30)
                    resp.raise_for_status()
                    data = resp.json()
                    break
                except Exception as e:
                    if attempt == 2: raise e
                    import time
                    time.sleep(1)

            results = []
            # Try GeoJSON style 'features' first
            if data.get("features"):
                for feat in data["features"]:
                    props = feat.get("properties", {})
                    geom = feat.get("geometry", {})
                    coords = geom.get("coordinates") if geom else None
                    lat_r = None
                    lon_r = None
                    if coords and len(coords) >= 2:
                        lon_r, lat_r = coords[0], coords[1]

                    results.append({
                        "name": props.get("name") or props.get("address_line1") or "",
                        "latitude": lat_r,
                        "longitude": lon_r,
                        "address": props.get("formatted") or props.get("address_line1") or "",
                        "distance_m": props.get("distance")
                    })
            # Fallback to 'results' array
            elif data.get("results"):
                for item in data["results"]:
                    name = item.get("name") or item.get("properties", {}).get("name")
                    lat_r = item.get("lat") or item.get("properties", {}).get("lat")
                    lon_r = item.get("lon") or item.get("properties", {}).get("lon")
                    address = item.get("address") or item.get("properties", {}).get("formatted")
                    
                    # Extract additional metadata
                    props = item.get("properties", {})
                    website = props.get("website") or props.get("url")
                    phone = props.get("contact", {}).get("phone") or props.get("phone")
                    
                    # Geoapify doesn't always provide ratings, but we can look for 'rank' or similar
                    # Check for 'datasource' details which might have raw tags
                    raw_tags = props.get("datasource", {}).get("raw", {})
                    
                    results.append({
                        "name": name,
                        "latitude": lat_r,
                        "longitude": lon_r,
                        "address": address,
                        "distance_m": item.get("distance", 0),
                        "website": website,
                        "phone": phone,
                        "categories": props.get("categories", [])
                    })

            return results
        except Exception as e:
            print(f"Places search error: {e}")
            return []


# Example usage
if __name__ == "__main__":
    service = GeoapifyService()
    
    if service.is_enabled():
        print("Geoapify service initialized ✓")
        
        # Test geocoding
        coords = service.geocode_place("Kozhikode Railway Station", "Kerala")
        if coords:
            print(f"Kozhikode Railway Station: {coords}")
        
        coords2 = service.geocode_place("St Joseph's College Devagiri", "Kozhikode")
        if coords2:
            print(f"St Joseph's College: {coords2}")
            
            # Test routing
            route = service.get_route(coords[0], coords[1], coords2[0], coords2[1], "car")
            if route:
                print(f"\nRoute Info (Car):")
                print(f"  Distance: {route.distance_km} km ({route.distance_m} m)")
                print(f"  Time: {route.duration_minutes} minutes ({route.duration_hours} hours)")
    else:
        print("⚠️  Geoapify API key not configured")
        print("Set GEOAPIFY_API_KEY environment variable to enable real routing")
