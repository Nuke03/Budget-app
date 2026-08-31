import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "./NavBar";

export const metadata: Metadata = {
  title: "Budget",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Budget",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f9d6b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      {/*
        THESIS: il disponibile libero è un traguardo, non un numero da form — la home lo
        celebra con una hero card verde piena, non con una riga di testo.
        OWN-WORLD: verde smeraldo #0f9d6b come colore di fiducia/crescita, card grandi
        arrotondate (24px), icone lucide colorate per categoria, system-ui per sentirsi
        nativi su iPhone (San Francisco), ombre morbide colorate, nessun grigio piatto su
        sfondi colorati.
        STORY: apri l'app, vedi subito quanto puoi spendere in sicurezza; aggiungere una
        spesa è un gesto rapido con un bottom sheet che scorre dal basso, non una pagina.
        FIRST VIEWPORT: hero card verde con disponibile libero e margine giornaliero,
        breakdown pieghevole sotto, FAB circolare in basso a destra, nav flottante con
        icone in basso.
        FORM: ispirazione Cashew (brief-pinned dall'utente), nessun torneo di concept
        eseguito per questo motivo.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the
        finish review, the verdict, DESIGN.md, and every shipping raster carrying its
        provenance.
      */}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 pb-28">{children}</div>
        <NavBar />
      </body>
    </html>
  );
}
