# hackathon-pubnub-ai
PubNub AI Hackathon project

This was done as part of the April 2023 PubNub Hackathon

To work, it requires API keys in environment for OpenAI's chat completion API, PubNub pubkey/subkey, and a Hugging Face inference API key (if using visualization). Can use example.env for key names and just remove the `example` prefix.

Requires node.js >= v18

Simulators can be run with `node chatSim.js` etc from the root dir. 

The PubNubAI can be run against any channels on the subkey, with `node pubnubAI.js`.
