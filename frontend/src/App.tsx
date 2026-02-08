import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ViolenceDetection } from "@/components/ViolenceDetection";
import { AICameraLocations } from "@/components/AICameraLocations";
import { Navbar } from "@/components/Navbar";

function App() {
	return (
		<Router>
			<div className="flex flex-col h-screen bg-background font-sans antialiased overflow-hidden">
				<Navbar />
				<div className="flex-1 overflow-hidden">
					<Routes>
						<Route path="/" element={<ViolenceDetection />} />
						<Route path="/ai-cameras" element={<AICameraLocations />} />
					</Routes>
				</div>
			</div>
		</Router>
	)
}

export default App
