"use strict";
const { EventEmitter } = require("events");
const { distanceToShortenedURL } = require("./distance.js");

module.exports = (tweetStream, accountIDToFollow, locations) => {
  const emitter = new EventEmitter();

  tweetStream.on("connected", () => emitter.emit("connected"));

  tweetStream.on("error", err => emitter.emit("error", err));

  tweetStream.on("tweet", tweet => {
    if (!isDirectlyFromTheAccount(tweet, accountIDToFollow)) {
      // From https://dev.twitter.com/streaming/overview/request-parameters#follow, we only want
      // "Tweets created by the user", but the stream gives us a lot of other tweets (mostly when
      // somebody retweets the account).
      return;
    }
    
    //console.log("Tweet data begin");
    //console.log(JSON.stringify(tweet, undefined, 2));
    //console.log("Tweet data end");

    let data;
    try {
      data = parseTweet(tweet);
      //console.log("Parsed data:");
      //console.log(JSON.stringify(data, undefined, 2));
      //console.log("Parsed data end");
    } catch (err) {
      emitter.emit("error", new Error(`Could not parse tweet with text '${tweet.text}'`));
      return;
    }
    
    // Todo - this should be passed as a string and not an Error
    emitter.emit("parse succeeded", new Error(`Tweet parse succeeded with text '${tweet.text}'`));

    for (const location of locations) {
      distanceToShortenedURL(location, data.url).then(distance => {
        // Test: accept all tweets
        if (distance < location.radius) {
          const dataWithCloseness = Object.assign({ distance, tweet, closeTo: location.label, players: location.players }, data);
          emitter.emit("spawn within range", dataWithCloseness);
        }
        else {
          //console.log("spawn out of range");
        }
      })
      .catch(err => emitter.emit("error", err));
    }
  });

  return emitter;
};

function isDirectlyFromTheAccount(tweet, accountIDToFollow) {
  return tweet.user.id_str === accountIDToFollow && !tweet.retweeted_status;
}

function parseTweet(tweet) {
  // Example tweet:
  // Unown (K) (IV: 33%, TTL: &lt;10m 0s) [Chicago, Illinois, US]: https://t.co/gaGzLLFLjm
  //
  // What we want is the expanded url, which embeds the GPS location, e.g.:
  //
  // https://pogoapi.co/x/#41.79195,-87.60672
  
  const url = tweet.entities.urls[0].expanded_url; // expanded URL
  
  return { url };
}
