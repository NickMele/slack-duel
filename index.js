var WebSocket = require('ws');
var request = require('request');
var randomWord = require('random-word');
var cool = require('cool-ascii-faces');
var gm = require('gm');
var fs = require('fs');
var Promise = require('bluebird');

var botToken = process.env.SLACK_BOT_TOKEN;
var apiToken = process.env.SLACK_API_TOKEN;

var apiUrl = 'https://slack.com/api/';
var trigger = /let's fight/i;
var pingInterval = 15000;

function connect () {
  request({
    method: 'GET',
    uri: apiUrl + 'rtm.start',
    qs: {
      token: botToken
    },
    json: true
  }, sockets);
}

function sockets (e, r, b) {
  if (e) {
    throw e;
  }

  var url = b.url;
  var ws = new WebSocket(url);
  var id = 0;
  var ping;
  var pong;
  var users = {};

  // game vars
  var currentWord = null;

  // store users
  b.users.forEach(function (user) {
    users[user.id] = user.name;
  });

  // connection established
  ws.on('open', function () {
    console.log('Connected.');
  });


  // message receiver
  ws.on('message', function (data, flags) {
    // console.log(data);
    data = JSON.parse(data);

    // check trigger
    if (trigger.test(data.text)) {
      currentWord = randomWord();

      var countDown = 3;
      var count = countDown + 2;
      var startText = users[data.user] + ' wants to duel!';

      var create = createImage(currentWord);

      // start duel countdown
      var duel = setInterval(function () {
        --count;
        if (count === 1) {
          create.then(sendImage(data.channel));
          // ws.send(JSON.stringify({
          //  id: id++,
          //  type: 'message',
          //  channel: data.channel,
          //  text: currentWord
          // }));
        }
        if (count === 0) {
          return clearInterval(duel);
        }

        ws.send(JSON.stringify({
          id: id++,
          type: 'message',
          channel: data.channel,
          text: count > countDown ? startText : count + '...'
        }));
      }, 1000);

    } else if (data.text && !data.reply_to && data.text.indexOf(currentWord) > -1) {
      // win condition
      ws.send(JSON.stringify({
        id: id++,
        type: 'message',
        channel: data.channel,
        text: users[data.user] + ' wins! ' + cool()
      }));
      currentWord = null;
    }
  });


  // error
  ws.on('error', function (data, flags) {
    throw error;
  });

  // pong receiver
  ws.on('pong', function (data, flags) {
    // console.log(data);
    pong = JSON.parse(data).time;
  });

  // ping sender
  setInterval(function () {
    ping = Date.now();

    if (pong && ping - pong > 2 * pingInterval) {
      throw 'Pong out of date';
    }

    ws.send(JSON.stringify({
      id: id++,
      type: 'ping',
      time: ping
    }));
  }, pingInterval)
}

function createImage (word) {
  return new Promise(function(resolve, reject) {
    var h = 60;
    var w = 400;
    var bgColor = '#ffffff';
    var textColor = '#000000';

    gm(w, h, bgColor)
      .fontSize(35)
      .fill(textColor)
      .drawText(20, h-20, word)
      .write('./image.png', function (error) {
        if (error) {
          return reject(error);
        }
        return resolve();
      });
  });
}

function sendImage (channel) {
  return function() {
    request({
      method: 'POST',
      uri: apiUrl + 'files.upload',
      formData: {
        token: apiToken,
        file: fs.createReadStream('./image.png'),
        channels: channel
      }
    }, function (error, response, body) {
      // console.log(body);
    });
  }
}

connect();
// createImage('foobar', 'G029KFACQ');

