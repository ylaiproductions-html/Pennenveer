import "dotenv/config";
import { Client, GatewayIntentBits, Partials, WebhookClient } from "discord.js";

// ---------- Config ----------
const {
  DISCORD_BOT_TOKEN,
  DISCORD_WEBHOOK_URL,
  TARGET_CHANNEL_ID,
  FANTASIEVEER_AVATAR_URL,
  GROQ_API_KEY,
  GROQ_MODEL,
  HISTORY_LENGTH,
  MODERATOR_USER_ID,
} = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN ontbreekt in .env");
  process.exit(1);
}
if (!DISCORD_WEBHOOK_URL) {
  console.error("❌ DISCORD_WEBHOOK_URL ontbreekt in .env");
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY ontbreekt in .env");
  process.exit(1);
}

const MODEL = GROQ_MODEL || "openai/gpt-oss-120b";

// Aantal vorige gesprek-uitwisselingen (jouw bericht + antwoord van FantasieVeer) dat onthouden wordt, per kanaal.
const MAX_EXCHANGES = parseInt(HISTORY_LENGTH || "3", 10);

// MODERATOR_USER_ID opschonen: alleen cijfers overhouden (voor als iemand per ongeluk
// "<@123...>" of "@gebruikersnaam" in .env plakt in plaats van het kale getal).
// Een geldig Discord user-ID (snowflake) is 17-20 cijfers lang.
const rawModeratorId = (MODERATOR_USER_ID || "").replace(/\D/g, "");
const CLEAN_MODERATOR_ID =
  rawModeratorId.length >= 17 && rawModeratorId.length <= 20 ? rawModeratorId : null;

if (MODERATOR_USER_ID && !CLEAN_MODERATOR_ID) {
  console.warn(
    `⚠️ MODERATOR_USER_ID ("${MODERATOR_USER_ID}") lijkt geen geldig Discord user-ID te zijn (moet 17-20 cijfers zijn, zonder <@ of @). De tag-functie wordt overgeslagen tot dit klopt.`
  );
}

// ---------- Persona: FantasieVeer ----------
// FantasieVeer is de mascotte-AI van FantasieCraft, een Minecraft Bedrock server.
// Geïnspireerd door de Efteling Pennenveer, maar dan in het FantasieCraft-jasje.
const SYSTEM_PROMPT = `
Je bent FantasieVeer, de magische pratende veer en mascotte van FantasieCraft.

Wie/wat is FantasieCraft:
- FantasieCraft is een Minecraft Bedrock server en de hoofdproductie van het team.
- Maker: YlaiProductions | djpardoes
- Co-Owner: Ylai
- Owner: Tijn

Jouw persoonlijkheid:
- Je bent vrolijk, speels, een beetje sprookjesachtig en behulpzaam, zoals de Pennenveer van de Efteling — maar jouw wereld is FantasieCraft in plaats van het sprookjesbos.
- Je praat in het Nederlands, kort en luchtig (meestal 1-3 zinnetjes), met af en toe een vleugje magie of Minecraft-thema (blokken, avonturen, mobs, bouwwerken, redstone, enz.).
- Je reageert altijd direct en persoonlijk op wat iemand typt, alsof je echt meeluistert in de chat.
- Je hebt toegang tot de laatste paar berichten van het gesprek (hierboven als geschiedenis meegegeven). Gebruik die context om op het onderwerp te blijven en logisch door te pakken op wat er net gezegd is, in plaats van elk bericht helemaal los te behandelen.
- Je bent trots op FantasieCraft en verwijst er af en toe positief naar, zonder overdreven reclame te maken.
- Als iemand vraagt wie de maker/eigenaar is, noem je de juiste namen: Owner is Tijn, Co-Owner is Ylai, en de maker is YlaiProductions | djpardoes.
- Je verzint geen serverregels, prijzen, IP-adressen of technische details die je niet weet — als je het niet zeker weet, zeg je speels dat de gebruiker dat het beste aan het team kan vragen.
- Gebruik geen grove taal en wees altijd vriendelijk, ook als iemand plaagt of onzin typt.
- Houd antwoorden kort (max ~2-3 zinnen), dit is een chatbot, geen essay.
- Begin je antwoord NIET zelf met de gebruikersnaam of een @mention — dat wordt automatisch door het systeem toegevoegd.
- Je mag af en toe een emoji gebruiken, maar niet te veel. Gebruik ze spaarzaam en passend bij de toon van je antwoord. Deze is de beste "✨"
- Wat is FantasieCraft? FantasieCraft is de hele Efteling in Minecraft Bedrock! Je kan het alleen bezoeken; behalve als je er werkt. Je kan soliciteren via: https://www.fantasiecraft.nl/solliciteren_1
- dit is onze website: https://www.fantasiecraft.nl
- Bouwen in de wereld: spelers kunnen FantasieCraft alleen bezoeken en zelf NIET bouwen. Alleen spelers met de rol Owner, Co-Owner of Bouwer mogen bouwen. Als iemand vraagt of ze mogen bouwen, leg dit duidelijk uit.
- Je mag alleen over FantasieCraft praten, niet over andere servers of games. Als iemand erover begint, zeg je vriendelijk dat je alleen FantasieCraft kent en dat ze het beste op de website van die andere server kunnen kijken.
- Als iemand scheldt of grof is: zeg vriendelijk maar duidelijk dat we dat hier niet tolereren, en zet EXACT dit blokje aan het einde van je bericht: [TAG_MAKER] (dit wordt automatisch door het systeem vervangen door een echte tag van de maker — typ dit blokje zelf niet uit met andere tekst eromheen).
`.trim();

// ---------- Gespreksgeheugen per kanaal ----------
// In-memory geschiedenis: bij herstart van de bot begint het geheugen weer leeg.
const channelHistories = new Map(); // channelId -> [{ role, content }, ...]

function getHistory(channelId) {
  if (!channelHistories.has(channelId)) channelHistories.set(channelId, []);
  return channelHistories.get(channelId);
}

function addToHistory(channelId, role, content) {
  const history = getHistory(channelId);
  history.push({ role, content });
  // 1 uitwisseling = 1 user-bericht + 1 assistant-antwoord = 2 entries
  const maxEntries = MAX_EXCHANGES * 2;
  while (history.length > maxEntries) history.shift();
}

// ---------- Groq call ----------
async function askFantasieVeer(channelId, username, userMessage) {
  const history = getHistory(channelId);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `${username}: ${userMessage}` },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API fout (${res.status}): ${text}`);
  }

  const data = await res.json();
  let reply =
    data?.choices?.[0]?.message?.content?.trim() ||
    "Hmm, mijn magische veerkracht laat me even in de steek... probeer het nog eens! ✨";

  // De placeholder vervangen we hier in code door een echte Discord-mention.
  // (LLM's typen numerieke Discord ID's niet altijd 100% foutloos over, en schrijven de
  // placeholder soms net iets anders — bv. "<tag_maker>" i.p.v. "[TAG_MAKER]". Deze regex
  // vangt alle redelijke schrijfwijzen op: haakjes [ ] of < >, hoofdletters, spatie/streepje.)
  const tagMakerPattern = /[<\[]\s*tag[_\s-]?maker\s*[>\]]/gi;
  if (tagMakerPattern.test(reply)) {
    const moderatorMention = CLEAN_MODERATOR_ID ? `<@${CLEAN_MODERATOR_ID}>` : "de maker";
    reply = reply.replace(/[<\[]\s*tag[_\s-]?maker\s*[>\]]/gi, moderatorMention).trim();
  }

  // Bewaar deze uitwisseling in het geheugen van dit kanaal
  addToHistory(channelId, "user", `${username}: ${userMessage}`);
  addToHistory(channelId, "assistant", reply);

  return reply;
}

// ---------- Vast startbericht (geen AI, geen tag) ----------
const START_MESSAGE = `🪶 Hoi allemaal! Ik ben **FantasieVeer**, de magische veer van **FantasieCraft**! ✨

Dit kan je in deze chat doen:
• Typ gewoon een bericht — ik reageer automatisch op alles, je hoeft me nergens voor aan te roepen
• Stel me vragen over FantasieCraft: wat het is, hoe je kan solliciteren, wie het team is, enz.
• Ik onthoud de laatste paar berichten, dus het gesprek mag gewoon doorlopen
• Alleen spelers met de rol Owner, Co-Owner of Bouwer mogen bouwen in de wereld — de rest kan lekker rondkijken

Blijf vriendelijk tegen elkaar, dan wordt het hier alleen maar magischer! ✨`;

// ---------- Discord bot ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const webhookClient = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

client.once("clientReady", () => {
  console.log(`✅ Ingelogd als ${client.user.tag}`);
  console.log(`🪶 FantasieVeer luistert met model: ${MODEL}`);
  console.log(`🧠 Onthoudt de laatste ${MAX_EXCHANGES} uitwisselingen per kanaal`);
  console.log(
    CLEAN_MODERATOR_ID
      ? `🏷️  Tag-functie actief voor user-ID: ${CLEAN_MODERATOR_ID}`
      : "🏷️  Tag-functie NIET actief (MODERATOR_USER_ID niet of ongeldig ingesteld)"
  );
  if (TARGET_CHANNEL_ID) {
    console.log(`📌 Reageert alleen in kanaal: ${TARGET_CHANNEL_ID}`);
  } else {
    console.log("📌 Reageert in alle kanalen die de bot kan zien.");
  }
});

client.on("messageCreate", async (message) => {
  // Negeer berichten van bots/webhooks (voorkomt oneindige lussen, ook met zichzelf)
  if (message.author.bot || message.webhookId) return;

  // Optioneel: alleen in één specifiek kanaal reageren
  if (TARGET_CHANNEL_ID && message.channelId !== TARGET_CHANNEL_ID) return;

  // Geen lege berichten (bv. alleen een bijlage)
  if (!message.content || !message.content.trim()) return;

  console.log(`💬 ${message.author.username} in ${message.channelId}: "${message.content}"`);

  // Vast commando: !startbericht -> uitleg wat je hier kan doen, ZONDER de gebruiker te taggen
  if (message.content.trim().toLowerCase() === "!startbericht") {
    try {
      await webhookClient.send({
        content: START_MESSAGE,
        username: "FantasieVeer",
        avatarURL: FANTASIEVEER_AVATAR_URL || undefined,
        threadId: message.channel.isThread() ? message.channel.id : undefined,
        allowedMentions: { users: [] }, // expliciet: geen tags bij dit bericht
      });
      console.log("✅ Startbericht verstuurd (geen tag).");
    } catch (err) {
      console.error("❌ Fout bij het versturen van het startbericht:", err.message);
      if (err.rawError) {
        console.error("   Details van Discord:", JSON.stringify(err.rawError, null, 2));
      }
    }
    return;
  }

  await message.channel.sendTyping().catch(() => {});

  let reply;
  try {
    reply = await askFantasieVeer(message.channelId, message.author.username, message.content);
  } catch (err) {
    console.error("❌ Fout bij het aanroepen van Groq:", err.message);
    return;
  }

  try {
    const pingedUsers = [...new Set([message.author.id, ...(CLEAN_MODERATOR_ID && reply.includes(`<@${CLEAN_MODERATOR_ID}>`) ? [CLEAN_MODERATOR_ID] : [])])];
    console.log("👥 Ping-lijst voor dit bericht:", pingedUsers);

    await webhookClient.send({
      content: `<@${message.author.id}> ${reply}`,
      username: "FantasieVeer",
      avatarURL: FANTASIEVEER_AVATAR_URL || undefined,
      threadId: message.channel.isThread() ? message.channel.id : undefined,
      allowedMentions: { users: pingedUsers },
    });
    console.log("✅ Antwoord verstuurd via webhook.");
  } catch (err) {
    console.error("❌ Fout bij het versturen via de webhook:", err.message);
    if (err.rawError) {
      console.error("   Details van Discord:", JSON.stringify(err.rawError, null, 2));
    }
  }
});

client.login(DISCORD_BOT_TOKEN);