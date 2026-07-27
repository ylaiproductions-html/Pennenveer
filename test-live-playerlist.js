import prismarineAuth from "prismarine-auth";
const { Authflow, Titles } = prismarineAuth;
import prismarineRealms from "prismarine-realms";
const { RealmAPI } = prismarineRealms;
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

    const api = RealmAPI.from(authflow, "bedrock");

    console.log("[Test] Roep /activities/liveplayerlist rechtstreeks aan…");
    try {
        const data = await api.rest.get("/activities/liveplayerlist");
        console.log("[Test] Resultaat:");
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("[Test] Fout bij aanroepen van liveplayerlist endpoint:");
        console.error(err);
    }
}

main();
