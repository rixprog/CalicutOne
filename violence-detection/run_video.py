import argparse
import cv2
import numpy as np
from model import Model

def argument_parser():
    parser = argparse.ArgumentParser(description="Violence detection for Videos")
    parser.add_argument('--video-path', type=str, required=True,
                        help='path to your input video file (e.g., .mp4)')
    parser.add_argument('--output-path', type=str, default='output.mp4',
                        help='path to save the output video')
    parser.add_argument('--display', action='store_true',
                        help='display the video while processing')
    args = parser.parse_args()
    return args

def main():
    args = argument_parser()
    
    # Initialize model
    print("Loading model...")
    model = Model()
    print("Model loaded.")

    # Open video file
    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file {args.video_path}")
        return

    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    
    # Initialize video writer
    # MP4V codec is widely supported for .mp4
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') 
    out = cv2.VideoWriter(args.output_path, fourcc, fps, (width, height))
    
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        
        # Make a copy for processing (model requires RGB)
        # Verify if model.predict modifies the image in place or not (it shouldn't, but safe to be careful)
        # model.predict uses: tf_image = self.transform_image(image) -> converts to PIL -> CLIP preprocess
        # It does not modify inputs.
        
        # Convert BGR to RGB for the model
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Predict
        prediction = model.predict(image=image_rgb)
        label = prediction['label']
        confidence = prediction['confidence']  # This might be 'confidence' based on model.py return dict
        
        # Create label text
        text = f"{label}: {confidence:.2f}"
        
        # Overlay text on the original BGR frame
        # Choose color based on label? Maybe Red for violence, Green for others.
        # For now, let's use Red (0, 0, 255) for high visibility
        text_color = (0, 0, 255)
        
        cv2.putText(frame, text, (30, 30), cv2.FONT_HERSHEY_SIMPLEX, 
                    1, text_color, 2, cv2.LINE_AA)
        
        # Write frame to output video
        out.write(frame)
        
        if args.display:
            cv2.imshow('Violence Detection', frame)
            # Press 'q' to quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        if frame_count % 10 == 0:
            print(f"Processed {frame_count} frames...", end='\r')

    # Release resources
    cap.release()
    out.release()
    if args.display:
        cv2.destroyAllWindows()
    
    print(f"\nProcessing complete. Output saved to {args.output_path}")

if __name__ == '__main__':
    main()
