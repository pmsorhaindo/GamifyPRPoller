var http = require('http');
var https = require('https');
var async = require('async');
var levelup = require('level');
var mongojs = require('mongojs');
//var schedule = require('node-schedule');

var apiKey = '';
var repoName = 'repo';

var commentsdb = levelup('./comments');
var repoPullRequestsPath = '/repos/' + repoName + '/frontend/pulls';

var options = {
    host: 'api.github.com',
    path: '',
    auth: 'pmsorhaindo:'+apiKey,
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

callbackComments = function(response,callback) {
    var str = '';
    var header = JSON.stringify(response.headers);

    response.on('data', function(chunk) {
        str += chunk;
    });

    response.on('end', function() {
        processCommentsReponse(str,header);
        callback();
    });
};

function processPRResponse(strJSON,header) {
    var responseObj = JSON.parse(strJSON);

    async.series([
        function(callback){
            processPRComments(responseObj,callback);
        },
        function(callback){
            processIssuesComments(responseObj,callback);
        }],
        function(err){
            if(err) {
                throw err;
            }
            cacheNewComments();
        });
}

function processPRComments(responseObj,PRsCompleted) {
    console.log('grabbing PR comments...');
    async.each(responseObj, function(prObject,callback) {
        options.path = stripHost(prObject.review_comments_url);
        https.request(options, function(resp){
            callbackComments(resp,callback);
        }).end();
        }, PRsCompleted);
}

function processIssuesComments(responseObj,issuesCompleted) {
    console.log('grabbing PR issue comments...');
        async.each(responseObj, function(prObject,callback) {
        options.path = stripHost(prObject.comments_url);
        https.request(options, function(resp){
            callbackComments(resp,callback);
            }).end();
        }, issuesCompleted);}

function processCommentsReponse(strJSON,header) {
    var responseObj = JSON.parse(strJSON);
    
    responseObj.forEach(function(commentObj){
        
        tempCommentsArray.push({
            id : commentObj.id,
            username : commentObj.user.login,
            email : '', // 
            comment : commentObj.body,
            time : commentObj.created_at,
            repo : extractRepoFromPRURL(commentObj.url)
        });
    });
}

function cacheNewComments() {
    console.log('Total comments polled: ' + tempCommentsArray.length);
    console.log('Writing to commentsdb...');

    var ops = tempCommentsArray.map(function (comment){
        return {
            type: 'put',
            key: comment.id,
            value: comment,
            valueEncoding : 'json'
        };
    });

    responseObj = null;
    tempCommentsArray = [];
    
    commentsdb.batch(ops, function (err) {
      if (err) return console.log('Ooops!', err);
      console.log('Great success dear leader!');
    });

    readDB();
    //TODO END OF EXECITION
}


function stripHost(strURL){
    return strURL.replace('https://api.github.com','');
}

function extractRepoFromPRURL(strURL){
    return strURL.split('/')[5];
}

function readDB(){
    var count = 0;
    commentsdb.createReadStream({valueEncoding : 'json'})
        .on('data', function (data) {
            //console.log(data.key, '=', data.value.comment);
            count+=1;
            })
        .on('error', function (err) {
            console.log('Oh my!', err);
            })
        .on('close', function () {
            console.log (count + ' comment(s) in the datastore');
            console.log('Stream closed');
            })
        .on('end', function () {
            console.log('Stream ended');
        });
}

function main() {
    options.path = repoPullRequestsPath;
    https.request(options, callbackPR).end();
}

setInterval(main,20000);

