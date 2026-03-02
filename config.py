"""
Configuration and utility functions for Travel Planner Agent
"""

import json
from typing import Dict, List, Any

# ============================================================================
# CONFIGURATION
# ============================================================================

# Supported transport modes
TRANSPORT_MODES = {
    "car": "Car (fastest, urban)",
    "bike": "Bicycle (eco-friendly)",
    "walk": "Walking (short distances)",
    "public_bus": "Public Bus (cost-effective)"
}

# Generic place names that require clarification
GENERIC_PLACES = {
    "school", "hospital", "home", "office", "workplace",
    "friend house", "my office", "my home", "friend's house"
}

# Known Kochi/Ernakulam locations with coordinates
KNOWN_LOCATIONS = {
    "Lulu Mall Kochi": {"lat": 9.9689, "lon": 76.3233},
    "Aluva Metro Station": {"lat": 10.1071, "lon": 76.3656},
    "Ernakulam KSRTC Stand": {"lat": 9.9773, "lon": 76.2873},
    "High Court Kochi": {"lat": 9.9716, "lon": 76.2906},
    "Mattancherry Palace": {"lat": 9.9734, "lon": 76.2738},
    "Palakkad Railway Station": {"lat": 10.7867, "lon": 76.6407},
    "Victoria College Palakkad": {"lat": 10.7784, "lon": 76.6321},
}

# Common bus routes in Kochi
KOCHI_BUS_ROUTES = {
    "101A": "Aluva - Ernakulam Junction",
    "101B": "Aluva - Fort Kochi",
    "102": "Kochi Infopark - Ernakulam",
    "103": "Vyttila - Fort Kochi",
    "105": "Kakkanad - Mattancherry",
    "106": "Palakkad - Kochi",
}

# ============================================================================
# TRAFFIC PATTERNS
# ============================================================================

TRAFFIC_PATTERNS = {
    "morning_peak": {
        "hours": (7, 10),
        "severity": "very_high",
        "affected_routes": ["Aluva-Ernakulam", "Vyttila Bypass", "Edappally Junction"]
    },
    "evening_peak": {
        "hours": (17, 20),
        "severity": "high",
        "affected_routes": ["Fort Kochi", "Ernakulam South", "Vyttila"]
    },
    "weekend": {
        "hours": (10, 18),
        "severity": "normal",
        "affected_routes": []
    }
}

# ============================================================================
# EXAMPLE REQUESTS
# ============================================================================

EXAMPLE_REQUESTS = {
    "valid_bus": "I will go from Aluva to Lulu Mall Kochi by bus",
    "valid_car": "Drive me from Palakkad Railway Station to Victoria College Palakkad",
    "valid_walk": "Walk from High Court Kochi to Mattancherry Palace",
    "invalid_generic": "Take me to school by car",
    "invalid_incomplete": "Go from home to office",
    "missing_transport": "Journey from Aluva to Kochi",
    "missing_destination": "Travel from Aluva by car",
}

# ============================================================================
# RESPONSE TEMPLATES
# ============================================================================

SUCCESS_RESPONSE_TEMPLATE = {
    "status": "success",
    "transport_mode": "",
    "route_plan": {
        "starting_point": {
            "name": "",
            "latitude": 0.0,
            "longitude": 0.0
        },
        "destinations": [
            {
                "order": 1,
                "destination_name": "",
                "latitude": 0.0,
                "longitude": 0.0,
                "estimated_travel_time_from_previous_stop_minutes": 0
            }
        ]
    }
    # Optional fields:
    # "traffic_block": {...}  (only if critical congestion)
    # "bus_route_plan": [...]  (only if transport_mode == "public_bus")
}

INSUFFICIENT_DATA_RESPONSE_TEMPLATE = {
    "status": "insufficient_data",
    "missing_information": [
        {
            "issue": "",
            "original_text": "",
            "required_clarification": ""
        }
    ]
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def format_json_response(data: Dict[str, Any]) -> str:
    """Format response as compact JSON"""
    return json.dumps(data, indent=None, separators=(',', ':'))


def format_json_response_pretty(data: Dict[str, Any]) -> str:
    """Format response as pretty JSON"""
    return json.dumps(data, indent=2)


def validate_coordinates(lat: float, lon: float) -> bool:
    """Validate latitude and longitude"""
    return -90 <= lat <= 90 and -180 <= lon <= 180


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def estimate_travel_time(distance_km: float, transport_mode: str) -> int:
    """Estimate travel time based on distance and transport mode"""
    speeds = {
        "car": 50,      # km/h
        "bike": 15,     # km/h
        "walk": 5,      # km/h
        "public_bus": 25  # km/h
    }
    speed = speeds.get(transport_mode, 30)
    minutes = (distance_km / speed) * 60
    return max(1, int(minutes))
