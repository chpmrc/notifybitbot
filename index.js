/** I don't always put everything in a file
but when I do it's casue I'm lazy */

const fs = require('fs');
const Gdax = require('gdax');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const isProduction = process.env.NODE_ENV === 'production'

const apiBase = 'https://api.gdax.com';
const token = (isProduction)? process.env.TELEGRAM_BOT_KEY : process.env.TELEGRAM_BOT_KEY_DEV;
const delay = (isProduction)? 10000 : 1000;

let db = fs.readFileSync('./db', 'utf-8');
const bot = new TelegramBot(token, {polling: true});

try {
  db = JSON.parse(db);
  db.lastRates = db.lastRates || {};
} catch (e) {
  db = {subscribers: {}, last: null, lastRates: {}};
}

const sleep = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms));

function commit() {
  fs.writeFileSync('./db', JSON.stringify(db));
}

function subscribe(chatId, {above = Infinity, below = 0}) {
  const thresholds = {above, below};
  db.subscribers[chatId] = thresholds;
  console.log(`New subscriber: ${chatId} with thresholds ${below}/${above}`);
  commit();
}

function unsubscribe(chatId) {
  delete db.subscribers[chatId];
  commit();
}

function updateLast(last, what) {
  db.lastRates[what] = last;
  commit();
}

bot.onText(/\/start/, (msg, match) => {
  bot.sendMessage(msg.chat.id, 'This is an EXPERIMENTAL personal project.');
  bot.sendMessage(msg.chat.id, 'Send /below THRESHOLD to be warned when the BTC-EUR rate goes below the threshold');
  bot.sendMessage(msg.chat.id, 'Send /above THRESHOLD to be warned when the BTC-EUR rate goes above the threshold');
  bot.sendMessage(msg.chat.id, 'Send btc to get the last BTC-EUR rate');
  bot.sendMessage(msg.chat.id, 'Send btc to get the last ETH-EUR rate');
  bot.sendMessage(msg.chat.id, 'Send /stop to unsubscribe');
});

bot.onText(/\/below (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
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

bot.onText(/btc/i, (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Last ETH-EUR rate: ${db.lastRates.btc}`);
});

bot.onText(/eth/i, (msg, match) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Last ETH-EUR rate: ${db.lastRates.eth}`);
});



async function main() {
  let res = null;
  let last = null;
  while (true) {

    try{
      res = await axios.get(apiBase + '/products/BTC-EUR/stats');
      last = res.data.last;
      updateLast(last, 'btc');
      res = await axios.get(apiBase + '/products/ETH-EUR/stats');
      last = res.data.last;
      updateLast(last, 'eth');
      console.log('Last rates: ', db.lastRates);
      for (let subscriber in db.subscribers) {
        const sub = db.subscribers[subscriber];
        if (db.lastRates.btc > sub.above && sub.above !== null) {
          bot.sendMessage(subscriber, `Last BTC-EUR rate was ${db.lastRates.btc} (above ${sub.above})`);
        }
        if (db.lastRates.btc < sub.below && sub.below !== null) {
          bot.sendMessage(subscriber, `Last ETH-EUR rate was ${db.lastRates.btc} (below ${sub.below})`);
        }
      };  
    } catch (e) {
      console.error(e);
    }
    
    await sleep(delay);
  }
}

main();