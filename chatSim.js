const { OpenAIApi, Configuration } = require("openai");
require('dotenv').config();
const PubNub = require('pubnub');
const readline = require('readline');

const model = "gpt-3.5-turbo"


async function main() {

    console.log("Chat Simulator: An AI conversation on PubNub\n");

    const channel = await promptUser("What channel should we use?\n");
    if (channel == "exit") {
        process.exit(0);
    }

    const numUsers = await promptUser("How many users do you want talking?\n");
    if (numUsers == "exit") {
        process.exit(0);
    }
    
    const topic = await promptUser("What topic do you want them to discuss?\n");

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
            {role: "system", content: `Please give me a comma separated list of ${numUsers} unique international human sounding names, just the names, nothing else`}
        ],
      });
    
    const users = nameCompletion.data.choices[0].message.content.split(', ');
    console.log(users);




    const initialPrompt = await openai.createChatCompletion({
        model,
        messages: [
            {role: "user", content: `Please give me an interesting conversation starter about ${topic}`}
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
            Your role is to continue the conversation.
            Based on the last message, what is an appropriate thing to say next?
            Please ignore any messages that are not user messages! Don't consider those.
            Be natural, engaging, and responsive to the most recent message in the conversation. 
            Its ok to take tangents slightly, but generally stay on the topic of ${topic}.
            Sometimes ask questions rather than just state facts, but try to stay on topic. 
            Although don't always ask questions and don't always agree necessarily.
            If the initial prompt says to give numbers or json, approximate that instead of regular english.
            Only give me purely what should be put next in the conversation, no meta context, and only the human sounding text content.
            Please don't include any placeholders, just give the natural responses.
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
