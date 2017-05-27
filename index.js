/** I don't always put everything in a file
but when I do it's casue I'm lazy */

const fs = require('fs');
const Gdax = require('gdax');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_KEY;

let db = fs.readFileSync('./db', 'utf-8');
const bot = new TelegramBot(token, {polling: true});

try {
  db = JSON.parse(db);
} catch (e) {
  db = {subscribers: {}};
}

const sleep = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms));

function commit() {
  fs.writeFileSync('./db', JSON.stringify(db));
}

function subscribe(chatId, {above = 0, below = Infinity}) {
  const newAbove = (!!db.subscribers[chatId] && above === 0)? db.subscribers[chatId].above : above;
  const newBelow = (!!db.subscribers[chatId] && below === Infinity)? db.subscribers[chatId].below : below;
  const thresholds = {above: parseFloat(newAbove), below: parseFloat(newBelow)};
  db.subscribers[chatId] = thresholds;
  commit();
}

function unsubscribe(chatId) {
  delete db.subscribers[chatId];
  commit();
}

bot.onText(/\/below (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  console.log(match);
  const threshold = match[1];
  subscribe(chatId, {below: threshold});
  bot.sendMessage(chatId, `I will warn you if the rate goes below ${threshold}`);
});

bot.onText(/\/above (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const threshold = match[1];
  subscribe(chatId, {above: threshold});
  bot.sendMessage(chatId, `I will warn you if the rate goes above ${threshold}`);
});

bot.onText(/\/stop/, (msg, match) => {
  const chatId = msg.chat.id;
  unsubscribe(chatId);
  bot.sendMessage(chatId, 'Unsubscribed, bye');
});

async function main() {
  let res = null;
  while (true) {
    res = await axios.get(apiBase + '/products/BTC-EUR/stats');
    console.log(res.data);
    const last = res.data.last;
    for (let subscriber in db.subscribers) {
      const sub = db.subscribers[subscriber];
      if (sub.above < last && sub.below > last) {
        bot.sendMessage(subscriber, `You set thresholds above/below ${sub.above}/${sub.below}
          and the last BTC-EUR rate was ${last}`);
      } 
    };
    await sleep(10000);
  }
}

main();