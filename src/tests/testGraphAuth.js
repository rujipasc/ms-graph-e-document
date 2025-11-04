import { getAccessToken } from "../integrations/graphAuth.js";

const test = async () => {
  const token = await getAccessToken();
  console.log("Access Token (short):", token.substring(0, 50) + "...");
};

test()