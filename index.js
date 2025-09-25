const { Client, GatewayIntentBits } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
let db = new sqlite3.Database("./pokemon.db");
db.run(`CREATE TABLE IF NOT EXISTS players (
  user_id TEXT,
  pokemon TEXT,
  level INTEGER,
  PRIMARY KEY (user_id, pokemon)
)`);

client.once("ready", () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // !start -> empezar aventura
  if (msg.content === "!start") {
    msg.reply("🎉 ¡Has comenzado tu aventura Pokémon! Usa `!capturar` para atrapar uno.");
  }

  // !pokemon <nombre/id> -> buscar en la API
  if (msg.content.startsWith("!pokemon")) {
    let args = msg.content.split(" ");
    if (args.length < 2) {
      msg.reply("❌ Usa: `!pokemon pikachu`");
      return;
    }

    let nombre = args[1].toLowerCase();

    try {
      let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombre}`);
      let data = await res.json();

      let tipos = data.types.map(t => t.type.name).join(", ");
      let sprite = data.sprites.front_default;

      msg.reply({
        content: `📌 **${data.name.toUpperCase()}**  
      ID: ${data.id}  
      Tipos: ${tipos}  
      Peso: ${data.weight}  
      Altura: ${data.height}`,
        files: [sprite]
      });
    } catch (err) {
      msg.reply("❌ Pokémon no encontrado.");
    }
  }

  // !randompokemon -> da un Pokémon aleatorio real
  if (msg.content === "!randompokemon") {
    let id = Math.floor(Math.random() * 898) + 1; // hasta Galar
    try {
      let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      let data = await res.json();

      let tipos = data.types.map(t => t.type.name).join(", ");
      let sprite = data.sprites.front_default;

      msg.reply({
        content: `🎲 ¡Te tocó **${data.name.toUpperCase()}**!  
      Tipos: ${tipos}`,
        files: [sprite]
      });
    } catch (err) {
      msg.reply("❌ Error al obtener Pokémon aleatorio.");
    }
  }

  // !capturar -> intentar atrapar un Pokémon aleatorio
  if (msg.content === "!capturar") {
    let id = Math.floor(Math.random() * 898) + 1;
    try {
      let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      let data = await res.json();

      let nombre = data.name;
      let sprite = data.sprites.front_default;

      if (Math.random() > 0.4) { // 60% de probabilidad de capturarlo
        db.run(
          `INSERT OR REPLACE INTO players (user_id, pokemon, level) VALUES (?, ?, ?)`,
          [msg.author.id, nombre, 1]
        );
        msg.reply({
          content: `🎉 ¡Capturaste a **${nombre.toUpperCase()}**!`,
          files: [sprite]
        });
      } else {
        msg.reply(`💨 El **${nombre.toUpperCase()}** escapó... 😢`);
      }
    } catch (err) {
      msg.reply("❌ Error al intentar capturar Pokémon.");
    }
  }

  // !mipokedex -> ver tus capturas
  if (msg.content === "!mipokedex") {
    db.all(`SELECT * FROM players WHERE user_id = ?`, [msg.author.id], (err, rows) => {
      if (!rows || rows.length === 0) {
        msg.reply("📭 Tu Pokédex está vacío. Usa `!capturar` para empezar.");
      } else {
        let lista = rows.map(r => `${r.pokemon} (Lvl ${r.level})`).join("\n");
        msg.reply(`📖 Tu Pokédex:\n${lista}`);
      }
    });
  }

  // !subir -> sube de nivel un Pokémon al azar de tu Pokédex
  if (msg.content === "!subir") {
    db.get(`SELECT * FROM players WHERE user_id = ? ORDER BY RANDOM() LIMIT 1`, [msg.author.id], (err, row) => {
      if (!row) {
        msg.reply("❌ No tienes Pokémon. Usa `!capturar` primero.");
      } else {
        let nuevoNivel = row.level + 1;
        db.run(`UPDATE players SET level = ? WHERE user_id = ? AND pokemon = ?`,
          [nuevoNivel, msg.author.id, row.pokemon]);
        msg.reply(`⬆️ ¡Tu **${row.pokemon.toUpperCase()}** subió a nivel ${nuevoNivel}!`);
      }
    });
  }

  // !ayuda -> lista de comandos
  if (msg.content === "!ayuda") {
      msg.reply(`
📌   **Comandos Pokémon**
     - !start → Empieza tu aventura
     - !pokemon <nombre/id> → Busca datos de un Pokémon
     - !randompokemon → Te da un Pokémon aleatorio
     - !capturar → Intenta atrapar un Pokémon
     - !mipokedex → Ver tus capturas
     - !subir → Subir de nivel a un Pokémon
     - !ayuda → Ver esta lista
    `);
  }
});
client.login("MTQxOTgwNjUxODQ5MjAwODU2MA.G8JG7C.QQUAwXue5U3K6N47WsDmb_iW8SgcmFMexsC-eo");