const { OpenAIApi, Configuration } = require("openai");
require('dotenv').config();
const PubNub = require('pubnub');
const readline = require('readline');
const axios = require('axios');


const model = "gpt-3.5-turbo"

async function main() {


    console.log("Realtime News on PubNub\n");


    const channel = await promptUser("What channel should we use?\n");
    if (channel == "exit") {
        process.exit(0);
    }

    let topic = "headlines";

    while (true) {

        const apiKey = process.env.NEWS_API_KEY;
        const pageSize = 10;

        let url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}&pageSize=${pageSize}`;

        if (!topic.includes("headlines")) {
            url = `https://newsapi.org/v2/everything?q=${topic}&apiKey=${apiKey}&pageSize=${pageSize}`
        }
    
        let news = [];
        let response = await axios.get(url)
        console.log("Displaying news...\n\n")
        await displayNews(response.data.articles);
        news = response.data.articles;
      
        async function displayNews(articles) {

            for (const article of articles) {
                await sleep(700);
                console.log('Title:', article.title);
                console.log('Description:', article.description);
                console.log('URL:', article.url);
                console.log('---\n');
            }
        }

        const publishPubnub = new PubNub({
            subscribeKey: process.env.SUBKEY,
            publishKey: process.env.PUBKEY,
            userId: "news",
        });

        publishPubnub.publish({
            channel,
            message: news,
            userId: "news",
        }, function(status, response) {
            if (status.error) {
              console.error(status);
            } else {
                //pass
            }
        });

        sleep(5000);
        topic = await promptUser("\n\nWhat topic do you want more news about?\n");
    }

}

main();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
function promptUser(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (text) => {
        rl.close();
        resolve(text);
        });
    });
}
