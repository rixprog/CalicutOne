from dotenv import load_dotenv
import os

load_dotenv()
key = os.getenv("GOOGLE_API_KEY")
print(f"Loaded key: {'*' * 5 if key else 'None'}")
print(f"Current working directory: {os.getcwd()}")
