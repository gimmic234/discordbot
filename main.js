const undici = require('undici');
const Discord = require('discord.js');
const moment = require('moment-timezone');
const momentDurationFormatSetup = require("moment-duration-format");
const fs = require('fs');
const CONFIG = require('./config.json');
const client = new Discord.Client(
    {
        intents: 
            [
                Discord.GatewayIntentBits.Guilds,
                Discord.GatewayIntentBits.GuildMessages,
                Discord.GatewayIntentBits.MessageContent,
                Discord.GatewayIntentBits.GuildMembers,
            ],
        partials: 
           [
                Discord.Partials.Message,
                Discord.Partials.Channel
           ]
    });
const token = CONFIG.BOT_TOKEN;
const shid = CONFIG.shid;
const skv = CONFIG.skv;
const prefix = '!';
const errorLogFile = "./errorLog.txt";
const errorLogStream = fs.createWriteStream(errorLogFile, {flags: 'a'});
//const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
var commandFull = [];
var commandList = [];
var reading = false;

momentDurationFormatSetup(moment);

/*client.commands = new Discord.Collection();
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.name, command);
}*/

client.once('ready', async () => {
    await readConfig();
    console.log('Bot Online')
});

client.on('messageCreate', async (message) => {
    if (message.content.length <= 2) return;
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (!await evalCommands(command, message))
    {
        await readConfig();
        await evalCommands();
    }
    
});

async function evalCommands(command, message) {
    if (commandList.includes(command))
    {
        return await executeCommand(command, message);
    } 
    return false;
}

async function executeCommand(command, message)
{
    try {
        var targetList = commandFull[command];
        var rand = Math.floor(Math.random() * targetList.length);
        var target = targetList[rand];
        switch(target.type) {
            case "message":
                await handleMessage(command, message, target.content, target.file);
                break;
            case "countdown":
                var datetime = moment.tz(target.datetime, target.timezone);
                var currentTime = moment.tz(target.timezone);
                var diff = datetime.diff(currentTime);
                var diffString = moment.duration(diff).format("d [days] hh [hrs] mm [minutes] ss [seconds]");
                var countdownString = target.content.replace("[st]", diffString);
                await handleMessage(command, message, countdownString, target.file);
                break;
            default:
                await message.channel.send(target.content);
                break;
        }
    } catch (e) {
        writeFile(moment().format() + "command doesn't exist " + command +"\n");
        writeFile(e + "\n");
        return false;
    }
    return true;
}

async function handleMessage(command, message, string, file) {
    if (string && string != "") {
        string = string.replace("[user]",message.author.username);
        await message.channel.send(string);
    }
    if (file && file != "") {
        await message.channel.send({ files: [{ attachment: file }] });
    }
    return;
}

function writeFile(content)
{
    errorLogStream.write(content, (err) => {
    //fs.writeFileSync(errorLogFile, content, (err) => {
      if (err) console.log(err);
      console.log("Successfully Written to File.");
    });
}

async function readConfig()
{
    if (reading) return;
    reading = true;
    return undici.fetch("https://sheets.googleapis.com/v4/spreadsheets/"+shid+"/values/Commands?key=" + skv).then(async (response) => {
        return await response.json();
    }).then((result) => {
        let entries = result.values;
        commandList = [];
        commandFull = [];
        entries.shift();
        entries.forEach(function(value, index) {
            let newEntry = {
                "command": value[0],
                "type": value[1],
                "content": value[2],
                "file": value[3],
                "datetime": value[4],
                "timezone": value[5]
            };
            if (commandFull[newEntry.command] != null) {
                commandFull[newEntry.command].push(newEntry);
            } else {
                commandFull[newEntry.command] = [newEntry];
                commandList.push(value[0]);
            }
        });
        reading = false;
    });
}

client.login(token);
