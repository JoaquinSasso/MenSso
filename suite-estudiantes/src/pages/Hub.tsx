import { Link } from "react-router-dom";
import {
	Cpu,
	Code2,
	ChevronRight,
	Hash,
	Calculator,
	Camera,
	ListOrdered,
	BoxSelect,
	FileText,
} from "lucide-react";

interface ToolCard {
	title: string;
	description: string;
	icon: React.ElementType;
	path: string;
	category: string;
	color: string;
	featured?: boolean;
}

const tools: ToolCard[] = [
	{
		title: "DocuGen AI",
		description:
			"Asistente de redacción institucional que genera notas formales (prórrogas, mesas especiales) guiado por IA.",
		icon: FileText,
		path: "/docugen",
		category: "Inteligencia Artificial",
		color: "text-cyan-400",
		featured: true,
	},
	{
		title: "Subneteo IPv4",
		description:
			"Calculá subredes, máscaras, direcciones de broadcast y rangos de hosts con explicaciones.",
		icon: Calculator,
		path: "/redes/subneteo",
		category: "Redes de Datos",
		color: "text-indigo-400",
	},
	{
		title: "Planificador de CPU",
		description:
			"Simula algoritmos de planificación (FIFO, Round Robin, SRTF) con diagramas de Gantt.",
		icon: Cpu,
		path: "/so/planificador",
		category: "Sistemas Operativos",
		color: "text-purple-400",
	},
	{
		title: "Conversor de Bases",
		description:
			"Convertí entre binario, decimal y hexadecimal viendo el proceso completo.",
		icon: Hash,
		path: "/efc/conversor-bases",
		category: "Estructuras y Func. de Computadoras",
		color: "text-rose-400",
	},
	{
		title: "Compilador",
		description:
			"Simula el proceso de compilación de un programa fuente a código objeto.",
		icon: Camera,
		path: "/AyRP/compilador",
		category: "Algoritmos y Resolución de Problemas",
		color: "text-violet-400",
	},
	{
		title: "Simulador de Arreglos",
		description:
			"Visualizá búsquedas y ordenamientos paso a paso con pseudocódigo resaltado.",
		icon: ListOrdered,
		path: "/ayrp/simulador-arreglos",
		category: "Algoritmos y Res. de Problemas",
		color: "text-teal-400",
	},
	{
		title: "Diagrama de Clases UML",
		description:
			"Diseñá diagramas UML y obtené el código Python generado automáticamente.",
		icon: BoxSelect,
		path: "/poo/diagrama-clases",
		category: "Programación Orientada a Objetos",
		color: "text-indigo-400",
	},
];

export default function Hub() {
	return (
		<div className="space-y-12 animate-in fade-in duration-700">
			<section className="text-center space-y-4">
				<h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
					Tu compañero de <span className="text-sky-500">Carrera</span>
				</h1>
				<p className="text-slate-400 text-lg max-w-2xl mx-auto">
					Una suite de herramientas interactivas diseñadas por y para
					estudiantes de la UNSJ.
				</p>
			</section>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{tools.map((tool) => (
					<Link
						key={tool.path}
						to={tool.path}
						className={`group relative p-6 border rounded-2xl transition-all duration-300 overflow-hidden ${
							tool.featured
								? "bg-gradient-to-br from-cyan-950/40 to-slate-900/50 border-cyan-500/50 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] md:col-span-2 lg:col-span-2"
								: "bg-slate-900/50 border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/50"
						}`}
					>
						<div
							className={`absolute -right-4 -top-4 w-32 h-32 blur-3xl transition-colors ${tool.featured ? "bg-cyan-500/20 group-hover:bg-cyan-500/40" : "bg-sky-500/10 group-hover:bg-sky-500/20"}`}
						/>

						{tool.featured && (
							<div className="absolute top-4 right-4 px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)] backdrop-blur-md flex items-center gap-1 z-10 animate-pulse">
								✨ Destacado
							</div>
						)}

						<div className="space-y-4 relative z-10">
							<div
								className={`p-3 rounded-lg bg-slate-950 w-fit ${tool.color}`}
							>
								<tool.icon size={28} />
							</div>
							<div>
								<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
									{tool.category}
								</span>
								<h3 className="text-xl font-bold mt-1 group-hover:text-sky-400 transition-colors">
									{tool.title}
								</h3>
							</div>
							<p className="text-slate-400 text-sm leading-relaxed z-10 relative">
								{tool.description}
							</p>
							<div className="flex items-center text-sky-500 text-sm font-medium pt-2 z-10 relative">
								Probar herramienta
								<ChevronRight
									size={16}
									className="ml-1 group-hover:translate-x-1 transition-transform"
								/>
							</div>
						</div>
					</Link>
				))}

				<div className="p-6 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
					<Code2 size={32} className="text-slate-600" />
					<h3 className="font-bold text-slate-400 text-lg">
						¿Tienes una idea?
					</h3>
					<p className="text-slate-500 text-sm">
						Suma tu herramienta al proyecto
					</p>
					<a
						href="https://github.com/JoaquinSasso/MenSso"
						target="_blank"
						className="text-sky-500 font-medium hover:underline"
					>
						Contribuir en GitHub
					</a>
				</div>
			</div>
		</div>
	);
}
