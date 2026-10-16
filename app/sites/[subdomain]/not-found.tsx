export default function SiteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="text-2xl font-semibold">This site doesn’t exist yet</h1>
      <p className="text-zinc-500">The address may be mistyped, or the photographer hasn’t claimed it.</p>
    </div>
  );
}
