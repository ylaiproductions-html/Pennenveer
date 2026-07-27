import prismarineAuth from "prismarine-auth";
const { Authflow, Titles } = prismarineAuth;
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_CACHE_FOLDER = path.join(__dirname, "auth-cache");
const BOT_USERNAME = "WereldRadarBot";

function logMsaCode(data) {
    console.log("\n=== Microsoft-login vereist ===");
    console.log(data.message);
    console.log("================================\n");
}

async function main() {
    const authflow = new Authflow(
        BOT_USERNAME,
        AUTH_CACHE_FOLDER,
        { flow: "live", authTitle: Titles.MinecraftNintendoSwitch, deviceType: "Nintendo" },
        logMsaCode
    );

    const xbl = await authflow.getXboxToken();
    console.log("UserHash:", xbl.userHash);
    console.log("XUID:", xbl.userXUID);

    const res = await fetch(
        "https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag,GameDisplayName",
        {
            headers: {
                "x-xbl-contract-version": "3",
                Authorization: `XBL3.0 x=${xbl.userHash};${xbl.XSTSToken}`,
            },
        }
    );
    const data = await res.json();
    console.log("[Gamertag opzoeken] Resultaat:");
    console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
    console.error("[Gamertag opzoeken] Fout:", err);
});
