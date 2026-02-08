import React from 'react';

export const AICameraLocations: React.FC = () => {
    return (
        <div className="w-full h-full flex flex-col bg-slate-50">
            <div className="flex-1 w-full h-full relative">
                <iframe
                    src="https://www.keralamvdaicamera.in/"
                    className="w-full h-full border-none absolute inset-0"
                    title="Kerala MVD AI Camera Locations"
                    allow="geolocation"
                />
            </div>
        </div>
    );
};
