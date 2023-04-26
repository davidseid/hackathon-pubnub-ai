const { OpenAIApi, Configuration } = require("openai");
require('dotenv').config();
const PubNub = require('pubnub');
const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const { HfInference } = require('@huggingface/inference');
const spawn = require('child_process').spawn;

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

async function main() {

    console.log("I'm PubNub AI, I'm here to help you find out realtime information about your application.\n");

    const channel = await promptUser("Choose a channel of interest: \n");

    while (true) {
        const question = await promptUser("\n\nWhat do you want to know?\n\n");

        if (question == "exit") {
            process.exit(0);
        }

        const pubnubAI = new PubNub({
            subscribeKey: process.env.SUBKEY,
            publishKey: process.env.PUBKEY,
            userId: 'AI',
        });

        const pubnubAdmin = new PubNub({
            subscribeKey: process.env.SUBKEY,
            publishKey: process.env.PUBKEY,
            userId: 'Admin',
        });
    
        const configuration = new Configuration({
          apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
    
        const historicalMessages = await pubnubAI.fetchMessages({
            channels: [ channel ],
            includeUUID: true,
            includeMeta: true,
            count: 25,
        });
    

    
        const messagesHistoryForAI = [];
    
        historicalMessages.channels[channel].forEach(msg => {
            const unixTimestamp = Math.floor(msg.timetoken / 10000000);

            const date = new Date(unixTimestamp * 1000);

            const localTimeString = date.toLocaleString(); 

            msg.humanDate = localTimeString;
            let aiMessage = { role: "user", content: JSON.stringify(msg) };
            messagesHistoryForAI.push(aiMessage);
        });


        if (question.includes('visualize')) {

            const inference = new HfInference(process.env.HUGGING_FACE_API_KEY);
            let summaryPrompt = messagesHistoryForAI;

            
            summaryPrompt.push({ role: "system", content: 'Give me a short descriptive summary of all the previous messages' });

            trim(summaryPrompt);
            const summary = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: summaryPrompt,
              });
    
            let response = summary.data.choices[0].message.content;

            let visualizationPrompt = response + '\n' + question;


            console.log('\nOk, a picture is worth 1000 words. Give me a few seconds...\n')

            try {
                const blob = await inference.textToImage({
                    model: 'stabilityai/stable-diffusion-2',
                    inputs: visualizationPrompt,
                    parameters: {
                      negative_prompt: 'blurry',
                    }
                  });
    
                var imageName = './hackathon.jpg';
    
            
                const buffer = await blobToBuffer(blob);
                fs.createWriteStream(imageName).write(buffer);
    
                spawn('open', [ imageName ]);
            } catch (e) {
                console.log('oops, had an error, try again');
            }

    
        } else {
            messagesHistoryForAI.push({role: "system", content: "Based on all the prior messages, I as Admin am going to ask you a question to help me understand insights and summaries from the conversation. My question is: "});
        
            messagesHistoryForAI.push({role: "system", content: `My admin question is: ${question}`});
        
            console.log("\n\nThinking....\n\n");
        
            try {
                trim(messagesHistoryForAI);
    
                const completion = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: messagesHistoryForAI,
                  });
        
                let response = completion.data.choices[0].message.content;
        
                console.log(response);
        
                await pubnubAdmin.publish({
                    channel,
                    message: question
                });
    
                await pubnubAI.publish({
                    channel,
                    message: response,
                });
            } catch (e) {
                console.error('got an error, keep going');
                console.error(e);
            }
        }
    



    }
    
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


function blobToBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = blob.stream().getReader();
      const chunks = [];
  
      function read() {
        reader.read().then(({ value, done }) => {
          if (done) {
            resolve(Buffer.concat(chunks));
          } else {
            chunks.push(Buffer.from(value));
            read();
          }
        }).catch(reject);
      }
  
      read();
    });
  }
