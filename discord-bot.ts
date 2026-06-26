import { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  ChannelType, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';

// Bun loads environment variables from .env file automatically
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN) {
  console.error("❌ Error: DISCORD_TOKEN is missing in your .env file.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Bot is online! Logged in as ${client.user?.tag}`);

  // Register slash command
  if (CLIENT_ID && GUILD_ID) {
    const commands = [
      new SlashCommandBuilder()
        .setName('setupserver')
        .setDescription('Automatically setups categories, channels, and roles for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
      console.log('🔄 Started refreshing application (/) commands...');
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands },
      );
      console.log('✅ Successfully reloaded application (/) commands in your guild!');
    } catch (error) {
      console.error('❌ Failed to register commands:', error);
    }
  } else {
    console.log('⚠️ Warning: CLIENT_ID or GUILD_ID is missing. Slash commands might not register instantly.');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setupserver') {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ Command ini hanya bisa digunakan di dalam server Discord.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // 1. Create Roles
      console.log('Creating roles...');
      const adminRole = await guild.roles.create({
        name: 'Admin',
        color: 'Blue',
        permissions: [PermissionFlagsBits.Administrator],
        reason: 'PortaDrive Server Setup',
      });

      const modRole = await guild.roles.create({
        name: 'Moderator',
        color: 'Green',
        permissions: [
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
          PermissionFlagsBits.KickMembers
        ],
        reason: 'PortaDrive Server Setup',
      });

      const memberRole = await guild.roles.create({
        name: 'Member',
        color: 'LightGrey',
        reason: 'PortaDrive Server Setup',
      });

      // 2. Create Categories & Channels
      console.log('Creating categories and channels...');

      // Category: INFORMATION
      const infoCategory = await guild.channels.create({
        name: '📌 INFORMATION',
        type: ChannelType.GuildCategory,
      });

      await guild.channels.create({
        name: '📢-announcements',
        type: ChannelType.GuildText,
        parent: infoCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages],
          },
          {
            id: modRole.id,
            allow: [PermissionFlagsBits.SendMessages],
          }
        ]
      });

      await guild.channels.create({
        name: '📜-rules',
        type: ChannelType.GuildText,
        parent: infoCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages],
          }
        ]
      });

      // Category: TEXT CHANNELS
      const textCategory = await guild.channels.create({
        name: '💬 COMMUNITY',
        type: ChannelType.GuildCategory,
      });

      await guild.channels.create({
        name: '💬-general',
        type: ChannelType.GuildText,
        parent: textCategory.id,
      });

      await guild.channels.create({
        name: '🤖-bot-commands',
        type: ChannelType.GuildText,
        parent: textCategory.id,
      });

      // Category: PORTADRIVE INTEGRATION
      const driveCategory = await guild.channels.create({
        name: '📂 PORTADRIVE',
        type: ChannelType.GuildCategory,
      });

      await guild.channels.create({
        name: '☁️-drive-updates',
        type: ChannelType.GuildText,
        parent: driveCategory.id,
      });

      await guild.channels.create({
        name: '🤖-ai-analyzer',
        type: ChannelType.GuildText,
        parent: driveCategory.id,
      });

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Server Setup Complete!')
        .setDescription('Server Discord berhasil dikonfigurasi secara otomatis oleh PortaDrive Bot.')
        .addFields(
          { name: 'Roles Created', value: `• ${adminRole}\n• ${modRole}\n• ${memberRole}`, inline: true },
          { name: 'Channels Setup', value: `• Categories: 📌 INFORMATION, 💬 COMMUNITY, 📂 PORTADRIVE\n• Total Channels: 5 text channels.`, inline: false }
        )
        .setColor('#016fee')
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
      console.log('✅ Server setup successfully completed.');

    } catch (error) {
      console.error('❌ Error setting up server:', error);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat melakukan setup server. Pastikan bot memiliki role paling tinggi dan memiliki izin Administrator.' });
    }
  }
});

client.login(TOKEN);
