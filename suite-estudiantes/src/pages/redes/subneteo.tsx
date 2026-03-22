import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ChevronLeft,
	Calculator,
	Network,
	Hash,
	MonitorSmartphone,
	Server,
	Play,
	RotateCcw,
	ArrowLeft,
	ArrowRight,
	SkipForward,
	Keyboard,
} from "lucide-react";

type StepType = "ip-bin" | "mask-bin" | "network" | "broadcast" | "hosts" | "result";

interface SubnetStep {
	title: string;
	description: string;
	type: StepType;
	data?: any;
}

const toBin8 = (n: number) => n.toString(2).padStart(8, "0");

function generateSubnetSteps(ipParts: number[], cidrNum: number): SubnetStep[] {
	const steps: SubnetStep[] = [];
	const ipBin = ipParts.map(toBin8);

	// Paso 1: IP a Binario
	steps.push({
		title: "1. Convertir la IP a Binario",
		description: "Los routers y computadoras procesan las direcciones en binario. Cada uno de los 4 octetos (separados por puntos) se convierte en un número de 8 bits.",
		type: "ip-bin",
		data: { ipParts, ipBin },
	});

	// Paso 2: Máscara
	const maskBinStr = "".padStart(cidrNum, "1").padEnd(32, "0");
	const maskBin = [
		maskBinStr.slice(0, 8),
		maskBinStr.slice(8, 16),
		maskBinStr.slice(16, 24),
		maskBinStr.slice(24, 32),
	];
	const maskParts = maskBin.map((b) => parseInt(b, 2));

	steps.push({
		title: "2. Obtener la Máscara de Subred",
		description: `El prefijo CIDR /${cidrNum} nos dice que los primeros ${cidrNum} bits de la máscara son '1' (porción de red) y los restantes son '0' (porción de host).`,
		type: "mask-bin",
		data: { cidrNum, maskBin, maskParts },
	});

	// Paso 3: Dirección de Red (AND)
	const netParts = ipParts.map((p, i) => p & maskParts[i]);
	const netBin = netParts.map(toBin8);

	steps.push({
		title: "3. Dirección de Red (Operación AND)",
		description: "Para encontrar la dirección de red, aplicamos la compuerta lógica AND bit a bit entre la IP y la Máscara. El resultado solo es '1' si ambos bits son '1'.",
		type: "network",
		data: { ipBin, maskBin, netBin, netParts },
	});

	// Paso 4: Dirección de Broadcast (OR)
	const invMaskParts = maskParts.map((p) => ~p & 255);
	const broadcastParts = ipParts.map((p, i) => p | invMaskParts[i]);
	const broadcastBin = broadcastParts.map(toBin8);

	steps.push({
		title: "4. Dirección de Broadcast (Operación OR)",
		description: "La MÁSC. INV (Máscara Invertida o Wildcard) se obtiene cambiando los '1' de la máscara por '0', y los '0' por '1'. Para calcular el Broadcast, aplicamos un OR lógico entre la IP y esta Máscara Invertida. Hacer un OR con los '1' de la wildcard fuerza a que todos los bits de la porción de host se enciendan, dándonos la última dirección posible de la subred.",
		type: "broadcast",
		data: {
			ipBin,
			invMaskBin: invMaskParts.map(toBin8),
			broadcastBin,
			broadcastParts,
		},
	});

	// Paso 5: Cálculo de Hosts
	const hostBits = 32 - cidrNum;
	const totalHosts = Math.pow(2, hostBits);
	let usableHosts = totalHosts - 2;
	if (cidrNum === 32) usableHosts = 1; // Un solo host posible
	if (cidrNum === 31) usableHosts = 2; // Enlace Punto a Punto (RFC 3021)

	steps.push({
		title: "5. Calcular Cantidad de Hosts",
		description: `Como una dirección IPv4 tiene siempre 32 bits en total, y el prefijo CIDR (/${cidrNum}) nos indica cuántos de esos bits se usan para la red, el resto nos queda para los hosts. Por lo tanto, hacemos la resta: 32 - ${cidrNum} = ${hostBits} bits para hosts. Con ${hostBits} bits, el total de combinaciones posibles es 2^${hostBits}. Finalmente, a ese total se le restan 2 para obtener los hosts "útiles", ya que la primera IP está reservada para identificar la Red y la última para el Broadcast.`,
		type: "hosts",
		data: { hostBits, totalHosts, usableHosts, cidrNum },
	});

	// Paso 6: Resumen
	steps.push({
		title: "6. Resumen de la Subred",
		description: "Al compilar todos los datos calculados, obtenemos la configuración final y el rango de hosts útiles.",
		type: "result",
		data: {
			network: netParts.join("."),
			broadcast: broadcastParts.join("."),
			mask: maskParts.join("."),
			first: cidrNum >= 31 ? "N/A" : [...netParts.slice(0, 3), netParts[3] + 1].join("."),
			last: cidrNum >= 31 ? "N/A" : [...broadcastParts.slice(0, 3), broadcastParts[3] - 1].join("."),
			usableHosts,
			totalHosts,
		},
	});

	return steps;
}

export default function Subneteo() {
	const [ip, setIp] = useState("192.168.1.0");
	const [cidr, setCidr] = useState("24");
	const [steps, setSteps] = useState<SubnetStep[]>([]);
	const [currentStep, setCurrentStep] = useState(0);
	const [isCalculated, setIsCalculated] = useState(false);
	const [error, setError] = useState("");

	const navRef = useRef<HTMLDivElement>(null);

	// Auto-scroll
	useEffect(() => {
		if (isCalculated && navRef.current) {
			navRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [currentStep, isCalculated]);

	// Navegación
	const goNext = useCallback(() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1)), [steps.length]);
	const goPrev = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);
	const goToEnd = useCallback(() => setCurrentStep(steps.length - 1), [steps.length]);

	// Atajos de teclado
	useEffect(() => {
		if (!isCalculated) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				goNext();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				goPrev();
			} else if (e.key === "End") {
				e.preventDefault();
				goToEnd();
			} else if (e.key === "Home") {
				e.preventDefault();
				setCurrentStep(0);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isCalculated, goNext, goPrev, goToEnd]);

	function handleCalculate() {
		setError("");
		setIsCalculated(false);

		const cidrNum = parseInt(cidr, 10);
		if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) {
			setError("El prefijo CIDR debe ser un número entre 0 y 32.");
			return;
		}

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

		const newSteps = generateSubnetSteps(parts, cidrNum);
		setSteps(newSteps);
		setCurrentStep(0);
		setIsCalculated(true);
	}

	function handleReset() {
		setSteps([]);
		setCurrentStep(0);
		setIsCalculated(false);
		setError("");
	}

	const step = steps[currentStep];
	const isLastStep = currentStep === steps.length - 1;
	const isFirstStep = currentStep === 0;

	return (
		<div className="space-y-8 max-w-3xl mx-auto animate-in fade-in duration-500">
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
					Herramienta para calcular subredes, máscaras y rangos de IP.
				</p>
			</div>

			{/* Formulario de Entrada */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
				<div className="flex flex-col md:flex-row gap-4">
					<div className="flex-1">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Dirección IP
						</label>
						<input
							type="text"
							value={ip}
							onChange={(e) => {
								setIp(e.target.value);
								if (isCalculated) setIsCalculated(false);
							}}
							onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
							placeholder="Ej: 192.168.1.10"
							className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono text-lg placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
						/>
					</div>
					<div className="w-full md:w-32">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Prefijo CIDR
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg">
								/
							</span>
							<input
								type="number"
								value={cidr}
								onChange={(e) => {
									setCidr(e.target.value);
									if (isCalculated) setIsCalculated(false);
								}}
								onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
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

				<div className="flex gap-3">
					<button
						onClick={handleCalculate}
						className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
					>
						<Play size={18} />
						Explicar paso a paso
					</button>
					{isCalculated && (
						<button
							onClick={handleReset}
							className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
							title="Reiniciar"
						>
							<RotateCcw size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Visor de Pasos */}
			{isCalculated && step && (
				<div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
					<div className="h-1 bg-slate-800">
						<div
							className="h-full bg-sky-500 transition-all duration-300"
							style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
						/>
					</div>

					<div className="p-6 space-y-6">
						<div className="space-y-1">
							<div className="flex items-center gap-2 mb-2">
								<span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-1 rounded">
									Paso {currentStep + 1} de {steps.length}
								</span>
							</div>
							<h2 className="text-xl font-bold text-white">{step.title}</h2>
							<p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
						</div>

						<div className="py-4 flex justify-center">
							{step.type === "ip-bin" && (
								<div className="space-y-4 text-center">
									<div className="flex gap-2 justify-center font-mono text-2xl text-slate-300">
										{step.data.ipParts.map((p: any, i: number) => (
											<span key={i} className="bg-slate-800 px-3 py-1 rounded">{p}</span>
										))}
									</div>
									<div className="text-slate-500 font-mono">↓</div>
									<div className="flex gap-2 justify-center font-mono text-lg text-sky-400">
										{step.data.ipBin.map((p: any, i: number) => (
											<span key={i} className="bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20">{p}</span>
										))}
									</div>
								</div>
							)}

							{step.type === "mask-bin" && (
								<div className="space-y-4 text-center">
									<div className="font-mono text-xl text-slate-300 bg-slate-800 px-4 py-2 rounded">
										CIDR /<span className="text-amber-400 font-bold">{step.data.cidrNum}</span>
									</div>
									<div className="text-slate-500 font-mono">↓</div>
									<div className="flex gap-2 justify-center font-mono text-lg text-amber-400">
										{step.data.maskBin.map((p: any, i: number) => (
											<span key={i} className="bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{p}</span>
										))}
									</div>
									<div className="text-slate-500 font-mono">↓</div>
									<div className="flex gap-2 justify-center font-mono text-2xl text-slate-200">
										{step.data.maskParts.map((p: any, i: number) => (
											<span key={i} className="bg-slate-800 px-3 py-1 rounded">{p}</span>
										))}
									</div>
								</div>
							)}

							{(step.type === "network" || step.type === "broadcast") && (
								<div className="bg-slate-950 p-6 rounded-xl border border-slate-800 font-mono text-sm md:text-lg w-full max-w-lg">
									<div className="flex justify-between text-slate-400">
										<span>IP</span>
										<span className="text-sky-400 tracking-wider">{step.data.ipBin.join(".")}</span>
									</div>
									<div className="flex justify-between text-slate-400 mt-2">
										<span>{step.type === "network" ? "MÁSCARA" : "MÁSC. INV"}</span>
										<span className="text-amber-400 tracking-wider">
											{step.type === "network" ? step.data.maskBin.join(".") : step.data.invMaskBin.join(".")}
										</span>
									</div>
									<div className="border-t border-slate-700 my-4 relative">
										<span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 px-2 text-xs font-bold text-slate-500">
											{step.type === "network" ? "AND LÓGICO" : "OR LÓGICO"}
										</span>
									</div>
									<div className="flex justify-between font-bold">
										<span className={step.type === "network" ? "text-emerald-400" : "text-rose-400"}>
											{step.type === "network" ? "RED" : "BROADCAST"}
										</span>
										<span className={`tracking-wider ${step.type === "network" ? "text-emerald-400" : "text-rose-400"}`}>
											{step.type === "network" ? step.data.netBin.join(".") : step.data.broadcastBin.join(".")}
										</span>
									</div>
									<div className="mt-4 text-center text-slate-300 bg-slate-900 py-2 rounded">
										Resultado Decimal: <span className="font-bold">{step.type === "network" ? step.data.netParts.join(".") : step.data.broadcastParts.join(".")}</span>
									</div>
								</div>
							)}

							{step.type === "hosts" && (
								<div className="text-center space-y-6">
									<div className="inline-flex gap-8 items-center bg-slate-950 p-6 rounded-xl border border-slate-800">
										<div className="space-y-1">
											<p className="text-slate-500 text-sm">Fórmula</p>
											<p className="text-2xl font-mono text-sky-400">2<sup className="text-sm">{step.data.hostBits}</sup> - 2</p>
										</div>
										<div className="text-2xl text-slate-600">=</div>
										<div className="space-y-1">
											<p className="text-slate-500 text-sm">Cálculo</p>
											<p className="text-2xl font-mono text-slate-300">{step.data.totalHosts} - 2</p>
										</div>
										<div className="text-2xl text-slate-600">=</div>
										<div className="space-y-1">
											<p className="text-slate-500 text-sm">Útiles</p>
											<p className="text-3xl font-mono text-emerald-400 font-bold">{step.data.usableHosts.toLocaleString()}</p>
										</div>
									</div>
									{(step.data.cidrNum === 31 || step.data.cidrNum === 32) && (
										<p className="text-sm text-amber-400 bg-amber-500/10 inline-block px-4 py-2 rounded-lg border border-amber-500/20">
											Nota: Este es un caso especial RFC. Un /{step.data.cidrNum} tiene reglas diferentes para los hosts.
										</p>
									)}
								</div>
							)}

							{step.type === "result" && (
								<div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
									<ResultCard label="Dirección de Red" value={step.data.network} icon={Network} color="text-emerald-400" />
									<ResultCard label="Dirección de Broadcast" value={step.data.broadcast} icon={Server} color="text-rose-400" />
									<ResultCard label="Primer Host Útil" value={step.data.first} icon={MonitorSmartphone} color="text-sky-400" />
									<ResultCard label="Último Host Útil" value={step.data.last} icon={MonitorSmartphone} color="text-sky-400" />
									<ResultCard label="Máscara de Subred" value={step.data.mask} icon={Hash} color="text-amber-400" />
									<ResultCard label="Hosts Útiles / Totales" value={`${step.data.usableHosts.toLocaleString()} / ${step.data.totalHosts.toLocaleString()}`} icon={Calculator} color="text-purple-400" />
								</div>
							)}
						</div>

						<div ref={navRef} className="flex items-center justify-between pt-4 border-t border-slate-800">
							<button onClick={goPrev} disabled={isFirstStep} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 bg-slate-800 hover:bg-slate-700 text-slate-300">
								<ArrowLeft size={16} /> Anterior
							</button>

							<div className="flex gap-1.5 flex-wrap justify-center">
								{steps.map((_, i) => (
									<button key={i} onClick={() => setCurrentStep(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentStep ? "bg-sky-500 w-4" : i < currentStep ? "bg-sky-500/40" : "bg-slate-700"}`} />
								))}
							</div>

							<div className="flex items-center gap-2">
								{!isLastStep && (
									<button onClick={goToEnd} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30" title="Ir al resumen">
										<SkipForward size={14} /> Resumen
									</button>
								)}
								<button 
									onClick={isLastStep ? handleReset : goNext} 
									className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-sky-600 hover:bg-sky-500 text-white"
								>
									{isLastStep ? "Nueva consulta" : "Siguiente"} 
									{isLastStep ? <RotateCcw size={16} /> : <ArrowRight size={16} />}
								</button>
							</div>
						</div>
						
						<div className="flex items-center justify-center gap-2 text-xs text-slate-600 pt-2">
							<Keyboard size={12} />
							<span>Usá las flechas ← → del teclado para navegar</span>
						</div>
					</div>
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
				<p className="text-sm font-medium text-slate-400 mb-1">{label}</p>
				<p className="font-mono text-lg font-bold text-slate-100">{value}</p>
			</div>
		</div>
	);
}