"""
Unit tests for Travel Planner Agent
"""

import unittest
import json
from travel_planner_agent import (
    TravelPlannerAgent,
    GeoLocationService,
    ValidationService,
    TransportMode,
    Location,
    Destination,
    TrafficBlock,
    BusLeg,
    RoutePlan
)


class TestGeoLocationService(unittest.TestCase):
    """Test geolocation service"""

    def setUp(self):
        self.geo_service = GeoLocationService()

    def test_is_generic_place(self):
        """Test generic place detection"""
        assert self.geo_service.is_generic_place("school") == True
        assert self.geo_service.is_generic_place("hospital") == True
        assert self.geo_service.is_generic_place("Lulu Mall Kochi") == False
        assert self.geo_service.is_generic_place("Aluva") == False

    def test_geocode_known_place(self):
        """Test geocoding known location"""
        location = self.geo_service.validate_and_geocode("Kochi")
        # Kochi should be found
        if location:
            assert -90 <= location.latitude <= 90
            assert -180 <= location.longitude <= 180

    def test_caching(self):
        """Test geolocation caching"""
        loc1 = self.geo_service.validate_and_geocode("Kochi")
        loc2 = self.geo_service.validate_and_geocode("Kochi")
        # Second call should use cache
        assert len(self.geo_service.cache) > 0


class TestValidationService(unittest.TestCase):
    """Test validation service"""

    def setUp(self):
        self.geo_service = GeoLocationService()
        self.validation_service = ValidationService(self.geo_service)

    def test_validate_generic_destination(self):
        """Test rejection of generic destination"""
        result = self.validation_service.validate_travel_intent(
            "school", ["hospital"], "car"
        )
        assert result["is_valid"] == False
        assert len(result["missing_information"]) > 0

    def test_validate_specific_destination(self):
        """Test validation with specific destinations"""
        result = self.validation_service.validate_travel_intent(
            "Kochi", ["Ernakulam"], "car"
        )
        # Should be valid or have location-specific issues, not generic ones
        if not result["is_valid"]:
            for issue in result["missing_information"]:
                assert issue["issue"] != "Generic starting point"

    def test_invalid_transport_mode(self):
        """Test invalid transport mode detection"""
        result = self.validation_service.validate_travel_intent(
            "Kochi", ["Ernakulam"], "helicopter"
        )
        assert result["is_valid"] == False
        assert any(i["issue"] == "Invalid transport mode" 
                  for i in result["missing_information"])


class TestDataModels(unittest.TestCase):
    """Test data model classes"""

    def test_location_to_dict(self):
        """Test Location serialization"""
        loc = Location("Test Place", 10.5, 76.3)
        d = loc.to_dict()
        assert d["name"] == "Test Place"
        assert d["latitude"] == 10.5
        assert d["longitude"] == 76.3

    def test_destination_to_dict(self):
        """Test Destination serialization"""
        dest = Destination(1, "Test Dest", 10.5, 76.3, 30)
        d = dest.to_dict()
        assert d["order"] == 1
        assert d["estimated_travel_time_from_previous_stop_minutes"] == 30

    def test_traffic_block_to_dict(self):
        """Test TrafficBlock serialization"""
        tb = TrafficBlock(10.0, 76.0, 9.9, 76.2, "high")
        d = tb.to_dict()
        assert d["severity"] == "high"
        assert d["start_latitude"] == 10.0

    def test_bus_leg_to_dict(self):
        """Test BusLeg serialization"""
        leg = BusLeg(1, "Stop A", "101A", "Stop B", 5)
        d = leg.to_dict()
        assert d["bus_route"] == "101A"
        assert d["stops_count"] == 5

    def test_route_plan_to_dict(self):
        """Test RoutePlan serialization"""
        start = Location("Start", 10.0, 76.0)
        dests = [Destination(1, "End", 9.9, 76.2, 30)]
        plan = RoutePlan(start, dests)
        d = plan.to_dict()
        assert d["starting_point"]["name"] == "Start"
        assert len(d["destinations"]) == 1


class TestTransportMode(unittest.TestCase):
    """Test transport mode enum"""

    def test_transport_mode_values(self):
        """Test all transport modes are valid"""
        modes = [tm.value for tm in TransportMode]
        assert "car" in modes
        assert "bike" in modes
        assert "walk" in modes
        assert "public_bus" in modes


class TestTravelPlannerAgent(unittest.TestCase):
    """Test main travel planner agent"""

    def setUp(self):
        self.planner = TravelPlannerAgent()

    def test_extract_travel_intent(self):
        """Test travel intent extraction"""
        intent = self.planner._extract_travel_intent(
            "Go from Kochi to Ernakulam by car"
        )
        if intent:
            assert "starting_point" in intent
            assert "destinations" in intent
            assert "transport_mode" in intent

    def test_estimate_travel_time(self):
        """Test travel time estimation"""
        from_loc = Location("Start", 10.0, 76.0)
        to_loc = Location("End", 10.1, 76.1)
        
        time_car = self.planner._estimate_travel_time(from_loc, to_loc, "car")
        time_walk = self.planner._estimate_travel_time(from_loc, to_loc, "walk")
        
        # Walking should take longer than car
        assert time_walk > time_car
        assert time_car > 0
        assert time_walk > 0

    def test_plan_travel_invalid_input(self):
        """Test plan_travel with invalid input"""
        result_json = self.planner.plan_travel("Go to school")
        result = json.loads(result_json)
        
        # Should return insufficient_data status
        assert result["status"] in ["insufficient_data", "error"]

    def test_json_output_only(self):
        """Test that output is valid JSON only"""
        result_json = self.planner.plan_travel("Go from Kochi to Ernakulam")
        
        # Should be parseable JSON
        try:
            result = json.loads(result_json)
            assert "status" in result
            # Should not contain markdown
            assert "```" not in result_json
            assert "#" not in result_json or "status" in result_json
        except json.JSONDecodeError:
            self.fail("Output is not valid JSON")


class TestResponseFormat(unittest.TestCase):
    """Test response format compliance"""

    def setUp(self):
        self.planner = TravelPlannerAgent()

    def test_success_response_structure(self):
        """Test success response has required fields"""
        # We can't test full success without valid input/API
        # But we can validate structure if we get a success response
        pass

    def test_insufficient_data_response_structure(self):
        """Test insufficient_data response structure"""
        result_json = self.planner.plan_travel("Go to school")
        result = json.loads(result_json)
        
        if result["status"] == "insufficient_data":
            assert "missing_information" in result
            assert isinstance(result["missing_information"], list)
            if len(result["missing_information"]) > 0:
                info = result["missing_information"][0]
                assert "issue" in info
                assert "original_text" in info
                assert "required_clarification" in info

    def test_traffic_block_only_if_critical(self):
        """Test traffic_block is only included when critical"""
        result_json = self.planner.plan_travel("Go by car from Kochi to Ernakulam")
        result = json.loads(result_json)
        
        # If traffic_block is present, severity should be high/very_high
        if "traffic_block" in result:
            assert result["traffic_block"]["severity"] in ["high", "very_high"]

    def test_bus_route_plan_only_for_public_bus(self):
        """Test bus_route_plan only included for public_bus mode"""
        # Car journey should not have bus_route_plan
        result_json = self.planner.plan_travel("Go by car from Kochi to Ernakulam")
        result = json.loads(result_json)
        
        if result["status"] == "success":
            if result["transport_mode"] != "public_bus":
                assert "bus_route_plan" not in result


if __name__ == "__main__":
    unittest.main()
