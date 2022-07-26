import { config } from 'dotenv';
import { Rcon } from 'rcon-client';
import { WebSocket } from 'ws';
import { ChatClient } from '@twurple/chat';
import { LiveChat } from 'youtube-chat';

config();

let {
    RCON_HOST,
    RCON_PORT,
    RCON_PASSWORD,
    TELLRAW_TARGET,
    CHANNEL_TWITCH,
    CHANNEL_YT,
    CHANNEL_LIGHTSPEED
} = process.env;

if (!RCON_HOST) throw new Error('$RCON_HOST is not set');
if (!RCON_PORT) throw new Error('$RCON_PORT is not set');
if (!RCON_PASSWORD) throw new Error('$RCON_PASSWORD is not set');
if (!TELLRAW_TARGET) TELLRAW_TARGET = '@a';

(async () => {
    console.log(`Messages will be sent to ${TELLRAW_TARGET}`);
    console.log(`Connecting to rcon host ${RCON_HOST}:${RCON_PORT}...`);

    const rcon = await Rcon.connect({
        host: RCON_HOST,
        password: RCON_PASSWORD,
        port: Number(RCON_PORT),
    });

    console.log('Connected!');

    await rcon.send(`tellraw ${TELLRAW_TARGET} {"text":"RCON connected!"}`);

    async function forwardMessage(args: {
        source: 'twitch'|'ls'|'yt',
        author: string,
        text: string,
        hoverText?: string,
    }) {
        console.log(`Forwarding message:`, args);
        const message: {}[] = [];

        switch(args.source) {
            case 'yt':
                message.push({
                    color: 'red',
                    text: `${args.author}: `,
                    ...(args.hoverText
                        ? { hoverEvent: { action: "show_text", contents: [ args.hoverText ] } }
                        : {}),
                });
                break;
            case 'twitch':
                message.push({
                    color: 'dark_purple',
                    text: `${args.author}: `,
                    ...(args.hoverText
                        ? { hoverEvent: { action: "show_text", contents: [ args.hoverText ] } }
                        : {}),
                });
                break;
            case 'ls':
                message.push({
                    color: 'blue',
                    text: `${args.author}: `,
                    ...(args.hoverText
                        ? { hoverEvent: { action: "show_text", contents: [ args.hoverText ] } }
                        : {}),
                    });
                break;
        }

        message.push({ color: 'white', text: args.text });

        await rcon.send(`tellraw ${TELLRAW_TARGET} ${JSON.stringify(message)}`);
    }
    
    if (CHANNEL_LIGHTSPEED) {
        try {
            console.log(`Connecting to lightspeed channel ${CHANNEL_LIGHTSPEED}`);
            const ws = new WebSocket(`wss://events.lightspeed.tv/?channel=${CHANNEL_LIGHTSPEED}`);

            ws.on('open', async () => {
                await rcon.send(`tellraw ${TELLRAW_TARGET} {"text":"Lightspeed: Connected to chat!"}`);
            });

            ws.on('message', async msg => {
                try {
                    const event = JSON.parse(msg.toString());
                    if (event.type == 'ChatMessage') {
                        await forwardMessage({ source: 'ls', author: event.message.author.username, text: event.message.content });
                    }
                } catch(e) {
                    console.error(e);
                }
            });
        } catch(e) {
            console.error(e);
        }
    }

    if (CHANNEL_TWITCH) {
        console.log(`Connecting to twitch channel(s) ${CHANNEL_TWITCH}`);
        
        const client = new ChatClient({ channels: CHANNEL_TWITCH.split(',') });
        await client.connect();
        console.log('Connected to twitch');
        await rcon.send(`tellraw ${TELLRAW_TARGET} {"text":"Twitch: Connected to chat!"}`);

        client.onMessage(async (channel, user, message) => {
            await forwardMessage({ source: 'twitch', author: user, text: message, hoverText: channel });
        });
    }

    if (CHANNEL_YT) {
        console.log(`Connecting to YouTube channel ${CHANNEL_YT}`);
        const chat = new LiveChat({ channelId: CHANNEL_YT });

        await chat.start();

        chat.once('error', e => {
            console.error(e);
        });

        chat.on('start', async () => {
            await rcon.send(`tellraw ${TELLRAW_TARGET} {"text":"YouTube: Connected to chat!"}`);
        });

        chat.on('chat', async msg => {
            await forwardMessage({ source: 'yt', author: msg.author.name, text: msg.message.map((m: any) => m.text ?? '').join(' ') });
        });
    }
})();
