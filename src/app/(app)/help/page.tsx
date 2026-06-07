"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import { helpFaqForModules, helpLinksForModules, helpWelcomeLine } from "@/lib/help-content";

export default function HelpPage() {
  const store = localStore.get();
  const { modules } = useModule(store?.id);
  const links = helpLinksForModules(modules);
  const faq = helpFaqForModules(modules);

  return (
    <>
      <AppHeader title="Centre d'aide" />
      <main className="app-page space-y-4 pb-6">
        <p className="text-sm text-gray-600">{helpWelcomeLine(modules)}</p>

        <section className="app-card p-4">
          <h2 className="text-sm font-semibold">Liens utiles</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          {faq.map((item) => (
            <article key={item.q} className="app-card p-3">
              <p className="text-sm font-medium">{item.q}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.a}</p>
            </article>
          ))}
        </section>

        <Button asChild className="w-full" variant="outline">
          <a href="https://wa.me/" target="_blank" rel="noreferrer">
            Contacter le support WhatsApp
          </a>
        </Button>
      </main>
    </>
  );
}
