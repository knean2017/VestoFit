/** Split layout for sign-in flows: photo panel on wide screens, form column beside it. */
export default function AuthShell({
  image,
  alt,
  tone = "bg-lilac",
  children,
}: {
  image: string;
  alt: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-1 container-app w-full py-6 md:py-10 grid gap-8 md:grid-cols-2 md:items-stretch">
      <div className={"relative hidden md:block rounded-[28px] overflow-hidden min-h-[560px] " + tone}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/35 to-transparent" />
        <p className="absolute left-8 bottom-7 display text-[44px] leading-none text-white">VestoFit</p>
      </div>
      <div className="grid place-items-center py-6">
        <div className="w-full max-w-sm animate-rise">{children}</div>
      </div>
    </section>
  );
}
