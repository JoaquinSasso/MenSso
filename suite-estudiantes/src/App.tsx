import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Hub from "./pages/Hub";
function App() {
	return (
		<BrowserRouter>
			<Routes>
				{/* El Layout envuelve a todas las páginas para que siempre tengan Navbar */}
				<Route path="/" element={<Layout />}>
					<Route index element={<Hub />} />
					{/* <Route path="redes/click" element={<ViajeClick />} /> */}
					{/* <Route path="db/er-sql" element={<ERtoSQL />} /> */}
					{/* Aquí irán sumando más rutas tu compañero y tú */}
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;
