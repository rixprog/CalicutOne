
import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from travel_planner_agent import TravelPlannerAgent, TravelState, Location, Suggestion

class TestTravelAgentSystem(unittest.TestCase):
    def setUp(self):
        self.agent = TravelPlannerAgent()
        self.state = TravelState()
        
        # Mock requests.get for Geoapify
        self.patcher = patch('requests.get')
        self.mock_get = self.patcher.start()
        
        # Default mock response
        self.mock_response = MagicMock()
        self.mock_response.status_code = 200
        self.mock_response.json.return_value = {
            "results": [
                {
                    "name": "Mock Hotel",
                    "lat": 10.0, "lon": 76.0,
                    "address": "Mock Address",
                    "distance": 100,
                    "properties": {"name": "Mock Hotel", "categories": ["accommodation.hotel"]}
                }
            ]
        }
        self.mock_get.return_value = self.mock_response

    def tearDown(self):
        self.patcher.stop()

    def test_01_basic_route(self):
        """Test setting start and destination"""
        print("\nTest 01: Basic Route")
        self.state = self.agent.update_state(self.state, "Start from Calicut Bus Stand and go to Kochi")
        
        self.assertIsNotNone(self.state.starting_point)
        self.assertEqual(self.state.starting_point.name, "Calicut Bus Stand")
        self.assertEqual(len(self.state.destinations), 1)
        self.assertEqual(self.state.destinations[0].name, "Kochi")
        
    def test_02_suggestions(self):
        """Test searching for suggestions"""
        print("\nTest 02: Suggestions")
        # Setup state
        self.state = self.agent.update_state(self.state, "Start from Kochi")
        
        # Search
        self.state = self.agent.update_state(self.state, "Show hotels near Kochi")
        
        self.assertTrue(len(self.state.current_suggestions) > 0)
        first_suggestion = self.state.current_suggestions[0]
        self.assertEqual(first_suggestion.type, "hotel")
        print(f"   Found suggestion: {first_suggestion.name}")

    def test_03_add_suggestion_to_route(self):
        """Test adding a suggestion to the route"""
        print("\nTest 03: Add Suggestion")
        # Setup
        self.state = self.agent.update_state(self.state, "Start from Calicut")
        self.state = self.agent.update_state(self.state, "Show restaurants near Calicut")
        
        # Add first one
        initial_dest_count = len(self.state.destinations)
        self.state = self.agent.update_state(self.state, "Add 1")
        
        self.assertEqual(len(self.state.destinations), initial_dest_count + 1)
        print(f"   Added to route: {self.state.destinations[-1].name}")

    def test_04_complex_flow(self):
        """Test a multi-turn conversation flow"""
        print("\nTest 04: Complex Flow")
        # 1. Start
        self.state = self.agent.update_state(self.state, "Start from Thrissur")
        self.assertEqual(self.state.starting_point.name, "Thrissur")
        
        # 2. Add Dest
        self.state = self.agent.update_state(self.state, "Go to Guruvayur Temple")
        self.assertEqual(self.state.destinations[0].name, "Guruvayur Temple")
        
        # 3. Search near dest
        self.state = self.agent.update_state(self.state, "Show hotels near Guruvayur Temple")
        self.assertTrue(len(self.state.current_suggestions) > 0)
        
        # 4. Add hotel
        hotel_name = self.state.current_suggestions[0].name
        self.state = self.agent.update_state(self.state, "Add the first hotel")
        self.assertEqual(self.state.destinations[1].name, hotel_name)
        
        # 5. Check segments
        # We expect 2 segments: Thrissur->Guruvayur, Guruvayur->Hotel
        self.assertEqual(len(self.state.segments), 2)
        print(f"   Segments generated: {len(self.state.segments)}")

if __name__ == '__main__':
    unittest.main()
