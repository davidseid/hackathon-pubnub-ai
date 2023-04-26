const { OpenAIApi, Configuration } = require("openai");
require('dotenv').config();
const PubNub = require('pubnub');
const readline = require('readline');

const model = "gpt-3.5-turbo"

async function main() {

    console.log("Video Game Simulator: An AI video game on PubNub\n");

    const channel = await promptUser("What channel should we use?\n");
    if (channel == "exit") {
        process.exit(0);
    }

    const numUsers = await promptUser("How many characters do you want?\n");
    if (numUsers == "exit") {
        process.exit(0);
    }
    
    const topic = await promptUser("What type of game should we simulate?\n");

    if (topic == "exit") {
        process.exit(0);
    }
 

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const nameCompletion = await openai.createChatCompletion({
        model,
        messages: [
            {role: "system", content: `Please give me a comma separated list of ${numUsers} unique characters names appropriate for the ${topic}, just the device names as a comma-separated list, nothing else`}
        ],
      });
    
    const users = nameCompletion.data.choices[0].message.content.split(', ');
    console.log(users);




    const initialPrompt = await openai.createChatCompletion({
        model,
        messages: [
            {role: "user", content: `Please give me an example json object that might represent actions taken by the character in the game about ${topic}`}
        ],
    });

    let message = initialPrompt.data.choices[0].message.content;
    let receivedMessages = [];
    
    const pubnub = new PubNub({
        subscribeKey: process.env.SUBKEY,
        publishKey: process.env.PUBKEY,
        userId: 'listener',
    });
    pubnub.subscribe({
        channels: [channel],
    });

    pubnub.addListener({
        message: function(message) {
            receivedMessages.push(message);
        }
    });

    while (true) {

        let user = users[Math.floor(Math.random() * users.length)];
        console.log(`\n\n${user}: ${message}`);

        const publishPubnub = new PubNub({
            subscribeKey: process.env.SUBKEY,
            publishKey: process.env.PUBKEY,
            userId: user,
        });

        publishPubnub.publish({
            channel,
            message,
            userId: user,
        }, function(status, response) {
            if (status.error) {
              console.error(status);
            } else {
                //pass
            }
        });


        await sleep(process.env.SLEEP_IN_MS);

        const nextPrompt = receivedMessages.map(msg => {
            return { role: "user", content: JSON.stringify(msg) } 
        });

        const systemPrompt = `
            Your role is to suggest additional json objects in the same format as existing ones.
            The format and json properties should be the same, but the values can change.
            Please ignore any messages that are not user messages! Don't consider those.
            The json object you provide should represent an action taken by a character in the game.
            Please don't include any placeholders or extra context, just give the json objects.
        `;

        nextPrompt.push({role: "system", content: systemPrompt})

        try {
            trim(nextPrompt);
            const nextMessage = await openai.createChatCompletion({
                model,
                messages: nextPrompt
            });
    
            message = nextMessage.data.choices[0].message.content;
        } catch (e) {
            console.error('got an error, keep going');
        }

    }
    
}

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

main();

function trim(messages) {
    let chars = 0
    messages.forEach(msg => {
        chars += JSON.stringify(msg).length; 
     });

    while (chars > 10000) {
        messages.shift();
        chars = 0;
        messages.forEach(msg => {
            chars += JSON.stringify(msg).length; 
         });
    }

    return messages;
}
