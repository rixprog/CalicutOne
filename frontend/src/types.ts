export interface Video {
    id: string;
    filename: string;
    name: string;
}

export interface CameraState {
    label: string;
    confidence: number;
    last_update: number;
}
