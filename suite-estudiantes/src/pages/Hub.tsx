import { Link } from "react-router-dom";
import {
    Network,
    Database,
    Cpu,
    Binary,
    Code2,
    ChevronRight,
    Hash,
    Calculator,
    Camera,
    ListOrdered,
    BoxSelect,
	Layers,
	FileText,
} from "lucide-react";

interface ToolCard {
    title: string;
    description: string;
    icon: React.ElementType;
    path: string;
    category: string;
    color: string;
}

const tools: ToolCard[] = [
    {
        title: "Viaje de un Click",
        description: "Visualiza el recorrido de una consulta web a través de todas las capas del modelo TCP/IP.",
        icon: Network,
        path: "/redes/click",
        category: "Redes de Datos",
        color: "text-sky-400",
    },
    {
        title: "Subneteo IPv4",
        description: "Calculá subredes, máscaras, direcciones de broadcast y rangos de hosts con explicaciones.",
        icon: Calculator,
        path: "/redes/subneteo",
        category: "Redes de Datos",
        color: "text-indigo-400",
    },
    {
        title: "Modelo E/R a SQL",
        description: "Diseña tu diagrama Entidad-Relación y genera automáticamente el código SQL.",
        icon: Database,
        path: "/db/er-sql",
        category: "Bases de Datos",
        color: "text-emerald-400",
    },
    {
        title: "Planificador de CPU",
        description: "Simula algoritmos de planificación (FIFO, Round Robin, SRTF) con diagramas de Gantt.",
        icon: Cpu,
        path: "/so/planificador",
        category: "Sistemas Operativos",
        color: "text-purple-400",
    },
    {
        title: "Simulador de Autómatas",
        description: "Crea Autómatas Finitos y verifica si una palabra es aceptada paso a paso.",
        icon: Binary,
        path: "/automatas/simulador",
        category: "Teoría de la Computación",
        color: "text-amber-400",
    },
    {
        title: "Conversor de Bases",
        description: "Convertí entre binario, decimal y hexadecimal viendo el proceso completo.",
        icon: Hash,
        path: "/efc/conversor-bases",
        category: "Estructuras y Func. de Computadoras",
        color: "text-rose-400",
    },
    {
        title: "Compilador",
        description: "Simula el proceso de compilación de un programa fuente a código objeto.",
        icon: Camera,
        path: "/AyRP/compilador",
        category: "Algoritmos y Resolución de Problemas",
        color: "text-violet-400",
    },
    {
        title: "Simulador de Arreglos",
        description: "Visualizá búsquedas y ordenamientos paso a paso con pseudocódigo resaltado.",
        icon: ListOrdered,
        path: "/ayrp/simulador-arreglos",
        category: "Algoritmos y Res. de Problemas",
        color: "text-teal-400",
    },
    {
        title: "Diagrama de Clases UML",
        description: "Diseñá diagramas UML y obtené el código Python generado automáticamente.",
        icon: BoxSelect,
        path: "/poo/diagrama-clases",
        category: "Programación Orientada a Objetos",
        color: "text-indigo-400",
    },
    {
        title: "Simulador de Estructuras",
        description: "Explora visualmente Pilas, Colas, Listas, Hashing, Grafos y Árboles en tiempo real.",
        icon: Layers,
        path: "/EDA/simuladorEDA",
        category: "Estructuras de Datos y Algoritmos",
        color: "text-orange-400",
    },
    {
        title: "DocuGen AI",
        description: "Asistente de redacción institucional que genera notas formales (prórrogas, mesas especiales) guiado por IA.",
        icon: FileText,
        path: "/docugen",
        category: "Inteligencia Artificial",
        color: "text-cyan-400",
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
                    Una suite de herramientas interactivas diseñadas por y para estudiantes de la UNSJ.
                </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                    <Link
                        key={tool.path}
                        to={tool.path}
                        className="group relative p-6 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-sky-500/50 hover:bg-slate-800/50 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-500/10 blur-3xl group-hover:bg-sky-500/20 transition-colors" />
                        <div className="space-y-4">
                            <div className={`p-3 rounded-lg bg-slate-950 w-fit ${tool.color}`}>
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
                            <p className="text-slate-400 text-sm leading-relaxed">{tool.description}</p>
                            <div className="flex items-center text-sky-500 text-sm font-medium pt-2">
                                Probar herramienta
                                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </Link>
                ))}

                <div className="p-6 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 opacity-60">
                    <Code2 size={32} className="text-slate-600" />
                    <h3 className="font-bold text-slate-400 text-lg">¿Tienes una idea?</h3>
                    <p className="text-slate-500 text-sm">Suma tu herramienta al proyecto</p>
                </div>
            </div>
        </div>
    );
}