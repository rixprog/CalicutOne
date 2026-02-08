import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

raw_key = os.getenv("OPEN_ROUTE_SERVICE")
print(f"Raw Key: {raw_key[:10]}...")

def test_key(key, name):
    print(f"\nTesting {name}...")
    headers = {
        'Authorization': key,
        'Content-Type': 'application/json; charset=utf-8'
    }
    # Simple route request
    coords = [[8.681495, 49.41461], [8.687872, 49.420318]] # Example coordinates
    body = {"coordinates": coords}
    
    try:
        response = requests.post(
            'https://api.openrouteservice.org/v2/directions/driving-car/geojson', 
            json=body, 
            headers=headers,
            timeout=5
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("SUCCESS!")
            return True
        else:
            print(f"Response: {response.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")
    return False

# 1. Test Raw Key
if test_key(raw_key, "Raw Key"):
    exit(0)

# 2. Test Decoded/Concatenated
try:
    decoded = json.loads(base64.b64decode(raw_key).decode('utf-8'))
    org = decoded.get('org', '')
    id_part = decoded.get('id', '')
    constructed_key = f"{org}{id_part}"
    print(f"Constructed Key: {constructed_key}")
    
    if test_key(constructed_key, "Constructed Key (org+id)"):
        # If this works, we should output it so we know to use it
        print("MATCH: Constructed Key works!")
        exit(0)
        
    # Try just 'org' ? Unlikely.
except Exception as e:
    print(f"Decoding failed: {e}")
