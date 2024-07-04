const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const base64 = require("js-base64");
const Mailparser = require("mailparser");
const simpleParser = require("mailparser").simpleParser;

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.labels.list({
    userId: "me",
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log("No labels found.");
    return;
  }
  console.log("Labels:");
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

function listMessages(auth, query) {
  // TODO: use your own email here to fetch
  query = "drive-shares-dm-noreply@google.com";
  // query = "ashish.roy@admitkard.com";
  return new Promise((resolve, reject) => {
    const gmail = google.gmail({ version: "v1", auth });
    gmail.users.messages.list(
      {
        userId: "me",
        q: query,
        maxResults: 1,
      },
      (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        if (!res.data.messages) {
          resolve([]);
          return;
        }

        resolve(res.data);

        getMail(res.data.messages[0].id, auth);
      }
    );
  });
}

function getMail(msgId, auth) {
  console.log('msgId', msgId);
  const gmail = google.gmail({ version: "v1", auth });
  //This api call will fetch the mailbody.
  gmail.users.messages.get(
    {
      userId: "me",
      id: msgId,
    },
    (err, res) => {
      console.log("label", res.data.labelIds.INBOX);
      if (!err) {
        console.log("no error");
        // var body = res.data.payload.parts[0].body.data;

        // console.log('keys', Object.keys(res.data.payload.parts))
        // console.log('res.data.payload.parts', res.data.payload);

        const mainParts = res.data.payload.parts;

        mainParts.forEach((part) => {
          console.log(`mimeType: ${part.mimeType}`);
          console.log(`filename: ${part.filename}`);
          console.log('keys:body', Object.keys(part.body));
          if(part.mimeType.startsWith('text/')) {
            console.log('body', base64.decode(part.body.data));
          } else if(part.body.attachmentId) {
            console.log('attachmentId', part.body.attachmentId);
          }
          console.log("======\n");
        })
      }
    }
  );
}

authorize().then(listMessages).catch(console.error);
