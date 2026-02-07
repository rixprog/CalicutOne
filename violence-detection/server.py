import os
import cv2
import time
import json
import threading
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from model import Model

app = Flask(__name__)
CORS(app)

# Initialize model
model = Model()

VIDEO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend/assets/data'))

# Global state to store the latest prediction for each camera
# Key: video_id, Value: dict with label, confidence, etc.
CAMERA_STATES = {}
CAMERA_LOCK = threading.Lock()

def get_video_list():
    videos = []
    if os.path.exists(VIDEO_DIR):
        files = sorted([f for f in os.listdir(VIDEO_DIR) if f.endswith('.mp4')])
        for i, file in enumerate(files):
            # Create a simple ID and display name
            video_id = f"cam-{i+1}"
            display_name = f"Video {i+1}"
            
            videos.append({
                "id": video_id,
                "filename": file,
                "name": display_name
            })
    return videos

# Helper to look up ID by filename
def get_id_by_filename(filename):
    videos = get_video_list()
    for v in videos:
        if v['filename'] == filename:
            return v['id']
    return None

@app.route('/api/videos', methods=['GET'])
def list_videos():
    return jsonify(get_video_list())

@app.route('/api/events')
def events():
    def event_stream():
        while True:
            with CAMERA_LOCK:
                # Create a copy to serialise
                data = json.dumps(CAMERA_STATES)
            
            yield f"data: {data}\n\n"
            time.sleep(0.1) # Update every 100ms

    return Response(event_stream(), mimetype="text/event-stream")

def generate_frames(video_path, video_id):
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    while True:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
                
            # Convert BGR to RGB for the model
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Predict
            prediction = model.predict(image=image_rgb)
            label = prediction['label']
            confidence = prediction['confidence']
            
            # Update global state
            if video_id:
                with CAMERA_LOCK:
                    CAMERA_STATES[video_id] = {
                        "label": label,
                        "confidence": float(confidence),
                        "last_update": time.time()
                    }
            
            # Encode frame (CLEAN, no text overlay)
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/api/video_feed/<filename>')
def video_feed(filename):
    video_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(video_path):
        return jsonify({"error": "Video not found"}), 404
    
    video_id = get_id_by_filename(filename)
        
    return Response(generate_frames(video_path, video_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
