https://nielse02.github.io/madeleinebingo/

# Samen Bingo

Een statische GitHub Pages website met Supabase voor gedeelde, live bingokaarten.

## Wat werkt

- Maak een kaart met 24 of 25 vakken.
- Bij 24 vakken wordt het midden een vrij vak.
- Deel één geheime link.
- Iedereen met die link werkt live op dezelfde kaart.
- Vinkjes synchroniseren via Supabase Realtime.
- RLS schermt kaarten af voor bezoekers zonder de link.
- De site herkent horizontale, verticale en diagonale bingo.

## 1. Supabase instellen

1. Maak een nieuw Supabase project.
2. Open `SQL Editor`.
3. Plak de volledige inhoud van `supabase.sql` en voer die uit.
4. Ga naar `Authentication`, daarna `Sign In / Providers`.
5. Zet `Allow anonymous sign-ins` aan.
6. Ga naar `Project Settings`, daarna `API`.
7. Kopieer je Project URL en Publishable key. Een oudere anon key werkt ook.
8. Vul beide waarden in `config.js` in.

Gebruik nooit je service_role key in deze website.

## 2. Lokaal testen

Open de map via een lokale webserver. Een directe `file://` URL werkt niet altijd met JavaScript modules.

Met Python:

```bash
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

## 3. Op GitHub Pages zetten

1. Maak een GitHub repository.
2. Upload alle bestanden uit deze map naar de hoofdmap van de repository.
3. Open `Settings`, daarna `Pages`.
4. Kies bij `Source` voor `Deploy from a branch`.
5. Kies branch `main` en map `/(root)`.
6. Sla op en open de gepubliceerde URL.

## Beveiliging

De link bevat een willekeurige geheime token in het URL-fragment na `#`. Dit fragment wordt niet als onderdeel van het normale HTTP-verzoek naar GitHub Pages gestuurd.

Elke bezoeker logt automatisch in als anonieme Supabase gebruiker. De functie `join_bingo_board` koppelt die gebruiker aan de kaart. De RLS regels geven alleen toegang tot gekoppelde kaarten.

Voor een druk bezochte publieke site is het slim om CAPTCHA en passende Auth rate limits in Supabase in te stellen om misbruik van anonieme registraties te beperken.

## Bestanden

- `index.html`, pagina-opbouw.
- `styles.css`, ontwerp en mobiele weergave.
- `app.js`, kaartlogica en live synchronisatie.
- `config.js`, jouw publieke Supabase instellingen.
- `supabase.sql`, tabellen, functies, RLS en Realtime.
