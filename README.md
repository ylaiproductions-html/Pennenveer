# 🪶 FantasieVeer — AI-mascotte bot voor FantasieCraft

Reageert op elk bericht in de chat (net als de Efteling Pennenveer), tagt de gebruiker,
en antwoordt als "FantasieVeer" — de mascotte van de Minecraft Bedrock server **FantasieCraft**.

## Belangrijk om te weten

Een **webhook** kan alleen berichten *versturen*, geen berichten *lezen*. Om op elk bericht
te reageren heb je daarom een echte **Discord bot** nodig (met een bot-token). Deze bot leest
de berichten, vraagt Groq om een antwoord, en verstuurt dat antwoord vervolgens via jouw
webhook — zo verschijnt het antwoord met de naam en avatar "FantasieVeer" in plaats van de
standaard botnaam.

## Stap 1 — Discord bot aanmaken

1. Ga naar https://discord.com/developers/applications
2. **New Application** → geef een naam (bv. `FantasieVeer`)
3. Ga naar **Bot** in het menu links
   - Klik **Reset Token** en kopieer de token (dit is je `DISCORD_BOT_TOKEN`)
   - Zet onder **Privileged Gateway Intents** de optie **MESSAGE CONTENT INTENT** aan ✅ (anders kan de bot de inhoud van berichten niet lezen)
4. Ga naar **OAuth2 → URL Generator**
   - Scopes: vink `bot` aan
   - Bot Permissions: minimaal `Send Messages`, `Read Message History`, `View Channels`, `Use External Emojis`
   - Kopieer de gegenereerde URL, open die in je browser en nodig de bot uit op je FantasieCraft server

## Stap 2 — .env invullen

Kopieer `.env.example` naar `.env` en vul in:

```
DISCORD_BOT_TOKEN=...      # uit stap 1
DISCORD_WEBHOOK_URL=...    # jouw bestaande webhook-URL
TARGET_CHANNEL_ID=...      # (optioneel) alleen reageren in 1 specifiek kanaal
FANTASIEVEER_AVATAR_URL=...# (optioneel) profielfoto voor FantasieVeer
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
```

Kanaal-ID ophalen: zet **Developer Mode** aan in Discord (Instellingen → Geavanceerd),
rechtsklik daarna op het kanaal → **Kopieer kanaal-ID**.

## Stap 3 — Installeren en starten

```bash
npm install
npm start
```

Als alles goed gaat zie je in de terminal:

```
✅ Ingelogd als FantasieVeer#0000
🪶 FantasieVeer luistert met model: openai/gpt-oss-120b
```

Typ nu iets in het kanaal — FantasieVeer reageert en tagt je automatisch.

## De persona aanpassen

Alle karaktereigenschappen van FantasieVeer (toon, lore, namen van maker/eigenaren) staan
in de `SYSTEM_PROMPT` bovenin `index.js`. Pas dat tekstblok aan om het karakter, de regels
of de toon verder te verfijnen.

## Hosten (zodat hij 24/7 online blijft)

Dit script moet continu draaien om berichten te kunnen lezen — het is dus geen losse webhook-call.
Opties om 24/7 te draaien:
- Een VPS (bv. via een Node.js hosting provider) met `pm2` of `systemd` om het script te herstarten bij een crash
- Een gratis/betaalbare Discord-bot hosting dienst die Node.js-projecten ondersteunt

## Veiligheidstip

Je hebt je webhook-URL en Groq API key eerder gedeeld in de chat met mij. Dat is op zich geen
ramp, maar omdat die gegevens dan wel ergens in een gespreksgeschiedenis staan, is het verstandig
om op termijn:
- een **nieuwe webhook** aan te maken in je kanaalinstellingen (Bewerken kanaal → Integraties → Webhooks) en de oude te verwijderen
- je **Groq API key** te vervangen via https://console.groq.com/keys

Zet nooit je `.env` bestand online (bv. niet meesturen naar GitHub) — die staat voor jou al
in `.gitignore` als je git gebruikt.
