export default function PageShell({ title, description }) {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-semibold">{title}</h1>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 border-dashed rounded-2xl flex items-center justify-center h-64">
        <p className="text-slate-600 text-sm">Coming soon</p>
      </div>
    </div>
  )
}
