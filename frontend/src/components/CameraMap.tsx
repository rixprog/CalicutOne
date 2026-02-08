import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CameraLocation } from '../data/cameras';
import { KOZHIKODE_BOUNDARY } from '../data/kozhikodeGeoJSON';
import L from 'leaflet';

// Fix for default marker icon missing assets
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});


interface CameraMapProps {
    cameras: CameraLocation[];
    onCameraClick: (camera: CameraLocation) => void;
}

const KeralaCenter: [number, number] = [10.8505, 76.2711]; // Approx center

// Component to handle map resize issues
const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
}

export const CameraMap: React.FC<CameraMapProps> = ({ cameras, onCameraClick }) => {
    return (
        <MapContainer
            center={KeralaCenter}
            zoom={8}
            scrollWheelZoom={true}
            className="w-full h-full z-0"
        >
            <MapResizer />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <GeoJSON
                data={KOZHIKODE_BOUNDARY as any}
                style={{
                    fillColor: '#8b5cf6', // Primary purple-like color
                    weight: 2,
                    opacity: 1,
                    color: '#6d28d9', // Darker border
                    fillOpacity: 0.2
                }}
            />

            {cameras.map(cam => (
                <Marker
                    key={cam.id}
                    position={[cam.lat, cam.lng]}
                    eventHandlers={{
                        click: () => onCameraClick(cam),
                    }}
                >
                    <Popup>
                        <div className="text-center">
                            <h3 className="font-bold text-sm">{cam.name}</h3>
                            <p className="text-xs text-slate-500">Click to view feed</p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};
