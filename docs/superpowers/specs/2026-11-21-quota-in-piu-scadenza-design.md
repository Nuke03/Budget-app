# Un po' di più per la scadenza (P13)

Data: 21 novembre 2026. Stato: approvata da Fabio il 21 novembre 2026. Design breve (piccola modifica).

## Perché

Gli acconti delle tasse di Miriam si calcolano sull'anno prima, quindi una scadenza F24 può essere più alta di quanto c'è nel vaso (il conto tasse). Oggi l'app se ne accorge e dice solo "Mancano X €: spostali sul conto tasse prima della scadenza", quando il buco c'è già. P13 previene: appena l'app vede che il vaso non basterà, la proposta dopo i prossimi incassi chiede un po' di più, così il buco si chiude a poco a poco. Fabio: "bell'aggiunta".

## Cosa fa

Dopo un incasso, la domanda della quota (`PromptQuota`, sia dal foglio dell'aggiunta sia dalla pagina P.IVA) propone già la cifra con il pezzo in più dentro (scelta di Fabio, approccio "a"):

```
   450 €
   da mettere da parte sul conto tasse (su 1.500 € incassati)
   300 € di quota e 150 € per la scadenza del 30 giugno.   Perché?
   [ cifra modificabile come oggi ]   Fatto, li ho spostati · Più tardi
```

"Perché?" apre la spiegazione che c'è già (`PercheScadenza`: gli acconti guardano l'anno prima). Senza buco previsto, tutto resta come oggi.

## Quanto in più (approccio 1, scelto da Fabio)

- **La scadenza da coprire:** la prima scadenza non pagata e non nascosta, con una cifra, per cui il confronto cumulativo (`confrontoCumulativo`) dice che non basta.
- **Quanto manca:** totale cumulativo fino a quella scadenza meno (saldo del vaso + quote già proposte e non ancora spostate, compresa la quota base di questo incasso). Mai sotto zero. Se è 0, niente in più. *(Scelta di Claude: le quote in sospeso finiranno nel vaso, contarle evita di chiedere due volte gli stessi soldi.)*
- **Mesi che restano:** i mesi di calendario dal mese corrente al mese della scadenza, compresi entrambi (minimo 1).
- **Incassi attesi:** la media mensile degli incassi netti (`finestraIncassi`, la stessa dello stipendio fisso) per i mesi che restano.
- **Il pezzo in più:** `arrotonda all'euro(incasso × quanto manca / incassi attesi)`, senza superare quanto manca.
- **Tetto:** quota base + pezzo in più non superano la metà dell'incasso. *(Scelta di Claude: il mese di Miriam resta vivibile.)*
- **Senza storia degli incassi** (nessun mese con incassi, o media 0): il pezzo in più è quanto manca, fino allo stesso tetto della metà dell'incasso.

## Cosa non cambia

- La percentuale delle impostazioni resta quella: il pezzo in più è temporaneo, vale finché il buco c'è.
- Il riservato del disponibile (le quote in sospeso) resta la quota base: il pezzo in più conta solo quando Miriam lo sposta davvero.
- Se arrivati alla scadenza manca ancora qualcosa, resta la frase di oggi nella pagina P.IVA.
- Niente consigli fiscali: la cifra della scadenza è quella che Miriam scrive dall'F24 della commercialista; l'app aiuta solo a metterla da parte in tempo.

## Approcci considerati

- **1. In proporzione agli incassi attesi prima della scadenza** — scelto da Fabio: il peso è distribuito e segue gli incassi veri.
- 2. Percentuale fissa in più finché il buco non è coperto — scartato: non guarda quanto tempo manca.
- 3. Tutto dal prossimo incasso, fino a un tetto — scartato come regola, resta solo quando non c'è storia degli incassi.

## Lasciato a chi costruisce

- Una funzione pura condivisa (per esempio in `src/lib/calculations/pivaScadenze.ts`) usata da Home e pagina P.IVA, con test sui numeri di esempio (mancano 300 €, 3 mesi, media 1.000 €, incasso 1.000 € → 100 €; tetto; senza storia).
- Come i dati (scadenze, saldo del vaso, quote in sospeso, media incassi) arrivano al foglio dell'aggiunta dalla Home.
- Testi definitivi: senza "devi", senza colpa, data della scadenza per esteso.
