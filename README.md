# JustMadeleine Bingo

Een gedeelde live bingokaart voor GitHub Pages met Supabase.

## Nieuwe startpagina

Iedere bezoeker komt zonder kaartlink eerst op een keuzescherm.

Daar kan iemand:

- een nieuwe bingokaart maken;
- een bestaande bingokaart uit de openbare lijst openen.

Een gedeelde kaartlink opent nog steeds direct de juiste kaart. Op de kaartpagina staat geen knop terug naar het aanmaakscherm.

## Belangrijk over bestaande kaarten

De lijst toont maximaal 100 kaarten, nieuwste eerst. Iedereen die de website opent kan de titel zien en de kaart openen.

Gebruik daarom geen privégegevens in de titel of vakken.

## Wat werkt

- Iedereen kan een kaart maken met 24 eigen vakken.
- Het middenvak is altijd `Scheel kijken` en blijft afgevinkt.
- Iedereen op dezelfde kaart ziet live dezelfde vinkjes.
- Iedere deelnemer kan losse vinkjes aan en uit zetten.
- Iedere deelnemer kan met `Nieuwe ronde` alle vinkjes wissen.
- De site herkent horizontale, verticale en diagonale bingo.
- Het losse B-icoon is verwijderd. De branding bestaat uit het tekstlogo `JustMadeleine Bingo`.

## Update installeren

1. Upload `index.html`, `app.js` en `styles.css` opnieuw naar de hoofdmap van je GitHub repository.
2. Vervang de bestaande bestanden.
3. Laat je bestaande `config.js` staan.
4. Open de SQL Editor in Supabase.
5. Plak de volledige inhoud van `supabase.sql`.
6. Klik op `Run`.

De SQL-update voegt de functie `list_bingo_boards` toe. Zonder deze update kan het keuzescherm bestaande kaarten niet laden.

Bestaande kaarten en vinkjes blijven bewaard.

## Eerste installatie

1. Maak een Supabase project.
2. Voer `supabase.sql` uit in de SQL Editor.
3. Zet Anonymous Sign-Ins aan via Authentication.
4. Vul je Project URL en Publishable key in `config.js` in.
5. Upload alle bestanden naar de hoofdmap van een GitHub repository.
6. Activeer GitHub Pages via branch `main` en map `/(root)`.

Gebruik nooit je service_role key in deze website.
