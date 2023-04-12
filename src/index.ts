import { Client, Events, GatewayIntentBits, Message, TextChannel } from "discord.js";
import "dotenv/config";
import {
  ENGLISH_CHANNEL_ID,
  ERROR_CHANNEL_ID,
  GENERAL_CHANNEL_ID,
  RUSSIAN_CHANNEL_ID,
  VALID_LANGUAGES,
} from "./constants";
import * as DeepL from "deepl-node";
import * as cld from "cld";

const deeplApiKey = process.env.DEEPL_API_KEY;
if (deeplApiKey == null) {
  throw new Error("deepl api key does not exist");
}
const deeplTranslator = new DeepL.Translator(deeplApiKey);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, (message: Message<boolean>) => {
  if (message.author.bot === true) {
    return;
  }

  try {
    handleNewMessage(client, message);
  } catch (error) {
    console.error(error);
  }
});

async function handleNewMessage(client: Client, message: Message) {
  const sourceChannelId = message.channelId;
  const messageContent = message.content;

  if (sourceChannelId === ENGLISH_CHANNEL_ID) {
    const textResult = await deeplTranslator.translateText(messageContent, "en", "ru");
    sendMessage(textResult.text, RUSSIAN_CHANNEL_ID, client);
  } else if (sourceChannelId === RUSSIAN_CHANNEL_ID) {
    const textResult = await deeplTranslator.translateText(messageContent, "ru", "en-US");
    sendMessage(textResult.text, ENGLISH_CHANNEL_ID, client);
  } else if (sourceChannelId === GENERAL_CHANNEL_ID) {
    await handleNewGeneralChannelMessage(messageContent, client);
  }
}

async function handleNewGeneralChannelMessage(messageContent: string, client: Client) {
  try {
    const highestScoringLanguage = await detectHighestScoringValidLanguage(
      messageContent
    );
    const languageCode = highestScoringLanguage.code;
    if (languageCode === "en") {
      const textResult = await deeplTranslator.translateText(messageContent, "en", "ru");
      sendMessage(textResult.text, RUSSIAN_CHANNEL_ID, client);
    } else if (languageCode === "ru") {
      const textResult = await deeplTranslator.translateText(
        messageContent,
        "ru",
        "en-US"
      );
      sendMessage(textResult.text, ENGLISH_CHANNEL_ID, client);
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      sendMessage(`unknown error`, ERROR_CHANNEL_ID, client);
      return;
    }
    sendMessage(`${error.message}: ${messageContent}`, ERROR_CHANNEL_ID, client);
    return;
  }
}

async function detectHighestScoringValidLanguage(messageContent: string) {
  const detectedLanguages = await cld.detect(messageContent);
  const highestScoringLanguage = getHighestScoringLanguage(detectedLanguages.languages);
  const languageCode = highestScoringLanguage.code;
  if (!VALID_LANGUAGES.includes(languageCode)) {
    throw new Error(`detected language not in ${VALID_LANGUAGES}`);
  }
  return highestScoringLanguage;
}

function getHighestScoringLanguage(detectedLanguages: Array<cld.Language>) {
  if (detectedLanguages.length <= 0) {
    throw new Error("no detected languages from cld");
  }
  let highestScoringLanguage = detectedLanguages[0];
  for (let i = 1; i < detectedLanguages.length; i++) {
    if (highestScoringLanguage.score < detectedLanguages[i].score) {
      highestScoringLanguage = detectedLanguages[i];
    }
  }
  return highestScoringLanguage;
}

function sendMessage(message: string, channelId: string, client: Client) {
  const channel = client.channels.cache.get(channelId) as TextChannel;
  channel.send(message);
}

client.login(process.env.DISCORD_TOKEN);
