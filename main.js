var https = require('https');
var levelup = require('level');


var commentsdb = levelup('./comments');


var options = {
    host: 'api.github.com',
    path: '/repos/BrandwatchLtd/frontend/pulls',
    auth: 'pmsorhaindo:c4b0c1bd041d369341a0fe8c6fd0cc9ad091908a',
    headers: {
        'User-Agent': 'BrandwatchLtd-PR-Gamification'
    }
};

var tempCommentsArray = [];



var responseObj;

callbackPR = function(response) {
    var str = '';
    var header = JSON.stringify(response.headers);

    response.on('data', function(chunk) {
        str += chunk;
    });

    response.on('end', function() {
        processPRResponse(str,header);
    });
};

callbackComments = function(response) {
    var str = '';
    var header = JSON.stringify(response.headers);

    response.on('data', function(chunk) {
        str += chunk;
    });

    response.on('end', function() {
        processCommentsReponse(str,header);
    });
};

https.request(options, callbackPR).end();

function processPRResponse(strJSON,header) {
    var responseObj = JSON.parse(strJSON);

  
    responseObj.forEach(function(prObject){
        options.path = stripHost(prObject.review_comments_url);
        https.request(options, callbackComments).end();
    });

    processIssues(responseObj);
}

function processIssues(responseObj){
    responseObj.forEach(function(prObject){
        options.path = stripHost(prObject.comments_url);
        https.request(options, callbackComments).end();
    });

    postNewComments();
}

function processCommentsReponse(strJSON,header) {
    var responseObj = JSON.parse(strJSON);
    
    responseObj.forEach(function(commentObj){
        
        tempCommentsArray.push({
            username : commentObj.user.login,
            email : '', // 
            comment : commentObj.body,
            time : commentObj.created_at,
            repo : extractRepoFromPRURL(commentObj.url)
        });
    });
}

function postNewComments()
{

    var postOptions = {
      host: 'http://git/',
      path: '/statistics',
      port: '8080',
      method: 'POST'
    };

    postCallback = function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });

      response.on('end', function () {
        console.log(str);
      });
    };

    var req = http.request(postOptions, postCallback);
    req.write(JSON.stringify(tempCommentsArray));
    req.end();
}


function stripHost(strURL){
    return strURL.replace('https://api.github.com','');
}

function extractRepoFromPRURL(strURL){
    return strURL.split('/')[5];
}


commentsdb.createReadStream()
    .on('data', function (data) {
        console.log(data.key, '=', data.value);
    })
        .on('error', function (err) {
    console.log('Oh my!', err);
    })
        .on('close', function () {
    console.log('Stream closed');
    })
    .on('end', function () {
        console.log('Stream closed');
    });