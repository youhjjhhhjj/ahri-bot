# Ahri Bot
Discord.js bot for managing large creator-centered servers

## Commands
Ahri Bot comes with the following commands for the moderation and management of the server

`/test`: Checks the availability of the bot (responds with '👍')  
`/delete_message [message_id]`: Delete the message in this channel with the given ID  
`/timeout [user] [duration]`: Timeout the user for the provided duration number of minutes  
`/anon [message]`: Send a message in this channel anonymously through the bot  
`/stick [message_id]`: Save the content of the message in this channel with the given ID and keep it bumped  
`/unstick [message_id]`: Remove the bumped message set by the above command  
`/embed [url]` Create/recreate the Ko-fi amount tracker with the url as an embedded image (described in detail further below)

## Self-moderation
Ahri Bot contains two reaction-based actions for users to moderate themselves

1. Message vote timeout: When a message gets 5 more '⬆️' reactions than '⬇️' reactions, the author is timed out for 10 minutes, increasing to 30 minutes for repeated infractions within a 1 hour span
2. Temporary role assignment: When a message gets 5 ⭐ reactions (configurable), the author is given a specified role for 1 hour (whether a punishment or reward is up to you)

## Ko-fi integration
Ahri Bot contains many functionalities to link to a Ko-fi account

Step 1: Copy the HTTP server's url to your Ko-fi webhook endpoint (https://ko-fi.com/manage/webhooks  )
Step 2: Set the `campaign` variable to the donation goal  
Step 3: Call `/embed` with the url of the image you want to be set

Now when you receive a donation, the embed will automatically update towards the amount. If a donator messages Ahri Bot (modal input is currently being worked on) with their Ko-fi email, they will be assigned the donator role.

## Conversation
Ahri Bot can be linked to a Cohere LLM (https://cohere.com/) to respond to users

Create an account and replace the POST header Authorization field value with your bearer token, and any time the bot is mentioned in a non-protected channel, it will send the input to the language model and respond with the response.  
Cohere can be substituted with other LLM APIs with minor modifications to the POST request options.

Note: this does not as of yet consider the context of any messages beyond the one that caused the mention

## Getting Started
Ahri Bot is fairly easy to setup and deploy either locally or on the cloud

Step 1: Replace any fields in `globals.js` with ones specific to your server  
Step 2: Follow the instructions for any section listed above to get those functionalities working (optional)  
Step 3: Either provision or run locally a PostgreSQL database and insert its URL into the indicated location of `globals.js`  
Step 4: Register a new bot on discord and copy its bot token into a new file `token.json` in the same directory as `index.js`  
Step 5: Navigate to the base directory and run `npm install` followed by `node src/main.js`. Alternatively, on cloud deployments this can be done using an image building software (such as Buildpacks)

If everything was done correctly, you should see your bot come online and report "Logged in".
