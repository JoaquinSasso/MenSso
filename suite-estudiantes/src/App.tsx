import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Hub from "./pages/Hub";
import EnConstruccion from "./pages/EnConstruccion";
import ConversorBases from "./pages/efc/ConversorBases";
import Subneteo from "./pages/redes/subneteo";
import Compilador from "./pages/AyRP/compilador";

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Layout />}>
					<Route index element={<Hub />} />

					{/* Redes */}
					<Route path="redes/click" element={<EnConstruccion />} />
					<Route path="redes/subneteo" element={<Subneteo/>} />

					{/* Bases de Datos */}
					<Route path="db/er-sql" element={<EnConstruccion />} />

					{/* Sistemas Operativos */}
					<Route path="so/planificador" element={<EnConstruccion />} />

					{/* Teoría de la Computación */}
					<Route path="automatas/simulador" element={<EnConstruccion />} />

					{/* Estructuras y Funcionamiento de Computadoras */}
					<Route path="efc/conversor-bases" element={<ConversorBases />} />

					{/* Algoritmos y resolución de problemas */}
					<Route path="AyRP/compilador" element={<Compilador />} />


					{/* Ruta comodín: cualquier otra URL vuelve al Hub */}
					<Route path="*" element={<Hub />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;
