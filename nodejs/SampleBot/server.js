var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
//apikey.jsonに書いてあるAPIキーを読み込む
var API_KEY = JSON.parse(fs.readFileSync('./apikey.json','utf8'));
var cognitive = require('./cognitive');
require('date-utils');
var Docomo = require("./docomoapi.js");
var docomo = new Docomo(API_KEY.DOCOMO_APIKEY);


//Botにメッセージがくるとここが呼び出される
function onMessage(session){
    
    //rule.csvに書いてあるルールとマッチングを行う
    //マッチしたルールが2つ以上あると最初のルールが選択される
    var responses = [];
    for(var rule of rules){
        var message = session.message.text;
        if((new RegExp(rule.pattern).exec(message))){
            if(rule.responses.length == 1){
                responses.push(rule.responses[0]);
            }else{
                var pick = Math.floor( Math.random() * rule.responses.length );
                responses.push(rule.responses[pick]);
            }
            break;
        }
    }

    for(var res of responses){
        if(res.indexOf('{')!=-1&&res.indexOf('}')!=-1){
            var command = res.replace('{','').replace('}','');
            onCommand(session,command);
        }else{
            session.send(res);
        }
    }

    //↑ここまでルールマッチング

    //Botへの発話テキストはこのように取得する
    var text = session.message.text;

    /******************************************************** 
     * コピペゾーン1: 発話が来たときに通るゾーン
    *********************************************************/

    //マッチするルールがないなら
    if(responses.length == 0){
        /******************************************************** 
         * コピペゾーン2: 用意したルールに何もマッチングしなかった発話が来た時に通るゾーン
        *********************************************************/

        session.send("今日はいい天気ですね");
    }

    //アタッチメント(画像など)が添付されているとこの中が実行される
    if(session.message.attachments.length > 0){
        //アタッチメントのURL
        var image = session.message.attachments[0].contentUrl;
        /******************************************************** 
         * コピペゾーン3: 発話がきて、アタッチメント(画像)が添付されていた時に通るゾーン
        *********************************************************/

        //Face APIを呼び出す
        cognitive.faceDetect(API_KEY.FACE_APIKEY,image,true,true,"age",function(error,response,body){
            if (!error && response.statusCode == 200) {
                session.send(body[0].faceAttributes.age+'歳');
            } else {
                session.send('error: '+ JSON.stringify(response));
            }
        });
    }
}

//ルールに{command}が入っていればここが呼び出される
function onCommand(session,command){
    /******************************************************** 
    * コピペゾーン4: 発話がルールにマッチして、ルールに{command}が書いてあった時に通るゾーン
    *********************************************************/


    if(command === "command1"){
        session.send("execute "+command);
    }
}

//↓ここから下は特に気にしなくても大丈夫です


//rule.csvのルールを読み込む
var rules = [];
fs.readFileSync('./rule.csv').toString().split('\n').forEach(function (line) {
	if(line.startsWith("//")||line==""){
        return;
    }
    var cols = line.split(',');
    var subCols = cols[1].split(':');
    rules.push({
        pattern:cols[0],
        responses:subCols
    });
});
rules.splice(0,1);

fs.writeFileSync('index.html','<h1>This is bot page</h1><br /><br /><h2>errors</h2><br /><br />','utf8');
function writeLog(log){
    var dt = new Date();
    var dateStr = dt.toFormat('MM/DD HH24:MI:SS');
    var logStr = "["+dateStr+"] "+log; 
    console.log(logStr);
    fs.appendFileSync('index.html',logStr,'utf8');
}

//BotFrameworkを初期化する
var connector = new builder.ChatConnector({
    appId: API_KEY.BOT_ID,
    appPassword: API_KEY.BOT_PASSWORD
});
var bot = new builder.UniversalBot(connector);
bot.dialog('/', function (session) {
    try{
        session.beginDialog('/message');
    }catch(ex){
        writeLog(ex);
    }
});

bot.dialog('/message',function(session){
    if(session.message.type ==='message'){
        onMessage(session);
    }
    session.endDialog();
    
});

var server = restify.createServer();
server.post('/api/messages', connector.listen());

server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'index.html'
}));

//node.jsサーバーを起動する
server.listen(process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});