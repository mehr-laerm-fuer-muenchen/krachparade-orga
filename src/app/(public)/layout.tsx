import Image from "next/image";

/**
 * Frame of the public pages without login (spec 031): forest header with
 * logo, no navigation, no member, no bell or feedback button.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b-[3px] border-accent bg-header-bg pt-[env(safe-area-inset-top)] text-header-text">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-2 desk:px-6">
          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src="/mlfm-logo.png"
              alt="Mehr Lärm für München"
              width={44}
              height={44}
              priority
              className="size-11 object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-base font-semibold">Krachparade 2027 · Anmeldung</span>
            <span className="truncate text-xs text-header-muted">Mehr Lärm für München</span>
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] desk:px-6">
        {children}
      </main>
    </>
  );
}
