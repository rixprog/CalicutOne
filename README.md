# Agentic Travel Planner & Route Intelligence Engine

## 🚀 Overview

An intelligent travel planning system built with **LangChain** and **Google Gemini 2.5 Flash** that understands natural language travel requests and generates JSON-formatted route plans with traffic analysis and public bus routing.

### Key Features

✅ **Natural Language Understanding** - Parse free-text travel intentions  
✅ **Smart Validation** - Reject generic places, require specific locations  
✅ **Multi-Modal Routing** - Car, bike, walk, public bus support  
✅ **Traffic Analysis** - Detect and report critical congestion  
✅ **Bus Route Planning** - Detailed multi-leg bus journeys with transfers  
✅ **JSON Output Only** - Strict structured output, no explanations  
✅ **LangChain Integration** - Agent-based architecture for extensibility  

---

## 📋 Requirements

- Python 3.10+
- Google API Key (for Gemini 2.5 Flash)
- Dependencies: See `requirements.txt`

---

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rixprog/CalicutOne.git
   cd CalicutOne
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment**
   ```bash
   # Create .env file
   echo "GOOGLE_API_KEY=your_api_key_here" > .env
   ```

   Get your API key: https://ai.google.dev/

---

## 🎯 Quick Start

### As Python Module

```python
from travel_planner_agent import TravelPlannerAgent

planner = TravelPlannerAgent()

# Plan a trip
result = planner.plan_travel("I want to go from Aluva to Lulu Mall Kochi by bus")
print(result)  # Returns JSON string
```

### Run Examples

```bash
python main.py
```

### Start API Server

```bash
python api_server.py
```

Then make requests:

```bash
curl -X POST http://localhost:5000/api/plan-trip \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Go from Aluva to Lulu Mall Kochi by bus"}'
```

---

## 📊 Response Format

### ✅ Success Response

```json
{
  "status": "success",
  "transport_mode": "public_bus",
  "route_plan": {
    "starting_point": {
      "name": "Aluva",
      "latitude": 10.1071,
      "longitude": 76.3656
    },
    "destinations": [
      {
        "order": 1,
        "destination_name": "Lulu Mall Kochi",
        "latitude": 9.9689,
        "longitude": 76.3233,
        "estimated_travel_time_from_previous_stop_minutes": 45
      }
    ]
  },
  "bus_route_plan": [
    {
      "step": 1,
      "board_at": "Aluva Metro Station",
      "bus_route": "101A",
      "get_down_at": "Lulu Mall Stop",
      "stops_count": 8
    }
  ]
}
```

### ⚠️ Insufficient Data

```json
{
  "status": "insufficient_data",
  "missing_information": [
    {
      "issue": "Generic destination mentioned",
      "original_text": "school",
      "required_clarification": "Please provide full school name and city"
    }
  ]
}
```

---

## ✅ Valid Locations

- "Lulu Mall Kochi"
- "Aluva Metro Station"
- "Ernakulam KSRTC Stand"
- "High Court Kochi"
- "Palakkad Railway Station"
- "Victoria College Palakkad"

## ❌ Invalid (Generic) Locations

- "school"
- "hospital"
- "home"
- "my office"
- "friend house"

**→ System asks for clarification**

---

## 🚌 Transport Modes

- **car** - Fastest for medium distances
- **bike** - Eco-friendly option
- **walk** - Short distance travel
- **public_bus** - Cost-effective with detailed route planning

---

## 🚦 Traffic Analysis

Traffic congestion is included in response ONLY if:
- Severity is "high" or "very_high"
- Critical bottleneck detected

```json
"traffic_block": {
  "start_latitude": 10.0,
  "start_longitude": 76.3,
  "end_latitude": 9.97,
  "end_longitude": 76.32,
  "severity": "high"
}
```

---

## 🚌 Public Bus Routing

When `transport_mode = "public_bus"`, response includes:

```json
"bus_route_plan": [
  {
    "step": 1,
    "board_at": "Aluva Metro Station",
    "bus_route": "101A",
    "get_down_at": "Ernakulam Junction",
    "stops_count": 5
  },
  {
    "step": 2,
    "board_at": "Ernakulam Junction",
    "bus_route": "103",
    "get_down_at": "Lulu Mall Stop",
    "stops_count": 3
  }
]
```

---

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/plan-trip` | Generate travel plan from natural language |
| POST | `/api/validate-input` | Validate structured travel input |
| GET | `/api/transport-modes` | List supported transport modes |
| GET | `/api/health` | Health check |

---

## 🧪 Testing

Run tests:

```bash
python tests.py
```

Run specific test:

```bash
python -m unittest tests.TestGeoLocationService -v
```

---

## 📚 Architecture

### Components

1. **TravelPlannerAgent** - Main orchestrator
2. **ValidationService** - Input validation & generic place detection
3. **GeoLocationService** - Geocoding with caching
4. **TrafficAnalysisService** - Traffic condition analysis
5. **PublicBusRouteService** - Multi-leg bus journey planning

### Data Models

- `Location` - Place with coordinates
- `Destination` - Waypoint with travel time
- `TrafficBlock` - Congestion segment
- `BusLeg` - Bus journey segment
- `RoutePlan` - Complete route

---

## 🎓 System Instructions

### Data Validation Rules

1. **Specific Locations Required** - No generic place names
2. **Real Coordinates Only** - Never hallucinate latitude/longitude
3. **Ask for Clarification** - When input is ambiguous
4. **Transport Mode Validation** - Only allowed modes accepted

### Output Rules

1. **JSON Only** - No markdown, no explanations
2. **Conditional Fields** - `traffic_block` only if critical
3. **Bus Structure** - Only for `public_bus` mode
4. **No Guessing** - Validate before generating routes

---

## 🔐 Environment Variables

Create `.env` file:

```bash
GOOGLE_API_KEY=your_gemini_api_key
```

---

## 📖 Documentation

Full documentation: See `DOCUMENTATION.md`

Covers:
- Architecture details
- Configuration options
- Performance optimization
- Error handling
- Future enhancements

---

## 🤝 Example Usage

### Example 1: Bus Journey

```python
planner.plan_travel("I will go from Aluva to Lulu Mall Kochi by bus")
```

Returns complete bus route with stops and transfers.

### Example 2: Car Journey

```python
planner.plan_travel("Drive from Palakkad Railway Station to Victoria College")
```

Returns route plan with traffic analysis if congestion exists.

### Example 3: Invalid Input

```python
planner.plan_travel("Take me to school by car")
```

Returns insufficient_data status asking for school clarification.

---

## 🛠️ Configuration

Customize behavior in `config.py`:

- Generic place names
- Known locations database
- Traffic patterns
- Bus routes
- Speed estimates

---

## 📝 Strict Rules

✓ Output ONLY JSON (no markdown)  
✓ No hallucinated coordinates  
✓ No auto-completion of vague places  
✓ Generic place validation required  
✓ Conditional field inclusion  
✓ LangChain agent architecture  

---

## 🚀 Future Enhancements

- Real-time traffic API integration
- Fare estimation
- Multiple route alternatives
- Weather-aware routing
- Accessibility options
- Carbon footprint calculation
- Multi-city support

---

## 📄 License

MIT License - See LICENSE file

---

## 👤 Author

**rixprog** - Travel Intelligence Systems

---

## 🤖 Powered By

- **LangChain** - Agent orchestration
- **Google Gemini 2.5 Flash** - Natural language processing
- **OpenStreetMap/Nominatim** - Geolocation
- **Flask** - REST API framework
