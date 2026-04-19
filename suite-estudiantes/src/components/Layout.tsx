import { Outlet, Link } from "react-router-dom";
import { BookOpen, Github } from "lucide-react";

export default function Layout() {
	return (
		<div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
			{/* Navbar Minimalista */}
			<nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
					<Link
						to="/"
						className="flex items-center gap-2 hover:opacity-80 transition-opacity"
					>
						<BookOpen className="text-sky-400" />
						<span className="font-bold text-xl tracking-tight">
							Suite Estudiantes <span className="text-sky-500 text-xs">CS</span>
						</span>
					</Link>

					<div className="flex items-center gap-6">
						<Link
							to="/"
							className="text-sm font-medium hover:text-sky-400 transition-colors"
						>
							Herramientas
						</Link>
						<a
							href="https://github.com/JoaquinSasso/MenSso"
							target="_blank"
							rel="noreferrer"
						>
							<Github className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
						</a>
					</div>
				</div>
			</nav>

			{/* Contenido Dinámico */}
			<main className="max-w-7xl mx-auto px-4 py-8">
				<Outlet />
			</main>

			<footer className="border-t border-slate-900 py-8 text-center text-slate-500 text-sm">
				Hecho para la UNSJ con ❤️
			</footer>
		</div>
	);
}
