import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ChevronLeft,
	Play,
	RotateCcw,
	ArrowLeft,
	ArrowRight,
	SkipForward,
	Keyboard,
	Plus,
	Trash2,
} from "lucide-react";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

type Algorithm =
	| "fcfs"
	| "sjf"
	| "sjf-preemptive-burst"
	| "sjf-preemptive-remaining"
	| "round-robin"
	| "priorities";

const ALGORITHM_LABELS: Record<Algorithm, string> = {
	fcfs: "FCFS / FIFO",
	sjf: "SJF sin desalojo",
	"sjf-preemptive-burst": "SJF con desalojo (ráfaga total)",
	"sjf-preemptive-remaining": "SJF con desalojo (tiempo remanente / SRTF)",
	"round-robin": "Round Robin",
	priorities: "Prioridades",
};

interface ProcessInput {
	id: string;
	name: string;
	arrivalTime: number;
	burstTime: number;
	priority: number;
}

interface ProcState {
	name: string;
	arrivalTime: number;
	burstTime: number;
	remaining: number;
	priority: number;
	finishTime: number;
	arrived: boolean;
	finished: boolean;
}

type CellType = "running" | "ready" | "idle" | "finished" | "not-arrived";

interface SimStep {
	time: number;
	title: string;
	events: string[];
	decision: string;
	runningName: string | null;
	readyQueue: { name: string; remaining: number; priority: number }[];
	gantt: Record<string, CellType[]>;
	quantumUsed: number;
}

interface SummaryRow {
	name: string;
	ti: number;
	tCPU: number;
	tf: number;
	tr: number;
	te: number;
}

interface SimResult {
	steps: SimStep[];
	summary: SummaryRow[];
	tmr: number;
	tme: number;
	totalTime: number;
}

// ─────────────────────────────────────────────
// MOTOR DE SIMULACIÓN
// ─────────────────────────────────────────────

function simulate(
	inputs: ProcessInput[],
	algorithm: Algorithm,
	quantum: number,
): SimResult {
	// Inicializar estados
	const procs: ProcState[] = inputs
		.map((p) => ({
			name: p.name,
			arrivalTime: p.arrivalTime,
			burstTime: p.burstTime,
			remaining: p.burstTime,
			priority: p.priority,
			finishTime: -1,
			arrived: false,
			finished: false,
		}))
		.sort(
			(a, b) => a.arrivalTime - b.arrivalTime || a.name.localeCompare(b.name),
		);

	const maxPossibleTime =
		procs.reduce((s, p) => s + p.burstTime, 0) +
		Math.max(...procs.map((p) => p.arrivalTime)) +
		1;

	const readyQueue: ProcState[] = [];
	let running: ProcState | null = null;
	let quantumUsed = 0;

	const steps: SimStep[] = [];
	const ganttData: Record<string, CellType[]> = {};
	for (const p of procs) ganttData[p.name] = [];

	const isPreemptive =
		algorithm === "sjf-preemptive-burst" ||
		algorithm === "sjf-preemptive-remaining" ||
		algorithm === "round-robin" ||
		algorithm === "priorities";

	const usesQuantum = algorithm === "round-robin" || algorithm === "priorities";

	// Función de selección del siguiente proceso
	function selectNext(): ProcState | null {
		if (readyQueue.length === 0) return null;

		switch (algorithm) {
			case "fcfs":
			case "round-robin":
				return readyQueue[0];

			case "sjf":
			case "sjf-preemptive-burst":
			case "sjf-preemptive-remaining": {
				// Menor ráfaga (original para sjf/sjf-preemptive-burst, remaining para srtf)
				const useRemaining = algorithm === "sjf-preemptive-remaining";
				let best = readyQueue[0];
				for (let i = 1; i < readyQueue.length; i++) {
					const curr = readyQueue[i];
					const currVal = useRemaining ? curr.remaining : curr.burstTime;
					const bestVal = useRemaining ? best.remaining : best.burstTime;
					if (
						currVal < bestVal ||
						(currVal === bestVal && curr.arrivalTime < best.arrivalTime)
					) {
						best = curr;
					}
				}
				return best;
			}

			case "priorities": {
				// Menor número = mayor prioridad; empate por FCFS
				let best = readyQueue[0];
				for (let i = 1; i < readyQueue.length; i++) {
					const curr = readyQueue[i];
					if (
						curr.priority < best.priority ||
						(curr.priority === best.priority &&
							readyQueue.indexOf(curr) < readyQueue.indexOf(best))
					) {
						best = curr;
					}
				}
				return best;
			}
		}
	}

	function removeFromQueue(proc: ProcState) {
		const idx = readyQueue.indexOf(proc);
		if (idx >= 0) readyQueue.splice(idx, 1);
	}

	// Bucle principal de simulación
	for (let t = 0; t < maxPossibleTime; t++) {
		const events: string[] = [];
		let decision = "";

		// ── 1. Verificar si el proceso en CPU terminó ──
		if (running && running.remaining === 0) {
			running.finished = true;
			running.finishTime = t;
			events.push(
				`El proceso ${running.name} finaliza su ejecución (completó sus ${running.burstTime}ms de ráfaga).`,
			);
			running = null;
			quantumUsed = 0;
		}

		// ── 2. Procesar llegadas ──
		for (const p of procs) {
			if (!p.arrived && p.arrivalTime === t) {
				p.arrived = true;
				readyQueue.push(p);
				events.push(
					`Llega el proceso ${p.name} (ráfaga: ${p.burstTime}ms${algorithm === "priorities" ? `, prioridad: ${p.priority}` : ""}).`,
				);
			}
		}

		// ── 3. Verificar expiración de quantum (RR / Prioridades) ──
		if (running && usesQuantum && quantumUsed >= quantum) {
			events.push(
				`El quantum (${quantum}ms) del proceso ${running.name} expiró. Pasa al final de la cola de listos.`,
			);
			readyQueue.push(running);
			running = null;
			quantumUsed = 0;
		}

		// ── 4. Verificar desalojo (SJF preemptivo) ──
		if (
			running &&
			(algorithm === "sjf-preemptive-burst" ||
				algorithm === "sjf-preemptive-remaining")
		) {
			const candidate = selectNext();
			if (candidate) {
				const useRemaining = algorithm === "sjf-preemptive-remaining";
				const runningVal = useRemaining ? running.remaining : running.burstTime;
				const candidateVal = useRemaining
					? candidate.remaining
					: candidate.burstTime;

				if (candidateVal < runningVal) {
					events.push(
						`El proceso ${candidate.name} (${useRemaining ? "restante" : "ráfaga"}: ${candidateVal}ms) desaloja a ${running.name} (${useRemaining ? "restante" : "ráfaga"}: ${runningVal}ms).`,
					);
					readyQueue.push(running);
					running = null;
				}
			}
		}

		// ── 4b. Verificar desalojo por prioridad ──
		if (running && algorithm === "priorities" && readyQueue.length > 0) {
			const candidate = selectNext();
			if (candidate && candidate.priority < running.priority) {
				events.push(
					`El proceso ${candidate.name} (prioridad: ${candidate.priority}) desaloja a ${running.name} (prioridad: ${running.priority}).`,
				);
				readyQueue.push(running);
				running = null;
				quantumUsed = 0;
			}
		}

		// ── 5. Seleccionar proceso si la CPU está libre ──
		if (!running && readyQueue.length > 0) {
			const selected = selectNext()!;
			removeFromQueue(selected);
			running = selected;
			quantumUsed = 0;

			// Generar texto de decisión
			switch (algorithm) {
				case "fcfs":
					decision = `Se asigna la CPU al proceso ${selected.name} (primero en la cola, orden FCFS).`;
					break;
				case "sjf":
				case "sjf-preemptive-burst":
				case "sjf-preemptive-remaining": {
					const useRem = algorithm === "sjf-preemptive-remaining";
					const val = useRem ? selected.remaining : selected.burstTime;
					decision = `Se asigna la CPU al proceso ${selected.name} (${useRem ? "tiempo restante" : "ráfaga"} más corta: ${val}ms).`;
					break;
				}
				case "round-robin":
					decision = `Se asigna la CPU al proceso ${selected.name} (siguiente en la cola, turno rotatorio con q=${quantum}).`;
					break;
				case "priorities":
					decision = `Se asigna la CPU al proceso ${selected.name} (prioridad ${selected.priority}, la más alta en la cola).`;
					break;
			}
		} else if (!running && readyQueue.length === 0) {
			decision = "La CPU está ociosa (no hay procesos en la cola de listos).";
		} else if (running && decision === "") {
			decision = `El proceso ${running.name} continúa ejecutándose (restante: ${running.remaining}ms).`;
		}

		// ── 6. Registrar estado ──
		// Construir snapshot del Gantt para este instante
		for (const p of procs) {
			let cellType: CellType;
			if (!p.arrived) cellType = "not-arrived";
			else if (p.finished) cellType = "finished";
			else if (running && running.name === p.name) cellType = "running";
			else if (readyQueue.includes(p)) cellType = "ready";
			else cellType = "idle";
			ganttData[p.name].push(cellType);
		}

		const queueSnapshot = readyQueue.map((p) => ({
			name: p.name,
			remaining: p.remaining,
			priority: p.priority,
		}));

		steps.push({
			time: t,
			title: `Instante t = ${t}`,
			events,
			decision,
			runningName: running?.name ?? null,
			readyQueue: queueSnapshot,
			gantt: Object.fromEntries(
				Object.entries(ganttData).map(([k, v]) => [k, [...v]]),
			),
			quantumUsed: quantumUsed + 1, // será 1 después de ejecutar
		});

		// ── 7. Ejecutar 1ms ──
		if (running) {
			running.remaining -= 1;
			quantumUsed += 1;
		}

		// Verificar si todos terminaron
		if (procs.every((p) => p.finished)) break;
	}

	// Generar tabla resumen
	const summary: SummaryRow[] = procs.map((p) => {
		const tr = p.finishTime - p.arrivalTime;
		const te = tr - p.burstTime;
		return {
			name: p.name,
			ti: p.arrivalTime,
			tCPU: p.burstTime,
			tf: p.finishTime,
			tr,
			te,
		};
	});

	const tmr = summary.reduce((s, r) => s + r.tr, 0) / summary.length;
	const tme = summary.reduce((s, r) => s + r.te, 0) / summary.length;

	const totalTime = Math.max(...procs.map((p) => p.finishTime));

	return { steps, summary, tmr, tme, totalTime };
}

// ─────────────────────────────────────────────
// COMPONENTE: Tabla de entrada de procesos
// ─────────────────────────────────────────────

function ProcessTable({
	processes,
	setProcesses,
	showPriority,
	disabled,
}: {
	processes: ProcessInput[];
	setProcesses: (p: ProcessInput[]) => void;
	showPriority: boolean;
	disabled: boolean;
}) {
	function addProcess() {
		const names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const usedNames = new Set(processes.map((p) => p.name));
		let newName = "";
		for (const c of names) {
			if (!usedNames.has(c)) {
				newName = c;
				break;
			}
		}
		if (!newName) newName = `P${processes.length + 1}`;

		setProcesses([
			...processes,
			{
				id: crypto.randomUUID(),
				name: newName,
				arrivalTime: 0,
				burstTime: 1,
				priority: 1,
			},
		]);
	}

	function removeProcess(id: string) {
		setProcesses(processes.filter((p) => p.id !== id));
	}

	function updateProcess(id: string, field: keyof ProcessInput, value: string) {
		setProcesses(
			processes.map((p) => {
				if (p.id !== id) return p;
				if (field === "name") return { ...p, name: value };
				const num = parseInt(value) || 0;
				return { ...p, [field]: Math.max(field === "burstTime" ? 1 : 0, num) };
			}),
		);
	}

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-slate-700 text-slate-400">
							<th className="py-2 px-2 text-left font-medium">Proceso</th>
							<th className="py-2 px-2 text-center font-medium">T. Llegada</th>
							<th className="py-2 px-2 text-center font-medium">Ráfaga CPU</th>
							{showPriority && (
								<th className="py-2 px-2 text-center font-medium">Prioridad</th>
							)}
							<th className="py-2 px-1 w-8" />
						</tr>
					</thead>
					<tbody>
						{processes.map((p) => (
							<tr key={p.id} className="border-b border-slate-800">
								<td className="py-1.5 px-2">
									<input
										type="text"
										value={p.name}
										onChange={(e) =>
											updateProcess(p.id, "name", e.target.value)
										}
										disabled={disabled}
										className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-sky-500"
										maxLength={4}
									/>
								</td>
								<td className="py-1.5 px-2 text-center">
									<input
										type="number"
										value={p.arrivalTime}
										onChange={(e) =>
											updateProcess(p.id, "arrivalTime", e.target.value)
										}
										disabled={disabled}
										className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-sky-500"
										min={0}
									/>
								</td>
								<td className="py-1.5 px-2 text-center">
									<input
										type="number"
										value={p.burstTime}
										onChange={(e) =>
											updateProcess(p.id, "burstTime", e.target.value)
										}
										disabled={disabled}
										className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-sky-500"
										min={1}
									/>
								</td>
								{showPriority && (
									<td className="py-1.5 px-2 text-center">
										<input
											type="number"
											value={p.priority}
											onChange={(e) =>
												updateProcess(p.id, "priority", e.target.value)
											}
											disabled={disabled}
											className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-sky-500"
											min={1}
										/>
									</td>
								)}
								<td className="py-1.5 px-1">
									<button
										onClick={() => removeProcess(p.id)}
										disabled={disabled || processes.length <= 1}
										className="p-1 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-30"
									>
										<Trash2 size={14} />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<button
				onClick={addProcess}
				disabled={disabled}
				className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-30"
			>
				<Plus size={14} />
				Agregar proceso
			</button>
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE: Diagrama de Gantt progresivo
// ─────────────────────────────────────────────

const PROCESS_COLORS: Record<string, string> = {
	A: "bg-sky-500",
	B: "bg-emerald-500",
	C: "bg-amber-500",
	D: "bg-purple-500",
	E: "bg-rose-500",
	F: "bg-teal-500",
	G: "bg-orange-500",
	H: "bg-indigo-500",
};

function getProcessColor(name: string): string {
	return PROCESS_COLORS[name] || "bg-slate-500";
}

function GanttChart({
	gantt,
	processNames,
	currentTime,
}: {
	gantt: Record<string, CellType[]>;
	processNames: string[];
	currentTime: number;
}) {
	const totalCols = currentTime + 1;

	return (
		<div className="overflow-x-auto">
			<div className="min-w-fit">
				{/* Header con números de tiempo */}
				<div className="flex">
					<div className="w-12 shrink-0" />
					{Array.from({ length: totalCols }, (_, i) => (
						<div
							key={i}
							className="w-8 shrink-0 text-center text-[10px] text-slate-500 font-mono"
						>
							{i}
						</div>
					))}
				</div>

				{/* Filas por proceso */}
				{processNames.map((name) => (
					<div key={name} className="flex items-center">
						<div className="w-12 shrink-0 text-xs font-mono font-bold text-slate-300 pr-2 text-right">
							{name}
						</div>
						{gantt[name]?.map((cell, i) => {
							let cellClass = "border-slate-800 ";
							switch (cell) {
								case "running":
									cellClass += getProcessColor(name) + " border";
									break;
								case "ready":
									cellClass +=
										"bg-slate-800 border border-dashed border-slate-600";
									break;
								case "finished":
									cellClass += "bg-slate-900/30 border border-slate-900";
									break;
								case "not-arrived":
									cellClass += "bg-transparent border border-slate-900/50";
									break;
								default:
									cellClass += "bg-slate-900 border border-slate-800";
							}
							return (
								<div
									key={i}
									className={`w-8 h-6 shrink-0 ${cellClass} ${i === currentTime ? "ring-1 ring-sky-400/50" : ""}`}
									title={`${name} t=${i}: ${cell === "running" ? "ejecutando" : cell === "ready" ? "en cola de listos" : cell === "finished" ? "finalizado" : cell === "not-arrived" ? "no llegó" : "idle"}`}
								/>
							);
						})}
					</div>
				))}

				{/* Leyenda */}
				<div className="flex gap-4 mt-3 text-[10px] text-slate-500">
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 bg-sky-500 rounded-sm" />
						Ejecutando
					</div>
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 bg-slate-800 border border-dashed border-slate-600 rounded-sm" />
						En cola (espera)
					</div>
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 bg-transparent border border-slate-900/50 rounded-sm" />
						No llegó
					</div>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE: Cola de listos
// ─────────────────────────────────────────────

function ReadyQueueView({
	queue,
	running,
	showPriority,
}: {
	queue: { name: string; remaining: number; priority: number }[];
	running: string | null;
	showPriority: boolean;
}) {
	return (
		<div className="flex items-center gap-2 flex-wrap">
			<span className="text-xs text-slate-500 font-medium">CPU:</span>
			{running ? (
				<span
					className={`text-xs font-mono font-bold px-2 py-1 rounded ${getProcessColor(running)} text-white`}
				>
					{running}
				</span>
			) : (
				<span className="text-xs font-mono text-slate-600 px-2 py-1 rounded bg-slate-800">
					—
				</span>
			)}

			<span className="text-slate-700 mx-1">│</span>

			<span className="text-xs text-slate-500 font-medium">Cola:</span>
			{queue.length === 0 ? (
				<span className="text-xs text-slate-600 italic">vacía</span>
			) : (
				<div className="flex gap-1">
					{queue.map((p, i) => (
						<span
							key={i}
							className="text-xs font-mono bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-300"
							title={`Restante: ${p.remaining}ms${showPriority ? `, Prioridad: ${p.priority}` : ""}`}
						>
							{p.name}
							<span className="text-slate-500 ml-1">
								({p.remaining}ms{showPriority ? `, p${p.priority}` : ""})
							</span>
						</span>
					))}
				</div>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE: Tabla resumen
// ─────────────────────────────────────────────

function SummaryTable({
	summary,
	tmr,
	tme,
}: {
	summary: SummaryRow[];
	tmr: number;
	tme: number;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-lg font-bold">Tabla Resumen</h3>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-slate-700 text-slate-400">
							<th className="py-2 px-2 text-left font-medium">Proceso</th>
							<th className="py-2 px-2 text-center font-medium">
								t<sub>i</sub>
							</th>
							<th className="py-2 px-2 text-center font-medium">
								t<sub>CPU</sub>
							</th>
							<th className="py-2 px-2 text-center font-medium">
								t<sub>f</sub>
							</th>
							<th className="py-2 px-2 text-center font-medium">
								TR = t<sub>f</sub> − t<sub>i</sub>
							</th>
							<th className="py-2 px-2 text-center font-medium">
								TE = TR − t<sub>CPU</sub>
							</th>
						</tr>
					</thead>
					<tbody>
						{summary.map((r) => (
							<tr key={r.name} className="border-b border-slate-800">
								<td className="py-2 px-2 font-mono font-bold">{r.name}</td>
								<td className="py-2 px-2 text-center font-mono">{r.ti}</td>
								<td className="py-2 px-2 text-center font-mono">{r.tCPU}</td>
								<td className="py-2 px-2 text-center font-mono">{r.tf}</td>
								<td className="py-2 px-2 text-center font-mono text-sky-400">
									{r.tr}{" "}
									<span className="text-slate-600 text-xs">
										= {r.tf} − {r.ti}
									</span>
								</td>
								<td className="py-2 px-2 text-center font-mono text-emerald-400">
									{r.te}{" "}
									<span className="text-slate-600 text-xs">
										= {r.tr} − {r.tCPU}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* TMR y TME */}
			<div className="grid grid-cols-2 gap-4">
				<div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-center">
					<span className="text-xs text-sky-300">
						Tiempo Medio de Respuesta
					</span>
					<div className="font-mono text-2xl font-bold text-sky-400 mt-1">
						TMR = {tmr % 1 === 0 ? tmr : tmr.toFixed(2)}ms
					</div>
					<p className="text-[10px] text-slate-500 mt-1">
						({summary.map((r) => r.tr + "ms").join(" + ")}) ÷ {summary.length} ={" "}
						{summary.reduce((s, r) => s + r.tr, 0)} ÷ {summary.length}
					</p>
				</div>
				<div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
					<span className="text-xs text-emerald-300">
						Tiempo Medio de Espera
					</span>
					<div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
						TME = {tme % 1 === 0 ? tme : tme.toFixed(2)}ms
					</div>
					<p className="text-[10px] text-slate-500 mt-1">
						({summary.map((r) => r.te + "ms").join(" + ")}) ÷ {summary.length} ={" "}
						{summary.reduce((s, r) => s + r.te, 0)} ÷ {summary.length}
					</p>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

const DEFAULT_PROCESSES: ProcessInput[] = [
	{ id: "1", name: "A", arrivalTime: 0, burstTime: 3, priority: 1 },
	{ id: "2", name: "B", arrivalTime: 2, burstTime: 6, priority: 3 },
	{ id: "3", name: "C", arrivalTime: 4, burstTime: 4, priority: 1 },
	{ id: "4", name: "D", arrivalTime: 6, burstTime: 5, priority: 2 },
	{ id: "5", name: "E", arrivalTime: 8, burstTime: 2, priority: 3 },
];

export default function PlanificadorCPU() {
	const [processes, setProcesses] = useState<ProcessInput[]>(DEFAULT_PROCESSES);
	const [algorithm, setAlgorithm] = useState<Algorithm>("fcfs");
	const [quantum, setQuantum] = useState(1);
	const [result, setResult] = useState<SimResult | null>(null);
	const [currentStep, setCurrentStep] = useState(0);
	const [error, setError] = useState("");

	const navRef = useRef<HTMLDivElement>(null);

	const isSimulating = result !== null;
	const showPriority = algorithm === "priorities";
	const showQuantum = algorithm === "round-robin" || algorithm === "priorities";

	// Auto-scroll
	useEffect(() => {
		if (isSimulating && navRef.current) {
			navRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [currentStep, isSimulating]);

	// Navegación
	const goNext = useCallback(() => {
		if (!result) return;
		setCurrentStep((s) => Math.min(result.steps.length - 1, s + 1));
	}, [result]);

	const goPrev = useCallback(() => {
		setCurrentStep((s) => Math.max(0, s - 1));
	}, []);

	const goToEnd = useCallback(() => {
		if (!result) return;
		setCurrentStep(result.steps.length - 1);
	}, [result]);

	// Atajos de teclado
	useEffect(() => {
		if (!isSimulating) return;
		function handleKey(e: KeyboardEvent) {
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
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [isSimulating, goNext, goPrev, goToEnd]);

	function handleSimulate() {
		setError("");

		// Validaciones
		if (processes.length === 0) {
			setError("Agregá al menos un proceso.");
			return;
		}

		const names = processes.map((p) => p.name.trim());
		if (names.some((n) => n === "")) {
			setError("Todos los procesos deben tener un nombre.");
			return;
		}
		if (new Set(names).size !== names.length) {
			setError("Los nombres de los procesos deben ser únicos.");
			return;
		}

		const totalBurst = processes.reduce((s, p) => s + p.burstTime, 0);
		if (totalBurst > 200) {
			setError(
				"Para fines didácticos, el total de ráfagas no debe superar 200ms.",
			);
			return;
		}

		if (showQuantum && quantum < 1) {
			setError("El quantum debe ser al menos 1.");
			return;
		}

		const sim = simulate(processes, algorithm, quantum);
		setResult(sim);
		setCurrentStep(0);
	}

	function handleReset() {
		setResult(null);
		setCurrentStep(0);
		setError("");
	}

	const step = result?.steps[currentStep];
	const isLastStep = result ? currentStep === result.steps.length - 1 : false;
	const isFirstStep = currentStep === 0;
	const processNames = processes.map((p) => p.name);

	return (
		<div className="space-y-8 max-w-4xl mx-auto">
			{/* Header */}
			<div className="space-y-2">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
				<h1 className="text-3xl font-bold">Planificador de CPU</h1>
				<p className="text-slate-400">
					Simulá algoritmos de planificación del procesador paso a paso.
					Visualizá el diagrama de Gantt, las decisiones del planificador y
					calculá TMR y TME como en los prácticos.
				</p>
			</div>

			{/* Panel de configuración */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
				{/* Selector de algoritmo */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Algoritmo de planificación
						</label>
						<select
							value={algorithm}
							onChange={(e) => {
								setAlgorithm(e.target.value as Algorithm);
								if (isSimulating) handleReset();
							}}
							disabled={isSimulating}
							className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors text-sm"
						>
							{Object.entries(ALGORITHM_LABELS).map(([k, v]) => (
								<option key={k} value={k}>
									{v}
								</option>
							))}
						</select>
					</div>

					{showQuantum && (
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-2">
								Quantum (ms)
							</label>
							<input
								type="number"
								value={quantum}
								onChange={(e) =>
									setQuantum(Math.max(1, parseInt(e.target.value) || 1))
								}
								disabled={isSimulating}
								className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono focus:outline-none focus:border-sky-500 transition-colors"
								min={1}
							/>
						</div>
					)}
				</div>

				{/* Tabla de procesos */}
				<div>
					<label className="block text-sm font-medium text-slate-300 mb-2">
						Tabla de procesos
					</label>
					<ProcessTable
						processes={processes}
						setProcesses={(p) => {
							setProcesses(p);
							if (isSimulating) handleReset();
						}}
						showPriority={showPriority}
						disabled={isSimulating}
					/>
				</div>

				{/* Error */}
				{error && (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
						{error}
					</p>
				)}

				{/* Botones */}
				<div className="flex gap-3">
					<button
						onClick={handleSimulate}
						disabled={isSimulating}
						className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-medium py-3 px-6 rounded-lg transition-colors"
					>
						<Play size={18} />
						Simular paso a paso
					</button>
					{isSimulating && (
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

			{/* Panel de simulación */}
			{isSimulating && step && result && (
				<div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
					{/* Barra de progreso */}
					<div className="h-1 bg-slate-800">
						<div
							className="h-full bg-sky-500 transition-all duration-300"
							style={{
								width: `${((currentStep + 1) / result.steps.length) * 100}%`,
							}}
						/>
					</div>

					<div className="p-6 space-y-5">
						{/* Header del paso */}
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-1 rounded">
									Paso {currentStep + 1} de {result.steps.length}
								</span>
								<span className="text-xs text-slate-500">
									{ALGORITHM_LABELS[algorithm]}
									{showQuantum && ` (q=${quantum})`}
								</span>
							</div>
							<h2 className="text-xl font-bold">{step.title}</h2>
						</div>

						{/* Eventos */}
						{step.events.length > 0 && (
							<div className="space-y-1">
								{step.events.map((e, i) => (
									<p
										key={i}
										className="text-sm text-amber-300/80 bg-amber-500/5 border-l-2 border-amber-500/30 pl-3 py-1"
									>
										{e}
									</p>
								))}
							</div>
						)}

						{/* Decisión */}
						<p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-4 py-2">
							{step.decision}
						</p>

						{/* Cola de listos */}
						<ReadyQueueView
							queue={step.readyQueue}
							running={step.runningName}
							showPriority={showPriority}
						/>

						{/* Diagrama de Gantt */}
						<div>
							<h3 className="text-sm font-medium text-slate-400 mb-2">
								Diagrama de Gantt
							</h3>
							<GanttChart
								gantt={step.gantt}
								processNames={processNames}
								currentTime={step.time}
							/>
						</div>

						{/* Tabla resumen (solo en el último paso) */}
						{isLastStep && (
							<SummaryTable
								summary={result.summary}
								tmr={result.tmr}
								tme={result.tme}
							/>
						)}

						{/* Navegación */}
						<div
							ref={navRef}
							className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800"
						>
							{/* Siguiente — arriba en móvil, derecha en desktop */}
							<button
								onClick={goNext}
								disabled={isLastStep}
								className="w-full sm:w-auto order-first sm:order-last flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500 text-white"
							>
								Siguiente
								<ArrowRight size={16} />
							</button>

							{/* Dots de progreso — ocultos en móvil, centro en desktop */}
							<div className="hidden sm:flex gap-1.5 flex-wrap justify-center w-auto">
								{result.steps.map((_, i) => (
									<button
										key={i}
										onClick={() => setCurrentStep(i)}
										className={`w-2 h-2 rounded-full transition-all ${
											i === currentStep
												? "bg-sky-500 w-4"
												: i < currentStep
													? "bg-sky-500/40"
													: "bg-slate-700"
										}`}
									/>
								))}
							</div>

							{/* Fila inferior móvil: Anterior (izq) + Resultado (der) */}
							<div className="flex w-full sm:w-auto items-center gap-2 sm:order-first">
								<button
									onClick={goPrev}
									disabled={isFirstStep}
									className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-300"
								>
									<ArrowLeft size={16} />
									Anterior
								</button>

								{!isLastStep && (
									<button
										onClick={goToEnd}
										className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 sm:order-last"
										title="Ir al resultado final"
									>
										<SkipForward size={14} />
										Resultado
									</button>
								)}
							</div>
						</div>

						<div className="flex items-center justify-center gap-2 text-xs text-slate-600 pt-2">
							<Keyboard size={12} />
							<span>
								Usá las flechas ← → del teclado para navegar entre pasos
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
