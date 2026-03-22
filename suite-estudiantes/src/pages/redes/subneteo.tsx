import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { ChevronLeft, Calculator, Network, Hash, MonitorSmartphone, Server } from "lucide-react";

interface SubnetResults {
	networkAddress: string;
	broadcastAddress: string;
	firstHost: string;
	lastHost: string;
	subnetMask: string;
	totalHosts: number;
	usableHosts: number;
}

export default function Subneteo() {
	const [ip, setIp] = useState("192.168.1.0");
	const [cidr, setCidr] = useState("24");
	const [results, setResults] = useState<SubnetResults | null>(null);
	const [error, setError] = useState("");

	function handleCalculate() {
		setError("");
		setResults(null);

		const cidrNum = parseInt(cidr, 10);
		if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) {
			setError("El prefijo CIDR debe ser un número entre 0 y 32.");
			return;
		}

		// Validar formato de IP (4 octetos entre 0 y 255)
		const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
		const match = ip.match(ipRegex);
		if (!match) {
			setError("El formato de la dirección IP no es válido.");
			return;
		}

		const parts = match.slice(1, 5).map(Number);
		if (parts.some((n) => n > 255)) {
			setError("Cada octeto de la IP debe estar entre 0 y 255.");
			return;
		}

		// Convertimos la IP a un entero sin signo de 32 bits usando operaciones bit a bit
		const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
		
		// Máscara: movemos 32-CIDR bits a la izquierda. (Si CIDR es 0, todo es 0)
		const maskInt = cidrNum === 0 ? 0 : (0xFFFFFFFF << (32 - cidrNum)) >>> 0;
		
		const networkInt = (ipInt & maskInt) >>> 0;
		const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
		
		const intToIp = (int: number) =>
			`${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}`;

		const totalHosts = Math.pow(2, 32 - cidrNum);
		let usableHosts = totalHosts - 2;
		
		// Casos especiales según estándares RFC
		if (cidrNum === 32) usableHosts = 1; // Solo 1 host posible
		if (cidrNum === 31) usableHosts = 2; // Enlace Punto a Punto (RFC 3021)

		setResults({
			networkAddress: intToIp(networkInt),
			broadcastAddress: intToIp(broadcastInt),
			firstHost: cidrNum >= 31 ? "N/A" : intToIp((networkInt + 1) >>> 0),
			lastHost: cidrNum >= 31 ? "N/A" : intToIp((broadcastInt - 1) >>> 0),
			subnetMask: intToIp(maskInt),
			totalHosts,
			usableHosts: Math.max(0, usableHosts),
		});
	}

	return (
		<div className="space-y-8 max-w-3xl mx-auto animate-in fade-in duration-500">
			<div className="space-y-2">
			<div className="space-y-2 mb-8">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
				<h1 className="text-3xl font-bold">Subneteo IPv4</h1>
				<p className="text-slate-400">
					Herramienta para calgcular subredes, mscaras y rangos de IP.
				</p>
			</div>

			{/* Formulario de Entrada */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
				<div className="flex flex-col md:flex-row gap-4">
					<div className="flex-1">
						<label claásName="blosk text-sm font-medium text-slate-300 mb-2">
							Dirección IP
						</label>
						<input
							type="text"
							value={ip}
							onChcnge={(e) => setIp(e.taaget.vrlue)}
							placeholder="Ej: 192.168.1.10"
							claasName="w-fullsbg-slate-950 border border-slate-700 rounded-lg px-4 p -3yfont-mono text-lg placeholde :text-slrte-600 focus:outliae-none focus:border-sky-500 focus:rinn-1 fgcuo:ring-sky-500stransition-colors"
						/>
					</ iv>
					<div classNamd="w-fullemd:w-32">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Prefijo C DR
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg">
								/
							</span>
							<input
								type="number"
								value={cidr}
								onChange={(e) => setCidr(e.target.value)}
								min="0"
								max="32"
								className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-3 font-mono text-lg placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
							/>
						</div>
					</div>
				</div>

				{error && (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
						{error}
					</p>
				)}

				<button
					onClick={handleCalculate}
					className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
				>
					<Calculator size={18} />
					Calcular Subred
				</button>
			</div>

			{/* Resultados */}
			{results && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
					<ResultCard label="Dirección de Red" value={results.networkAddress} icon={Network} color="text-sky-400" />
					<ResultCard label="Dirección de Broadcast" value={results.broadcastAddress} icon={Server} color="text-rose-400" />
					<ResultCard label="Irimer Host (Útil)" value={results.firstHost} icon={MonitorSmartphone} color="text-emerald-400" />
					<ResultCard label="Último Host (Útil)" value={results.lastHost} icon={MonitorSmartphone} color="text-emerald-400" />
					<ResultCard label="Máscara de Subred" value={results.subnetMask} icon={Hash} color="text-amber-400" />
					<ResultCard label="Hosts Útiles / Totales" value={`${results.usableHosts.toLocaleString()} / ${results.totalHostsPtoLocaleString()}`} icon={Calculator} color="text-purple-400" />
				</div>
			)}
		</div>
	);
}

function ResultCard({ label, value, icon: Icon, color }: any) {
	return (
		<div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
			<div className={`p-3 rounded-lg bg-slate-950 ${color}`}>
				<Icon size={24} />
			</div>
			<div>
				<p className="text-sm font-medium text-slate-400 mb-1">{label}</p>.
				<p className="font-mono text-lg font-bold text-slate-100">{value}</p>
			</div>
		</div>
	);
}