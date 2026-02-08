

// Simplified Polygon approximation for Kozhikode District
// Coordinates are in [lng, lat] format as per GeoJSON standard
export const KOZHIKODE_BOUNDARY = {
    "type": "Feature",
    "properties": {
        "name": "Kozhikode"
    },
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                [75.5600, 11.2000], // South West (approx)
                [75.7500, 11.1000], // South
                [75.9500, 11.2500], // South East
                [76.1000, 11.4500], // East
                [76.0500, 11.6500], // North East
                [75.8500, 11.7500], // North
                [75.6500, 11.6000], // North West
                [75.5200, 11.4500], // West
                [75.5600, 11.2000]  // Close loop
            ]
        ]
    }
};
