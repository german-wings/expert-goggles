import fs from "fs/promises"
async function getCredentials() {
  try {
    const data = await fs.readFile('./Helper/secret.config', 'utf-8');
    return JSON.parse(data)
  } catch (error) {
    throw `${error} Credentials Missing`;
  }
}

export default getCredentials