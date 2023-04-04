/*
Secret file format
{
    "username":"username here",
    "password":"DID I PROTECT THIS FILE FROM GIT LOADERS ?"
}
*/

import fs from "fs/promises"
import util from 'util'
async function getCredentials() {
  try {
    const data = await fs.readFile('./Helper/secret.secret', 'utf-8');
    return JSON.parse(data)
  } catch (error) {
    throw `${error} Credentials Missing`;
  }
}

export default getCredentials