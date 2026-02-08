"""
Interactive Travel Planner - Stateful Agentic AI (Gemini 2.5 Flash)
Manages persistent state and rich CLI output.
"""

import json
from travel_planner_agent import TravelPlannerAgent, TravelState, Suggestion

def print_trip_status(state: TravelState):
    """Render the current trip status in a clean format"""
    print("\n" + "="*60)
    print("🗺️  CURRENT TRIP PLAN")
    print("="*60)
    
    # 1. Start Point
    start_name = state.starting_point.name if state.starting_point else "[Not Set]"
    print(f"📍 Start: {start_name}")
    
    # 2. Destinations & Route
    if state.destinations:
        print("🔻")
        for idx, dest in enumerate(state.destinations):
            # Check if this leg has segment info
            dist_str = ""
            dur_str = ""
            if idx < len(state.segments):
                seg = state.segments[idx]
                dist_str = f"({seg.distance_km} km | {seg.duration_minutes} min)"
                
            print(f"   {idx+1}. {dest.name} {dist_str}")
            if idx < len(state.destinations) - 1:
                print("🔻")
    else:
        print("   (No destinations added yet)")
        
    print(f"\n🚗 Mode: {state.transport_mode}")
    print("="*60 + "\n")

    # 3. Suggestions (if any)
    if state.current_suggestions:
        print("💡 SUGGESTIONS FOUND:")
        for idx, s in enumerate(state.current_suggestions):
            rating_str = f"⭐ {s.rating}" if s.rating else ""
            budget_str = f"💰 {s.budget}" if s.budget else ""
            dist_str = f"📏 {s.distance}" if s.distance else ""
            
            print(f"   [{idx+1}] {s.name} ({s.type})")
            print(f"       {rating_str}  {budget_str}  {dist_str}")
            if s.description:
                print(f"       📝 {s.description}")
            if s.link:
                print(f"       🔗 {s.link}")
            print("-" * 40)
        print("   (Type 'Add 1' to add suggestion to route)\n")

def main():
    agent = TravelPlannerAgent()
    state = TravelState()
    
    print("\n🚀 AGENTIC TRAVEL PLANNER v2 - Stateful & Dynamic")
    print("Commands: 'quit', 'reset', 'show plan'")
    print("Example: 'Start from Kozhikode', 'Add stop at Cyberpark', 'Show hotels nearby'")
    
    while True:
        try:
            user_input = input("\n📍 You: ").strip()
            
            if not user_input: continue
            
            if user_input.lower() in ['quit', 'exit']:
                print("👋 Goodbye!")
                break
            
            if user_input.lower() in ['reset', 'clear']:
                state = TravelState()
                print("🔄 Trip reset.")
                continue
                
            if user_input.lower() == 'show plan':
                print_trip_status(state)
                continue
                
            # Process with Agent
            print("🤖 Thinking...", end="\r")
            
            # The agent updates the state internally and returns it
            # We are using the state object directly since Python passes by reference, 
            # but good practice to capture return if API changes
            state = agent.update_state(state, user_input)
            
            # Show updated plan/status
            print(" "*20, end="\r") # Clear 'Thinking...'
            print_trip_status(state)
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
