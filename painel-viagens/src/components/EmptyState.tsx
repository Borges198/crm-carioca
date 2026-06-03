import Link from "next/link";

type EmptyStateAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type EmptyStateProps = {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
};

export default function EmptyState({ title, description, actions = [] }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-widest text-blue-700">
          Primeiros passos
        </p>
        <h2 className="mt-3 text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{description}</p>

        {actions.length > 0 && (
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  action.variant === "secondary"
                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
