https://nielse02.github.io/madeleinebingo/

# Samen Bingo

Een statische GitHub Pages website met Supabase voor één gedeelde, live bingokaart.

## Wat werkt

- De beheerder vult 24 bingovakken in.
- Het middenvak is altijd `Scheel kijken` en blijft afgevinkt.
- Iedereen met de gedeelde link werkt live op dezelfde kaart.
- Vinkjes synchroniseren via Supabase Realtime.
- De kaartpagina bevat geen link terug naar de beheerpagina.
- Iedere deelnemer kan met de knop `Nieuwe ronde` alle vinkjes wissen voor iedereen.
- De site herkent horizontale, verticale en diagonale bingo.

## Beheerpagina openen

De gewone website-URL opent geen setup meer.

Open de beheerpagina met `?admin=1` achter je GitHub Pages URL.

Voorbeeld:

```text
https://jouwnaam.github.io/samen-bingo/?admin=1
```

Bewaar deze URL als bladwijzer. Na het maken van een kaart verdwijnt `?admin=1` automatisch uit de gedeelde link.

Dit is geen login of wachtwoordbeveiliging. De beheerpagina is alleen niet zichtbaar vanuit de kaart. Iedereen die de beheer-URL kent, kan een kaart maken.

## Supabase bijwerken

1. Open je Supabase project.
2. Open `SQL Editor`.
3. Plak de volledige inhoud van `supabase.sql`.
4. Klik op `Run`.

Je bestaande tabellen en kaarten blijven staan. De databasefuncties worden bijgewerkt.

Nieuwe kaarten krijgen daarna altijd `Scheel kijken` in het midden. Bestaande kaarten veranderen niet automatisch.

## Website bijwerken

Upload deze gewijzigde bestanden opnieuw naar de hoofdmap van je GitHub repository:

- `index.html`
- `app.js`
- `styles.css`
- `supabase.sql`
- `README.md`

Laat je bestaande `config.js` staan. Daar staan jouw Supabase gegevens in.

## Eerste installatie

1. Maak een Supabase project.
2. Voer `supabase.sql` uit in de SQL Editor.
3. Zet Anonymous Sign-Ins aan via Authentication.
4. Vul je Project URL en Publishable key in `config.js` in.
5. Upload alle bestanden naar de hoofdmap van een GitHub repository.
6. Activeer GitHub Pages via branch `main` en map `/(root)`.

Gebruik nooit je service_role key in deze website.

## Nieuwe ronde starten

Iedereen die de gedeelde kaart kan openen, ziet de knop `Nieuwe ronde`. Na bevestiging worden alle vinkjes voor alle deelnemers gewist. Het vaste middenvak `Scheel kijken` blijft afgevinkt.

Gebruik de knop alleen wanneer de groep klaar is voor een nieuwe ronde. De wijziging wordt direct live gesynchroniseerd.
