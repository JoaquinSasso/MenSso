import { Link } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";

export default function EnConstruccion() {
	return (
		<div className="flex flex-col items-center justify-center text-center py-24 space-y-6 animate-in fade-in duration-500">
			<div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
				<Construction size={48} className="text-amber-400" />
			</div>

			<div className="space-y-2">
				<h1 className="text-3xl font-bold">Herramienta en Construcción</h1>
				<p className="text-slate-400 max-w-md">
					Estamos trabajando en esta herramienta. Pronto va a estar disponible
					para que la uses.
				</p>
			</div>

			<Link
				to="/"
				className="flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors text-sm font-medium mt-4"
			>
				<ArrowLeft size={16} />
				Volver al Hub
			</Link>
		</div>
	);
}
