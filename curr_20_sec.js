const mysql = require('mysql');
const mysql2 = require('mysql2');
const util = require('util');
const Binance = require('node-binance-api');
const cron = require('node-cron');

let fs = require('fs');
let params = JSON.parse(fs.readFileSync('params.json', 'utf8'));

let pool = null;
const binance = new Binance().options({
    APIKEY: params.binance.api_key,
    APISECRET: params.binance.api_secret
  });

const  TelegramBot  =  require ( 'node-telegram-bot-api' ) ;
const  token  =  params.telegram_bot_token ;
const  myId = params.telegram_id;
const  bot  =  new  TelegramBot ( token ,  { polling : false } ) ;

let price = [];
let messages = [];

function returnPoolConnection() {
    var error = null;
    if (pool != null) return;
    pool  = mysql.createPool({
            connectionLimit : 10,
            connectTimeout: 10000,
            acquireTimeout: 10000,
            host     : params.database.dbhost,
            user     : params.database.user,    
            password : params.database.pass,
            database : params.database.dbname,
            "socketPath": "/var/run/mysqld/mysqld.sock"
    });
    pool.query = util.promisify(pool.query);
    console.log('create pool!')
}

returnPoolConnection();

async function savePrices (curr_str, value) {
    // проверить вдруг цена та же
    if (parseFloat (price[curr_str]) === parseFloat (value)){
        return;
    }

    price[curr_str] = parseFloat (value);

    let prices = await pool.query('INSERT INTO `prices` (`curr_str`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', [curr_str, value, value]);
    let res = await pool.query('INSERT INTO `history` (`curr_str`, `value`, `date`) VALUES (?, ?, NOW())', [curr_str, value]);

    await checkNewValue(curr_str, value);
}

async function checkNewValue (curr, newV) {
    let n = parseFloat (newV);

    // взять значение из таблицы history которое 3 минуты и 10 минут
    let three = await pool.query('SELECT `value` FROM `history` WHERE `curr_str` = ? AND `date` <= DATE_SUB(NOW(), INTERVAL ? MINUTE) AND `date` >= DATE_SUB(NOW(), INTERVAL ? MINUTE);', [curr, params.time_curr_up, params.time_curr_up + 1]);
    let ten = await pool.query('SELECT `value` FROM `history` WHERE `curr_str` = ? AND `date` <= DATE_SUB(NOW(), INTERVAL ? MINUTE) AND `date` >= DATE_SUB(NOW(), INTERVAL ? MINUTE);', [curr, params.time_curr_down, params.time_curr_down + 1]);

    let treeMin = three[0] ? parseFloat(three[0].value) : null;
    let tenMin = ten[0] ? parseFloat(ten[0].value) : null;

    if (!treeMin || !tenMin) return;

    let message = '';

    if (tenMin > n) {
        // упал 10 минут назад
        let down = ((tenMin - n) / tenMin) * 100.0;
        if (down >= params.persent_curr_down) {
            // упало более чем на 10%
            let res2 = await pool.query('INSERT INTO `traffic` (`curr_str`, `old_price`, `new_price`, `direction`) VALUES (?, ?, ?, ?)', [curr, tenMin, n, 'down']);
            message = '🔴*' + curr + '* fell more than ' + params.persent_curr_down + '%. Old: ' + tenMin + ' Price now: ' + n;
            console.log(message);
            if (params.telegram_bot){
                if (messages[curr] && messages[curr].length > 0 && messages[curr].includes(message.slice(0, -8))){

                } else {
                    messages[curr] = message;
                    bot.sendMessage(myId, message, {parse_mode: 'Markdown', disable_web_page_preview: true, disable_notification: true});
                }
            }
        }
    } 
    // думала проверять по else, но значения в разное время и бывает так, что за 3 минуты поднялось выше, чем за 10 минут упало. 
    if (treeMin < n) {
        // вырос 3 минуты назад
        let up = ((n - treeMin) / treeMin) * 100.0;
        if (up >= params.persent_curr_up) {
            // выросло на более 3 процентов
            let res1 = await pool.query('INSERT INTO `traffic` (`curr_str`, `old_price`, `new_price`, `direction`) VALUES (?, ?, ?, ?)', [curr, treeMin, n, 'up']);
            message = '🟢*' + curr + '* has grown by more than ' + params.persent_curr_up + '%. Old: ' + treeMin + ' Price now: ' + n;
            console.log(message);
            if (params.telegram_bot){
                if (messages[curr] && messages[curr].length > 0 && messages[curr].includes(message.slice(0, -8))){

                } else {
                    messages[curr] = message;
                    bot.sendMessage(myId, message, {parse_mode: 'Markdown', disable_web_page_preview: true, disable_notification: true});
                }
            }
        }
    }
    if (message.length > 0){
        messages[curr] = message
    }
}

async function main() {
    let ticker = await binance.prices();
    console.log('wait...');
    let adds = 0;
    for (var key in ticker) {
        await savePrices(key, ticker[key]);
        adds ++;
    }
    console.log('Success! (' + adds + ')');
};

cron.schedule('*/20 * * * * *', () => {
    main();
});

cron.schedule('*/5 * * * *', () => {
    let time = params.time_curr_up;
    if (params.time_curr_up < params.time_curr_down) time = params.time_curr_down;
    let res3 = pool.query('DELETE FROM `history` WHERE `date` <= DATE_SUB(NOW(), INTERVAL ? MINUTE)', [time + 2]);
    let res4 = pool.query('DELETE FROM `traffic` WHERE `traffic_new_date` <= DATE_SUB(NOW(), INTERVAL ? MINUTE)', [time + 2]);
});



