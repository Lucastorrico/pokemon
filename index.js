const { Client, GatewayIntentBits } = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});


const DB_FILE = "./pokedex.json";

// ==========================
// FUNCIONES DE BASE DE DATOS
// ==========================
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { pokedex: {}, captureCooldown: {}, levelCooldown: {}, tradesPendientes: {} };
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ==========================
// FUNCIONES
// ==========================
async function getRandomPokemon() {
  try {
    let id = Math.floor(Math.random() * 251) + 1; // Solo 1ra gen
    let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    let data = await res.json();
    return {
      name: data.name,
      sprite: data.sprites.front_default,
      nivel: 1
    };
  } catch (err) {
    console.error("Error al obtener Pokémon:", err);
    return null;
  }
}

// ==========================
// EVENTOS
// ==========================
client.on("ready", () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;

  const args = msg.content.slice(1).split(" ");
  const command = args.shift().toLowerCase();

  const { pokedex, captureCooldown, levelCooldown, tradesPendientes } = db;

  // ----------------------
  // !capturar
  // ----------------------
  if (command === "capturar") {
    const userId = msg.author.id;

    if (!captureCooldown[userId]) captureCooldown[userId] = [];
    let now = Date.now();
    captureCooldown[userId] = captureCooldown[userId].filter(t => now - t < 3600000);

    if (captureCooldown[userId].length >= 3) {
      return msg.reply("⌛ Ya capturaste 3 Pokémon esta hora. Espera un poco.");
    }

    let pokemon = await getRandomPokemon();
    if (!pokemon) return msg.reply("❌ Error al intentar capturar Pokémon.");

    if (!pokedex[userId]) pokedex[userId] = [];
    pokedex[userId].push(pokemon);
    captureCooldown[userId].push(now);

    saveDB(db);

    msg.reply({
      content: `🎉 ¡Has capturado a **${pokemon.name.toUpperCase()}**!`,
      files: [pokemon.sprite]
    });
  }

  // ----------------------
  // !pokedex
  // ----------------------
  if (command === "pokedex") {
    const userId = msg.author.id;
    if (!pokedex[userId] || pokedex[userId].length === 0) {
      return msg.reply("📭 Tu Pokédex está vacía.");
    }

    let lista = pokedex[userId]
      .map((p, i) => `#${i + 1} - **${p.name}**`)
      .join("\n");

    msg.reply({ content: `📖 **Tu Pokédex:**\n${lista}` });
  }

  // ----------------------
  // !pokemon <nombre>
  // ----------------------
  if (command === "pokemon") {
    if (args.length < 1) return msg.reply("❌ Usa: `!pokemon pikachu`");

    let nombre = args[0].toLowerCase();
    try {
      let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombre}`);
      let data = await res.json();

      let tipos = data.types.map(t => t.type.name).join(", ");
      let sprite = data.sprites.front_default;

      msg.reply({
        content: `📌 **${data.name.toUpperCase()}**  
🆔 ID: ${data.id}  
⚖️ Peso: ${data.weight}  
📏 Altura: ${data.height}  
✨ Tipos: ${tipos}`,
        files: [sprite]
      });
    } catch {
      msg.reply("❌ Pokémon no encontrado.");
    }
  }

  // ----------------------
  // !tradear
  // ----------------------
  if (command === "tradear") {
    if (args.length < 3) return msg.reply("❌ Usa: `!tradear @usuario tu_numero su_numero`");

    const target = msg.mentions.users.first();
    if (!target) return msg.reply("❌ Debes mencionar a alguien para tradear.");

    const yourNum = parseInt(args[1]) - 1;
    const theirNum = parseInt(args[2]) - 1;

    const userId = msg.author.id;
    const targetId = target.id;

    if (!pokedex[userId] || !pokedex[targetId]) {
      return msg.reply("⚠️ Ambos deben tener Pokémon para tradear.");
    }

    if (!pokedex[userId][yourNum] || !pokedex[targetId][theirNum]) {
      return msg.reply("⚠️ Número inválido en la Pokédex.");
    }

    tradesPendientes[targetId] = { from: userId, yourNum, theirNum };
    saveDB(db);

    msg.reply(`📨 Se ha enviado una solicitud de trade a **${target.username}**.  
👉 ${target}, usa \`!aceptar\` o \`!rechazar\`.`);
  }

  // ----------------------
  // !aceptar
  // ----------------------
  if (command === "aceptar") {
    const userId = msg.author.id;
    const trade = tradesPendientes[userId];
    if (!trade) return msg.reply("⚠️ No tienes ninguna solicitud de trade pendiente.");

    const fromId = trade.from;
    const yourNum = trade.theirNum;
    const theirNum = trade.yourNum;

    const yourPokemon = pokedex[userId][yourNum];
    const theirPokemon = pokedex[fromId][theirNum];

    pokedex[userId][yourNum] = theirPokemon;
    pokedex[fromId][theirNum] = yourPokemon;

    delete tradesPendientes[userId];
    saveDB(db);

    msg.reply(`🤝 ¡Trade exitoso! Intercambiaste tu **${yourPokemon.name}** por el **${theirPokemon.name}** de ${client.users.cache.get(fromId).username}.`);
    
  }

  // ----------------------
  // !rechazar
  // ----------------------
  if (command === "rechazar") {
    const userId = msg.author.id;
    const trade = tradesPendientes[userId];
    if (!trade) return msg.reply("⚠️ No tienes ninguna solicitud de trade pendiente.");

    const fromId = trade.from;
    delete tradesPendientes[userId];
    saveDB(db);

    msg.reply("❌ Has rechazado la solicitud de trade.");
    
  }

  // ----------------------
  // !batalla
  // ----------------------
  if (command === "batalla") {
    const target = msg.mentions.users.first();
    if (!target) return msg.reply("❌ Usa: `!batalla @usuario`");

    const userId = msg.author.id;
    const targetId = target.id;

    if (!pokedex[userId] || pokedex[userId].length === 0) return msg.reply("⚠️ No tienes Pokémon para pelear.");
    if (!pokedex[targetId] || pokedex[targetId].length === 0) return msg.reply("⚠️ El oponente no tiene Pokémon para pelear.");

    const yourPokemon = pokedex[userId][Math.floor(Math.random() * pokedex[userId].length)];
    const theirPokemon = pokedex[targetId][Math.floor(Math.random() * pokedex[targetId].length)];

    const yourPower = yourPokemon.nivel + Math.random() * 5;
    const theirPower = theirPokemon.nivel + Math.random() * 5;
    
    let winner = yourPower > theirPower ? msg.author.username : target.username;
    
    msg.reply({
      content: `⚔️ **${msg.author.username}** lanzó a **${yourPokemon.name}** 
⚔️   **${target.username}** lanzó a **${theirPokemon.name}**  
    
🏆 ¡${winner} ganó la batalla!` 
    

    });
  }

  // ----------------------
  // !ayuda
  // ----------------------
  if (command === "ayuda") {
    msg.reply(`📚 **Comandos disponibles:**
- \`!capturar\` → Captura un Pokémon (máx 3 por hora).
- \`!pokedex\` → Muestra tu lista de Pokémon.
- \`!pokemon <nombre>\` → Muestra info de un Pokémon.
- \`!tradear @usuario num num\` → Envía una solicitud de intercambio.
- \`!aceptar\` → Acepta un intercambio pendiente.
- \`!rechazar\` → Rechaza un intercambio pendiente.
- \`!batalla @usuario\` → Pelea con un jugador.
- \`!ayuda\` → Lista de comandos.`);
  }

  // ----------------------
  // !reset
  // ----------------------
  if (command === "reset") {
    db = { pokedex: {}, captureCooldown: {}, levelCooldown: {}, tradesPendientes: {} };
    saveDB(db);
    msg.reply("♻️ El bot ha sido reseteado. Pokédex, cooldowns y trades borrados.");
  }
});
